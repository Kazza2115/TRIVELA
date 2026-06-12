-- TRIVELA — Classement avec critères de départage
-- À coller dans Supabase → SQL Editor → Run. Idempotent.
-- Renvoie chaque joueur avec son score + nb de scores EXACTS (points=5)
-- + nb de BONS RÉSULTATS (points>0). N'expose que des compteurs agrégés
-- (jamais les pronostics individuels), donc sûr pour tous.

create or replace function public.leaderboard()
returns table (
  id           uuid,
  pseudo       text,
  country_code text,
  country_name text,
  score        int,
  created_at   timestamptz,
  favorites    jsonb,
  is_admin     boolean,
  exact_count  int,
  good_count   int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.pseudo, p.country_code, p.country_name,
    p.score, p.created_at, to_jsonb(p.favorites), coalesce(p.is_admin, false),
    coalesce(sum((b.points = 5)::int), 0)::int                         as exact_count,
    coalesce(sum((b.points is not null and b.points > 0)::int), 0)::int as good_count
  from public.profiles p
  left join public.bets b on b.user_id = p.id
  group by p.id;
$$;
