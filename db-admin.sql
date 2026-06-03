-- TRIVELA — Système d'administration + protection
-- À coller dans Supabase → SQL Editor → Run. Idempotent.

-- 1. Colonne admin
alter table profiles add column if not exists is_admin boolean not null default false;

-- 2. L'appelant est-il admin ? (security definer → évite la récursion RLS)
create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 3. Anti-escalade : un joueur connecté NON-admin ne peut pas changer is_admin.
--    (auth.uid() null = contexte serveur/SQL/clé service → autorisé pour le bootstrap)
create or replace function public.protect_is_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin() then
    new.is_admin := old.is_admin;   -- changement non autorisé : ignoré
  end if;
  return new;
end $$;
drop trigger if exists protect_is_admin_change on public.profiles;
create trigger protect_is_admin_change
  before update on public.profiles
  for each row execute function public.protect_is_admin();

-- 4. Promouvoir / rétrograder un admin (réservé aux admins)
create or replace function public.admin_set_admin(p_target uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.profiles set is_admin = p_value where id = p_target;
end $$;

-- 5. Vider entièrement le chat (réservé aux admins)
create or replace function public.admin_clear_chat()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  delete from public.chat_messages;
end $$;

-- 6. Les admins peuvent supprimer n'importe quel message du chat
drop policy if exists chat_delete on chat_messages;
create policy chat_delete on chat_messages for delete
  using (auth.uid() = user_id or public.is_admin());

-- 7. Bootstrap : KAZA devient admin
update public.profiles set is_admin = true where pseudo = 'KAZA';
