-- TRIVELA — Boîte de réception / notifications
-- À coller dans Supabase → SQL Editor → Run. Idempotent (réexécutable sans risque).
-- Crée une notification quand un joueur reçoit : un commentaire, une note (étoiles)
-- sur son pronostic, ou une mention @pseudo dans le chat.

create table if not exists notifications (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references profiles(id) on delete cascade,  -- destinataire
  type         text        not null,        -- 'comment' | 'rating' | 'mention'
  actor_id     uuid,                          -- qui a déclenché
  actor_pseudo text        not null default '',
  match_id     text,
  body         text,                          -- extrait du commentaire / valeur de note / extrait du message
  read         boolean     not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, read, created_at desc);

alter table notifications enable row level security;
-- Le destinataire seul lit / met à jour / supprime ses notifications.
-- L'insertion se fait uniquement via les triggers (security definer) ci-dessous.
drop policy if exists notif_select_own on notifications;
create policy notif_select_own on notifications for select using (auth.uid() = user_id);
drop policy if exists notif_update_own on notifications;
create policy notif_update_own on notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists notif_delete_own on notifications;
create policy notif_delete_own on notifications for delete using (auth.uid() = user_id);

-- ── Commentaire sur un pronostic ─────────────────────────────────────────────
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.author_id is distinct from new.target_user_id then
    insert into notifications (user_id, type, actor_id, actor_pseudo, match_id, body)
    values (new.target_user_id, 'comment', new.author_id, new.author_pseudo, new.match_id, left(new.body, 140));
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_comment on bet_comments;
create trigger trg_notify_comment after insert on bet_comments
  for each row execute function public.notify_on_comment();

-- ── Note (étoiles) sur un pronostic ──────────────────────────────────────────
-- AFTER INSERT seulement : re-noter (upsert → UPDATE) ne renotifie pas.
create or replace function public.notify_on_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pseudo text;
begin
  select pseudo into v_pseudo from profiles where id = new.rater_id;
  insert into notifications (user_id, type, actor_id, actor_pseudo, match_id, body)
  values (new.target_user_id, 'rating', new.rater_id, coalesce(v_pseudo, 'Quelqu''un'), new.match_id, new.rating::text);
  return new;
end $$;
drop trigger if exists trg_notify_rating on bet_ratings;
create trigger trg_notify_rating after insert on bet_ratings
  for each row execute function public.notify_on_rating();

-- ── Mention @pseudo dans le chat ─────────────────────────────────────────────
create or replace function public.notify_on_mention()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if position('@' in new.body) = 0 then return new; end if;
  insert into notifications (user_id, type, actor_id, actor_pseudo, match_id, body)
  select p.id, 'mention', new.user_id, new.pseudo, null, left(new.body, 140)
  from profiles p
  where p.id is distinct from new.user_id
    and new.body ~* ('@' || regexp_replace(p.pseudo, '([.^$*+?()\[\]{}\\|-])', '\\\1', 'g') || '($|[^[:alnum:]_])');
  return new;
end $$;
drop trigger if exists trg_notify_mention on chat_messages;
create trigger trg_notify_mention after insert on chat_messages
  for each row execute function public.notify_on_mention();

-- ── Temps réel ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
