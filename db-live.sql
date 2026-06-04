-- TRIVELA — Scores en direct (alimenté par GitHub Actions via API-Football)
-- À coller dans Supabase → SQL Editor → Run. Idempotent.

create table if not exists match_live (
  match_id   text        primary key,
  status     text        not null,         -- 1H, HT, 2H, ET, P, FT…
  elapsed    int,                          -- minute de jeu
  home_score int         not null default 0,
  away_score int         not null default 0,
  updated_at timestamptz not null default now()
);
alter table match_live enable row level security;

drop policy if exists match_live_select on match_live;
create policy match_live_select on match_live for select using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_live'
  ) then
    alter publication supabase_realtime add table match_live;
  end if;
end $$;
