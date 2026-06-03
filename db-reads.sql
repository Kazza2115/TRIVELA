-- TRIVELA — Accusés de lecture du chat (« vu par »)
-- À coller dans Supabase → SQL Editor → Run. Idempotent.

create table if not exists chat_reads (
  user_id      uuid        primary key references profiles(id) on delete cascade,
  pseudo       text        not null,
  country_code text        not null default 'un',
  last_read    timestamptz not null default now()
);
alter table chat_reads enable row level security;

-- Lecture : tout le monde (pour afficher qui a vu)
drop policy if exists chat_reads_select on chat_reads;
create policy chat_reads_select on chat_reads for select using (true);

-- Écriture : chacun ne met à jour que sa propre ligne
drop policy if exists chat_reads_insert on chat_reads;
create policy chat_reads_insert on chat_reads for insert with check (auth.uid() = user_id);
drop policy if exists chat_reads_update on chat_reads;
create policy chat_reads_update on chat_reads for update using (auth.uid() = user_id);

-- Temps réel
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_reads'
  ) then
    alter publication supabase_realtime add table chat_reads;
  end if;
end $$;
