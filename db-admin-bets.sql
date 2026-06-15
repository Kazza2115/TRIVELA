-- TRIVELA — Édition des pronostics par un admin
-- À coller dans Supabase → SQL Editor → Run. Idempotent.
--
-- Deux fonctions security definer, réservées aux admins (is_admin()) :
--   • admin_get_bet  — lit le prono actuel d'un joueur sur un match (pré-remplissage).
--   • admin_set_bet  — crée / corrige le prono d'un joueur (contourne le verrou de
--     temps), MAIS refuse si le match est déjà réglé (sinon on fausserait les points).
-- Pré-requis : db-admin.sql (is_admin).

create or replace function public.admin_get_bet(p_user_id uuid, p_match_id text)
returns table (home_score int, away_score int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select b.home_score, b.away_score
    from public.bets b
    where b.user_id = p_user_id and b.match_id = p_match_id;
end;
$$;

grant execute on function public.admin_get_bet(uuid, text) to authenticated;

create or replace function public.admin_set_bet(
  p_user_id    uuid,
  p_match_id   text,
  p_home       text,
  p_away       text,
  p_home_score int,
  p_away_score int,
  p_stage      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Joueur introuvable';
  end if;
  if exists (select 1 from public.match_results where match_id = p_match_id) then
    raise exception 'Match déjà réglé — modification impossible';
  end if;
  if p_home_score is null or p_away_score is null or p_home_score < 0 or p_away_score < 0 then
    raise exception 'Score invalide';
  end if;

  insert into public.bets (user_id, match_id, home, away, home_score, away_score, stage, locked)
  values (p_user_id, p_match_id, p_home, p_away, p_home_score, p_away_score, p_stage, false)
  on conflict (user_id, match_id) do update
    set home_score = excluded.home_score,
        away_score = excluded.away_score,
        home       = excluded.home,
        away       = excluded.away,
        stage      = excluded.stage;
end;
$$;

grant execute on function public.admin_set_bet(uuid, text, text, text, int, int, text) to authenticated;
