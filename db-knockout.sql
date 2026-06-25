-- TRIVELA — Affectations d'équipes pour les phases éliminatoires (bracket).
-- À COLLER UNE SEULE FOIS dans Supabase → SQL Editor. Idempotent.
--
-- Une fois la table créée :
--   • le worker la remplit TOUT SEUL depuis l'API au fil des qualifications (source 'api') ;
--   • l'éditeur admin (menu Admin → « Composer le bracket ») permet de fixer/corriger
--     une affiche à la main (source 'admin', prioritaire : jamais écrasée par l'API).
-- Aucune autre manipulation SQL n'est nécessaire ensuite.

create table if not exists public.knockout_teams (
  match_id   text primary key,                 -- r32-1, r16-1, qf-1, sf-1, 3rd, final
  home_short text,                              -- code court (ex. 'ZAF') ou null
  away_short text,                              -- code court (ex. 'CAN') ou null
  source     text not null default 'admin',    -- 'api' (auto) | 'admin' (manuel, prioritaire)
  updated_at timestamptz not null default now()
);

alter table public.knockout_teams enable row level security;

-- Lecture publique : tout le monde voit le bracket rempli.
drop policy if exists knockout_read on public.knockout_teams;
create policy knockout_read on public.knockout_teams for select using (true);

-- Aucune policy d'écriture pour anon/authenticated : RLS bloque toute écriture côté
-- client. Les écritures passent par le worker (clé service role, qui contourne RLS).
