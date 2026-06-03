-- TRIVELA — Chat global en direct
-- Table des messages + sécurité (RLS) + temps réel.
-- À coller dans Supabase → SQL Editor → Run. Idempotent (réexécutable sans risque).

create table if not exists chat_messages (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references profiles(id) on delete cascade,
  pseudo       text        not null,
  country_code text        not null default 'un',
  body         text        not null check (char_length(body) between 1 and 500),
  created_at   timestamptz not null default now()
);
create index if not exists chat_messages_created_idx on chat_messages (created_at);

alter table chat_messages enable row level security;

-- Lecture : tout le monde peut lire le chat
drop policy if exists chat_select on chat_messages;
create policy chat_select on chat_messages for select using (true);

-- Écriture : on ne peut publier qu'en son propre nom
drop policy if exists chat_insert on chat_messages;
create policy chat_insert on chat_messages for insert with check (auth.uid() = user_id);

-- Suppression : chacun peut supprimer SES propres messages
drop policy if exists chat_delete on chat_messages;
create policy chat_delete on chat_messages for delete using (auth.uid() = user_id);

-- Temps réel (ajout idempotent à la publication realtime)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
end $$;
