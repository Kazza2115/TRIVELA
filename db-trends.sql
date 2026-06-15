-- TRIVELA — Tendances (pronostics agrégés + cotes bookmakers)
-- À coller dans Supabase → SQL Editor → Run. Idempotent.
--
-- Trois objets :
--   1) match_trends()        — agrégat V/N/D par match (compteurs SEULEMENT, jamais
--      les pronostics individuels) → sûr AVANT le coup d'envoi, comme leaderboard().
--   2) match_player_bets()    — détail joueur par joueur d'un match, mais le SCORE
--      reste masqué tant que le match n'a pas démarré (équité anti-copie), exactement
--      comme la vue public_bets.
--   3) match_odds             — probabilités « mondiales » (consensus bookmakers),
--      alimentées par scripts/api-football-odds.mjs.

-- ══ 1) match_trends() — tendance TRIVELA agrégée ════════════════════════════
-- Pour chaque match ayant au moins un pronostic : nb de pronos donnant la victoire
-- au domicile / un nul / la victoire à l'extérieur, + total. N'expose AUCUN prono
-- individuel → diffusable à tous, même avant le coup d'envoi.
create or replace function public.match_trends()
returns table (
  match_id  text,
  home_win  int,
  draw      int,
  away_win  int,
  total     int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.match_id,
    coalesce(sum((b.home_score >  b.away_score)::int), 0)::int as home_win,
    coalesce(sum((b.home_score =  b.away_score)::int), 0)::int as draw,
    coalesce(sum((b.home_score <  b.away_score)::int), 0)::int as away_win,
    count(*)::int                                              as total
  from public.bets b
  group by b.match_id;
$$;

grant execute on function public.match_trends() to anon, authenticated;

-- ══ 2) match_player_bets() — détail des pronos d'un match (score reveal-gated) ══
-- Renvoie chaque joueur ayant pronostiqué ce match, avec son pseudo + drapeau.
-- home_score / away_score ne sont dévoilés QUE si : c'est mon propre prono, OU le
-- pari est verrouillé, OU le coup d'envoi est passé. Sinon NULL (et revealed=false)
-- → impossible de copier le score d'un autre avant le match.
create or replace function public.match_player_bets(p_match_id text)
returns table (
  user_id      uuid,
  pseudo       text,
  country_code text,
  home_score   int,
  away_score   int,
  points       int,
  revealed     boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.user_id,
    p.pseudo,
    p.country_code,
    case when reveal.ok then b.home_score end as home_score,
    case when reveal.ok then b.away_score end as away_score,
    b.points,
    reveal.ok                                 as revealed
  from public.bets b
  join public.profiles p          on p.id = b.user_id
  left join public.match_schedule s on s.match_id = b.match_id
  cross join lateral (
    select (b.user_id = auth.uid()
            or b.locked
            or (s.kickoff is not null and now() >= s.kickoff)) as ok
  ) reveal
  where b.match_id = p_match_id;
$$;

grant execute on function public.match_player_bets(text) to anon, authenticated;

-- ══ 3) match_odds — tendance « mondiale » (consensus bookmakers) ═════════════
-- Probabilités implicites (dé-viggées) home/draw/away en %, moyennées sur tous les
-- bookmakers renvoyés par API-Football. Alimentée par le job api-football-odds.mjs
-- (service role). Lecture publique ; écriture réservée au service role.
create table if not exists public.match_odds (
  match_id   text        primary key,
  home_pct   int         not null,
  draw_pct   int         not null,
  away_pct   int         not null,
  bookmakers int         not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.match_odds enable row level security;
drop policy if exists "odds_select_all" on public.match_odds;
create policy "odds_select_all" on public.match_odds for select using (true);
-- (Aucune policy d'écriture : seul le service role, qui contourne la RLS, écrit.)

-- Realtime (l'app peut s'abonner aux mises à jour des cotes).
do $$
begin
  begin
    alter publication supabase_realtime add table public.match_odds;
  exception when duplicate_object then null;
  end;
end $$;
