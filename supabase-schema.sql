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
  -- On n'insère PAS "favorites" : sa valeur par défaut s'applique. Cela évite
  -- tout conflit de type si la colonne existante est text[] plutôt que jsonb.
  begin
    insert into public.profiles (id, pseudo, country_code, country_name)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'pseudo', 'Joueur'),
      coalesce(new.raw_user_meta_data->>'country_code', 'un'),
      coalesce(new.raw_user_meta_data->>'country_name', '—')
    )
    on conflict (id) do nothing;
  exception when others then
    -- Ne jamais bloquer la création du compte en cas d'erreur inattendue.
    null;
  end;
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
returns boolean   -- true si le résultat a été créé OU corrigé, false si inchangé
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing match_results%rowtype;
begin
  select * into v_existing from match_results where match_id = p_match_id;

  -- Déjà réglé avec EXACTEMENT le même score → rien à faire (idempotent).
  if found and v_existing.home_score = p_home_score and v_existing.away_score = p_away_score then
    return false;
  end if;

  -- Auto-correction : annule d'abord les points déjà attribués pour ce match
  -- (cas d'un score précédemment faux, ex. orientation inversée).
  update profiles pr
     set score = pr.score - agg.total
    from (select user_id, coalesce(sum(points), 0) as total
            from bets where match_id = p_match_id group by user_id) agg
   where pr.id = agg.user_id;

  -- Enregistre ou met à jour le résultat officiel.
  if found then
    update match_results
       set home_score = p_home_score, away_score = p_away_score, settled_at = now()
     where match_id = p_match_id;
  else
    insert into match_results (match_id, home_score, away_score, settled_at)
    values (p_match_id, p_home_score, p_away_score, now());
  end if;

  -- (Re)calcule les points — barème : +5 exact · +4 bon nul · +3 bon vainqueur · 0 sinon.
  with scored as (
    select b.id, b.user_id,
      case
        when b.home_score = p_home_score and b.away_score = p_away_score then 5
        when p_home_score > p_away_score and b.home_score > b.away_score then 3
        when p_home_score < p_away_score and b.home_score < b.away_score then 3
        when p_home_score = p_away_score and b.home_score = b.away_score then 4
        else 0
      end as pts
    from bets b
    where b.match_id = p_match_id
  ),
  upd_bets as (
    update bets b set points = s.pts, locked = true
      from scored s where b.id = s.id
    returning s.user_id, s.pts
  )
  update profiles pr
     set score = pr.score + agg.total
    from (select user_id, sum(pts) as total from upd_bets group by user_id) agg
   where pr.id = agg.user_id;

  return true;
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

-- ══════════════════════════════════════════════════════════════════════════
-- ══ SOCIAL : voir / noter / commenter les pronostics des autres ════════════
-- ══════════════════════════════════════════════════════════════════════════

-- ══ match_schedule — coup d'envoi (UTC) de chaque match ══════════════════════
-- Sert à révéler le score d'un pronostic UNIQUEMENT à partir du coup d'envoi
-- (équité : on ne peut pas copier le score d'un autre avant le match).
create table if not exists match_schedule (
  match_id text        primary key,
  kickoff  timestamptz not null
);
alter table match_schedule enable row level security;
drop policy if exists "schedule_select_all" on match_schedule;
create policy "schedule_select_all" on match_schedule for select using (true);
-- Écriture réservée au service role (le seed ci-dessous est lancé en SQL admin).

-- ══ public_bets — vue publique des paris, SCORE MASQUÉ avant le coup d'envoi ══
-- security_invoker reste à false (défaut) : la vue lit tous les paris en
-- contournant la RLS de `bets`, mais ne dévoile home_score/away_score que si le
-- match a démarré (kickoff passé) ou est déjà réglé (locked). La table `bets`
-- garde sa RLS « select own » : aucun accès direct au score d'autrui.
create or replace view public_bets as
select
  b.id, b.user_id, b.match_id, b.home, b.away, b.stage,
  b.points, b.locked, b.created_at,
  case when b.user_id = auth.uid() or b.locked or (s.kickoff is not null and now() >= s.kickoff)
       then b.home_score end as home_score,
  case when b.user_id = auth.uid() or b.locked or (s.kickoff is not null and now() >= s.kickoff)
       then b.away_score end as away_score,
  (b.user_id = auth.uid() or b.locked or (s.kickoff is not null and now() >= s.kickoff)) as revealed,
  s.kickoff
from bets b
left join match_schedule s on s.match_id = b.match_id;

grant select on public_bets to anon, authenticated;

-- ══ bet_ratings — note (1–5 ⭐) d'un joueur sur le pronostic d'un autre ════════
create table if not exists bet_ratings (
  id             uuid        primary key default gen_random_uuid(),
  match_id       text        not null,
  target_user_id uuid        not null references profiles(id) on delete cascade,
  rater_id       uuid        not null references profiles(id) on delete cascade,
  rating         smallint    not null check (rating between 1 and 5),
  created_at     timestamptz not null default now(),
  unique (match_id, target_user_id, rater_id),
  check (rater_id <> target_user_id)   -- on ne note pas son propre pronostic
);
alter table bet_ratings enable row level security;
drop policy if exists "ratings_select_all" on bet_ratings;
drop policy if exists "ratings_insert_own" on bet_ratings;
drop policy if exists "ratings_update_own" on bet_ratings;
drop policy if exists "ratings_delete_own" on bet_ratings;
create policy "ratings_select_all" on bet_ratings for select using (true);
create policy "ratings_insert_own" on bet_ratings for insert with check (auth.uid() = rater_id);
create policy "ratings_update_own" on bet_ratings for update using (auth.uid() = rater_id) with check (auth.uid() = rater_id);
create policy "ratings_delete_own" on bet_ratings for delete using (auth.uid() = rater_id);

-- ══ bet_comments — commentaire sur le pronostic d'un joueur ═══════════════════
create table if not exists bet_comments (
  id             uuid        primary key default gen_random_uuid(),
  match_id       text        not null,
  target_user_id uuid        not null references profiles(id) on delete cascade,
  author_id      uuid        not null references profiles(id) on delete cascade,
  author_pseudo  text        not null,
  body           text        not null check (char_length(body) between 1 and 280),
  created_at     timestamptz not null default now()
);
alter table bet_comments enable row level security;
drop policy if exists "comments_select_all" on bet_comments;
drop policy if exists "comments_insert_own" on bet_comments;
drop policy if exists "comments_delete_own" on bet_comments;
create policy "comments_select_all" on bet_comments for select using (true);
create policy "comments_insert_own" on bet_comments for insert with check (auth.uid() = author_id);
create policy "comments_delete_own" on bet_comments for delete using (auth.uid() = author_id);

-- ══ comment_reactions — 👍 / 👎 sur un commentaire ════════════════════════════
create table if not exists comment_reactions (
  id         uuid        primary key default gen_random_uuid(),
  comment_id uuid        not null references bet_comments(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  value      smallint    not null check (value in (-1, 1)),  -- -1 dislike, +1 like
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);
alter table comment_reactions enable row level security;
drop policy if exists "reactions_select_all" on comment_reactions;
drop policy if exists "reactions_insert_own" on comment_reactions;
drop policy if exists "reactions_update_own" on comment_reactions;
drop policy if exists "reactions_delete_own" on comment_reactions;
create policy "reactions_select_all" on comment_reactions for select using (true);
create policy "reactions_insert_own" on comment_reactions for insert with check (auth.uid() = user_id);
create policy "reactions_update_own" on comment_reactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reactions_delete_own" on comment_reactions for delete using (auth.uid() = user_id);

-- Realtime sur les interactions sociales (fil de commentaires/notes en direct)
do $$
begin
  begin alter publication supabase_realtime add table bet_comments;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table bet_ratings;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table comment_reactions;
  exception when duplicate_object then null; end;
end $$;

-- ══ Seed des horaires (104 matchs : 72 poules + 32 à élimination directe) ═════
-- Régénérable via : node scripts/gen-schedule-sql.mjs
insert into match_schedule (match_id, kickoff) values
  ('gA-md1-mex-zaf', '2026-06-11T19:00:00Z'),
  ('gA-md1-kor-cze', '2026-06-12T02:00:00Z'),
  ('gA-md2-cze-zaf', '2026-06-18T16:00:00Z'),
  ('gA-md2-mex-kor', '2026-06-19T01:00:00Z'),
  ('gA-md3-cze-mex', '2026-06-25T01:00:00Z'),
  ('gA-md3-zaf-kor', '2026-06-25T01:00:00Z'),
  ('gB-md1-can-bih', '2026-06-12T19:00:00Z'),
  ('gB-md1-qat-sui', '2026-06-13T19:00:00Z'),
  ('gB-md2-sui-bih', '2026-06-18T19:00:00Z'),
  ('gB-md2-can-qat', '2026-06-18T22:00:00Z'),
  ('gB-md3-sui-can', '2026-06-24T19:00:00Z'),
  ('gB-md3-bih-qat', '2026-06-24T19:00:00Z'),
  ('gC-md1-bra-mar', '2026-06-13T22:00:00Z'),
  ('gC-md1-hai-sco', '2026-06-14T01:00:00Z'),
  ('gC-md2-sco-mar', '2026-06-19T22:00:00Z'),
  ('gC-md2-bra-hai', '2026-06-20T00:30:00Z'),
  ('gC-md3-sco-bra', '2026-06-24T22:00:00Z'),
  ('gC-md3-mar-hai', '2026-06-24T22:00:00Z'),
  ('gD-md1-usa-par', '2026-06-13T01:00:00Z'),
  ('gD-md1-aus-tur', '2026-06-13T04:00:00Z'),
  ('gD-md2-usa-aus', '2026-06-19T19:00:00Z'),
  ('gD-md2-tur-par', '2026-06-20T03:00:00Z'),
  ('gD-md3-tur-usa', '2026-06-26T02:00:00Z'),
  ('gD-md3-par-aus', '2026-06-26T02:00:00Z'),
  ('gE-md1-ger-cur', '2026-06-14T17:00:00Z'),
  ('gE-md1-civ-ecu', '2026-06-14T23:00:00Z'),
  ('gE-md2-ger-civ', '2026-06-20T20:00:00Z'),
  ('gE-md2-ecu-cur', '2026-06-21T00:00:00Z'),
  ('gE-md3-cur-civ', '2026-06-25T20:00:00Z'),
  ('gE-md3-ecu-ger', '2026-06-25T20:00:00Z'),
  ('gF-md1-ned-jpn', '2026-06-14T20:00:00Z'),
  ('gF-md1-swe-tun', '2026-06-15T02:00:00Z'),
  ('gF-md2-tun-jpn', '2026-06-20T04:00:00Z'),
  ('gF-md2-ned-swe', '2026-06-20T17:00:00Z'),
  ('gF-md3-jpn-swe', '2026-06-25T23:00:00Z'),
  ('gF-md3-tun-ned', '2026-06-25T23:00:00Z'),
  ('gG-md1-bel-egy', '2026-06-15T19:00:00Z'),
  ('gG-md1-irn-nzl', '2026-06-16T01:00:00Z'),
  ('gG-md2-bel-irn', '2026-06-21T19:00:00Z'),
  ('gG-md2-nzl-egy', '2026-06-22T01:00:00Z'),
  ('gG-md3-egy-irn', '2026-06-27T03:00:00Z'),
  ('gG-md3-nzl-bel', '2026-06-27T03:00:00Z'),
  ('gH-md1-esp-cpv', '2026-06-15T16:00:00Z'),
  ('gH-md1-sau-uru', '2026-06-15T22:00:00Z'),
  ('gH-md2-esp-sau', '2026-06-21T16:00:00Z'),
  ('gH-md2-uru-cpv', '2026-06-21T22:00:00Z'),
  ('gH-md3-uru-esp', '2026-06-27T00:00:00Z'),
  ('gH-md3-cpv-sau', '2026-06-27T00:00:00Z'),
  ('gI-md1-fra-sen', '2026-06-16T19:00:00Z'),
  ('gI-md1-irq-nor', '2026-06-16T22:00:00Z'),
  ('gI-md2-fra-irq', '2026-06-22T21:00:00Z'),
  ('gI-md2-nor-sen', '2026-06-23T00:00:00Z'),
  ('gI-md3-nor-fra', '2026-06-26T19:00:00Z'),
  ('gI-md3-sen-irq', '2026-06-26T19:00:00Z'),
  ('gJ-md1-arg-dza', '2026-06-17T01:00:00Z'),
  ('gJ-md1-aut-jor', '2026-06-17T04:00:00Z'),
  ('gJ-md2-arg-aut', '2026-06-22T17:00:00Z'),
  ('gJ-md2-jor-dza', '2026-06-23T03:00:00Z'),
  ('gJ-md3-dza-aut', '2026-06-28T02:00:00Z'),
  ('gJ-md3-jor-arg', '2026-06-28T02:00:00Z'),
  ('gK-md1-por-cod', '2026-06-17T17:00:00Z'),
  ('gK-md1-uzb-col', '2026-06-18T02:00:00Z'),
  ('gK-md2-por-uzb', '2026-06-23T17:00:00Z'),
  ('gK-md2-col-cod', '2026-06-24T02:00:00Z'),
  ('gK-md3-col-por', '2026-06-27T23:30:00Z'),
  ('gK-md3-cod-uzb', '2026-06-27T23:30:00Z'),
  ('gL-md1-eng-cro', '2026-06-17T20:00:00Z'),
  ('gL-md1-gha-pan', '2026-06-17T23:00:00Z'),
  ('gL-md2-eng-gha', '2026-06-23T20:00:00Z'),
  ('gL-md2-pan-cro', '2026-06-23T23:00:00Z'),
  ('gL-md3-pan-eng', '2026-06-27T21:00:00Z'),
  ('gL-md3-cro-gha', '2026-06-27T21:00:00Z'),
  ('r32-1', '2026-06-28T19:00:00Z'),
  ('r32-2', '2026-06-28T22:00:00Z'),
  ('r32-3', '2026-06-29T19:00:00Z'),
  ('r32-4', '2026-06-29T22:00:00Z'),
  ('r32-5', '2026-06-30T19:00:00Z'),
  ('r32-6', '2026-06-30T22:00:00Z'),
  ('r32-7', '2026-07-01T19:00:00Z'),
  ('r32-8', '2026-07-01T22:00:00Z'),
  ('r32-9', '2026-07-02T19:00:00Z'),
  ('r32-10', '2026-07-02T22:00:00Z'),
  ('r32-11', '2026-07-03T19:00:00Z'),
  ('r32-12', '2026-07-03T22:00:00Z'),
  ('r32-13', '2026-07-04T19:00:00Z'),
  ('r32-14', '2026-07-04T22:00:00Z'),
  ('r32-15', '2026-07-05T19:00:00Z'),
  ('r32-16', '2026-07-05T22:00:00Z'),
  ('r16-1', '2026-07-06T19:00:00Z'),
  ('r16-2', '2026-07-06T22:00:00Z'),
  ('r16-3', '2026-07-07T19:00:00Z'),
  ('r16-4', '2026-07-07T22:00:00Z'),
  ('r16-5', '2026-07-08T19:00:00Z'),
  ('r16-6', '2026-07-08T22:00:00Z'),
  ('r16-7', '2026-07-09T19:00:00Z'),
  ('r16-8', '2026-07-09T22:00:00Z'),
  ('qf-1', '2026-07-11T19:00:00Z'),
  ('qf-2', '2026-07-11T22:00:00Z'),
  ('qf-3', '2026-07-12T19:00:00Z'),
  ('qf-4', '2026-07-12T22:00:00Z'),
  ('sf-1', '2026-07-15T00:00:00Z'),
  ('sf-2', '2026-07-16T00:00:00Z'),
  ('3rd', '2026-07-18T22:00:00Z'),
  ('final', '2026-07-19T20:00:00Z')
on conflict (match_id) do update set kickoff = excluded.kickoff;
