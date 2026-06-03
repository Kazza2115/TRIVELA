-- TRIVELA — CORRECTIF inscription cassée
-- Le trigger handle_new_user lève une exception → "Database error creating new
-- user" à CHAQUE inscription. On le blinde (ne bloque plus jamais la création
-- du compte) et on journalise la vraie erreur pour la corriger ensuite.
-- À coller dans Supabase → SQL Editor → Run. Idempotent.

create table if not exists signup_errors (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid,
  err        text,
  created_at timestamptz not null default now()
);
alter table signup_errors enable row level security;
-- Pas de policy : seul le service role (clé serveur) peut lire → suffisant.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    -- On n'insère PAS "favorites" : sa valeur par défaut s'applique, ce qui
    -- évite tout conflit de type (la colonne est text[], pas jsonb).
    insert into public.profiles (id, pseudo, country_code, country_name)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'pseudo', 'Joueur'),
      coalesce(new.raw_user_meta_data->>'country_code', 'un'),
      coalesce(new.raw_user_meta_data->>'country_name', '—')
    )
    on conflict (id) do nothing;
  exception when others then
    -- Ne JAMAIS bloquer la création du compte ; on note l'erreur pour diagnostic.
    insert into public.signup_errors (user_id, err) values (new.id, sqlerrm);
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
