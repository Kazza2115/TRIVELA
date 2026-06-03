-- TRIVELA — Table des actualités (alimentée par GitHub Actions toutes les ~15 min)
-- À coller dans Supabase → SQL Editor → Run. Idempotent.

create table if not exists news (
  id             text        primary key,          -- lien de l'article
  title          text        not null,
  excerpt        text,
  url            text        not null,
  source         text,
  category       text,
  category_color text,
  flag           text,
  published_at   timestamptz,
  fetched_at     timestamptz not null default now()
);
create index if not exists news_published_idx on news (published_at desc);

alter table news enable row level security;

-- Lecture publique (l'écriture se fait via la clé service, qui ignore la RLS)
drop policy if exists news_select on news;
create policy news_select on news for select using (true);

-- Temps réel (mise à jour instantanée dans l'app)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'news'
  ) then
    alter publication supabase_realtime add table news;
  end if;
end $$;
