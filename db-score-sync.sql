-- TRIVELA — Classement maintenu automatiquement par la base (trigger)
-- À coller dans Supabase → SQL Editor → Run. Idempotent. À lancer UNE fois.
--
-- But : profiles.score = somme des points des paris du joueur, recalculé
-- INSTANTANÉMENT en base à chaque écriture de pari (notamment au règlement, quand
-- les points sont posés). Fini la réconciliation différée : le classement est
-- toujours à jour, sans dépendre du worker Cloudflare ni des crons GitHub.
--
-- Sécurité : le trigger recalcule depuis bets.points (que seul le service role écrit
-- au règlement) → un joueur ne peut pas gonfler son score en posant des paris
-- (points restent NULL tant que le match n'est pas réglé).

create or replace function public.sync_profile_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles p
     set score = coalesce((select sum(b.points) from public.bets b where b.user_id = uid), 0)
   where p.id = uid;
  return null;
end;
$$;

drop trigger if exists sync_profile_score_trg on public.bets;
create trigger sync_profile_score_trg
  after insert or update or delete on public.bets
  for each row execute function public.sync_profile_score();

-- Resynchronise immédiatement tous les scores existants (one-shot).
update public.profiles p
   set score = coalesce((select sum(b.points) from public.bets b where b.user_id = p.id), 0);
