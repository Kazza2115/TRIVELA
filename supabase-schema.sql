-- ─── TRIVELA – Supabase schema (complet & idempotent) ───────────────────────
-- À exécuter dans l'éditeur SQL de Supabase. Sûr à rejouer plusieurs fois.
--
-- Contenu :
--   • profiles        — infos publiques joueur + score + favoris
--   • bets            — pronostics (1 par joueur/match), verrou serveur
--   • match_results   — scores réels des matchs (alimenté par le job GitHub)
--   • settle_match()  — moteur de points (+5 exact / +3 bon résultat / +1 nul)
--   • handle_new_user — crée la ligne profiles automatiquement à l'inscription
--   • Realtime activé sur match_results et profiles
--
-- Le barème reproduit EXACTEMENT calcPoints() de src/pages/Paris.tsx.

-- ══ profiles ════════════════════════════════════════════════════════════════
create table if not exists profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  pseudo       text        unique not null,
  country_code text        not null,
  country_name text        not null,
  score        int         not null default 0,
  favorites    jsonb       not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

-- Colonne favorites ajoutée si la table existait déjà sans elle
alter table profiles add column if not exists favorites jsonb not null default '[]'::jsonb;

alter table profiles enable row level security;

drop policy if exists "profiles_select_all"  on profiles;
drop policy if exists "profiles_update_own"  on profiles;
drop policy if exists "profiles_insert_own"  on profiles;

create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- ── Création automatique du profil à l'inscription ───────────────────────────
-- register() côté client ne fait que le signup : ce trigger crée la ligne
-- profiles à partir des métadonnées (pseudo, country_code, country_name).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo, country_code, country_name, favorites)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'pseudo', 'Joueur'),
    coalesce(new.raw_user_meta_data->>'country_code', 'un'),
    coalesce(new.raw_user_meta_data->>'country_name', '—'),
    '[]'::jsonb
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ══ bets ════════════════════════════════════════════════════════════════════
create table if not exists bets (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  match_id    text        not null,
  home        text        not null,
  away        text        not null,
  home_score  int         not null,
  away_score  int         not null,
  stage       text        not null,
  locked      boolean     not null default false,
  points      int,
  created_at  timestamptz not null default now(),
  unique(user_id, match_id)
);

-- Colonnes ajoutées si la table existait déjà sans elles
alter table bets add column if not exists locked boolean not null default false;
alter table bets add column if not exists points int;

alter table bets enable row level security;

drop policy if exists "bets_select_own" on bets;
drop policy if exists "bets_insert_own" on bets;
drop policy if exists "bets_update_own" on bets;

create policy "bets_select_own" on bets for select using (auth.uid() = user_id);
create policy "bets_insert_own" on bets for insert with check (auth.uid() = user_id);
-- Modification autorisée uniquement tant que le pari n'est pas verrouillé
create policy "bets_update_own" on bets for update
  using (auth.uid() = user_id and locked = false)
  with check (auth.uid() = user_id and locked = false);

-- ══ match_results ═══════════════════════════════════════════════════════════
create table if not exists match_results (
  match_id     text        primary key,
  home_score   int         not null,
  away_score   int         not null,
  api_match_id bigint,
  settled_at   timestamptz not null default now()
);

alter table match_results add column if not exists api_match_id bigint;

alter table match_results enable row level security;

-- Lecture publique (l'app s'y abonne via la clé anon)
drop policy if exists "match_results_select_all" on match_results;
create policy "match_results_select_all" on match_results for select using (true);
-- Aucune policy d'écriture : seul le service role (job GitHub) écrit, il
-- contourne la RLS. Les clients ne peuvent donc jamais falsifier un score.

-- ══ settle_match() — moteur de points ═══════════════════════════════════════
-- Appelée par scripts/update-results.mjs avec le score réel d'un match.
-- 1) enregistre le résultat (idempotent : ne fait rien si déjà réglé)
-- 2) calcule les points de chaque pari sur ce match
-- 3) ajoute les points à profiles.score et verrouille les paris
create or replace function settle_match(
  p_match_id   text,
  p_home_score int,
  p_away_score int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Idempotence : si le match est déjà réglé, on ne recompte pas.
  if exists (select 1 from match_results where match_id = p_match_id) then
    return;
  end if;

  insert into match_results (match_id, home_score, away_score, settled_at)
  values (p_match_id, p_home_score, p_away_score, now());

  -- Barème identique à calcPoints() côté client :
  --   +5 score exact · +3 bon vainqueur · +1 si match nul réel · 0 sinon
  with scored as (
    select
      b.id,
      b.user_id,
      case
        when b.home_score = p_home_score and b.away_score = p_away_score then 5
        when p_home_score > p_away_score and b.home_score > b.away_score then 3
        when p_home_score < p_away_score and b.home_score < b.away_score then 3
        when p_home_score = p_away_score then 1
        else 0
      end as pts
    from bets b
    where b.match_id = p_match_id
  ),
  upd_bets as (
    update bets b
       set points = s.pts, locked = true
      from scored s
     where b.id = s.id
    returning s.user_id, s.pts
  )
  update profiles pr
     set score = pr.score + agg.total
    from (
      select user_id, sum(pts) as total
        from upd_bets
       group by user_id
    ) agg
   where pr.id = agg.user_id;
end;
$$;

-- ══ Realtime ════════════════════════════════════════════════════════════════
-- L'app s'abonne aux INSERT de match_results et aux UPDATE de profiles.
do $$
begin
  begin
    alter publication supabase_realtime add table match_results;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table profiles;
  exception when duplicate_object then null;
  end;
end $$;
