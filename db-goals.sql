-- TRIVELA — Buteurs (alimenté par GitHub Actions via API-Football)
-- À coller dans Supabase → SQL Editor → Run. Idempotent.
-- Persiste les buteurs des matchs (live ET terminés) séparément de match_live,
-- qui est vidé dès qu'un match se termine.

create table if not exists match_goals (
  match_id   text        primary key,
  scorers    jsonb       not null default '[]',  -- [{p:"Nom", s:"home"|"away", t:23, og:bool, pen:bool}]
  updated_at timestamptz not null default now()
);
-- Cartons rouges : [{p:"Nom", s:"home"|"away", t:55}]
-- NULL = pas encore synchronisé (le cron ira chercher les événements) ;
-- [] = synchronisé, aucun carton ; [...] = cartons connus.
alter table match_goals add column if not exists cards jsonb;
alter table match_goals alter column cards drop default;
alter table match_goals alter column cards drop not null;
alter table match_goals enable row level security;

drop policy if exists match_goals_select on match_goals;
create policy match_goals_select on match_goals for select using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_goals'
  ) then
    alter publication supabase_realtime add table match_goals;
  end if;
end $$;
