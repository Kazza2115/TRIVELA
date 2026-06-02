-- TRIVELA — like/dislike sur les commentaires (👍 / 👎)
-- À coller dans Supabase → SQL Editor → Run. Idempotent (rejouable sans risque).
create table if not exists comment_reactions (
  id         uuid        primary key default gen_random_uuid(),
  comment_id uuid        not null references bet_comments(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  value      smallint    not null check (value in (-1, 1)),
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
do $$
begin
  begin alter publication supabase_realtime add table comment_reactions;
  exception when duplicate_object then null; end;
end $$;
