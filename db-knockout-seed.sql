-- TRIVELA — Bracket éliminatoire : création de la table + pré-remplissage du Tour des 32.
-- À COLLER UNE SEULE FOIS dans Supabase → SQL Editor. Idempotent (réexécutable sans risque).
--
-- Pourquoi ce fichier : la table knockout_teams n'existait pas encore en prod (le worker
-- ne pouvait donc pas remplir le bracket). Ce script la crée ET y injecte les 16 affiches
-- du Tour des 32, telles que déterminées par l'API-Football à l'issue de la phase de groupes.
--
-- Source des affiches : API-Football (source 'api') — le worker continuera de tenir le
-- bracket à jour tout seul pour les tours suivants (8es, quarts, demies, finale) au fil
-- des qualifications. Un choix manuel via l'admin (source 'admin') reste prioritaire.

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

-- ── Tour des 32 (28 juin – 4 juil) — affiches réelles issues de la phase de groupes ──
insert into public.knockout_teams (match_id, home_short, away_short, source, updated_at) values
  ('r32-1',  'ZAF', 'CAN', 'api', now()),   -- Afrique du Sud — Canada
  ('r32-2',  'BRA', 'JPN', 'api', now()),   -- Brésil — Japon
  ('r32-3',  'GER', 'PAR', 'api', now()),   -- Allemagne — Paraguay
  ('r32-4',  'NED', 'MAR', 'api', now()),   -- Pays-Bas — Maroc
  ('r32-5',  'CIV', 'NOR', 'api', now()),   -- Côte d'Ivoire — Norvège
  ('r32-6',  'FRA', 'SWE', 'api', now()),   -- France — Suède
  ('r32-7',  'MEX', 'ECU', 'api', now()),   -- Mexique — Équateur
  ('r32-8',  'ENG', 'COD', 'api', now()),   -- Angleterre — RD Congo
  ('r32-9',  'BEL', 'SEN', 'api', now()),   -- Belgique — Sénégal
  ('r32-10', 'USA', 'BIH', 'api', now()),   -- États-Unis — Bosnie-Herzégovine
  ('r32-11', 'ESP', 'AUT', 'api', now()),   -- Espagne — Autriche
  ('r32-12', 'POR', 'CRO', 'api', now()),   -- Portugal — Croatie
  ('r32-13', 'SUI', 'DZA', 'api', now()),   -- Suisse — Algérie
  ('r32-14', 'AUS', 'EGY', 'api', now()),   -- Australie — Égypte
  ('r32-15', 'ARG', 'CPV', 'api', now()),   -- Argentine — Cap-Vert
  ('r32-16', 'COL', 'GHA', 'api', now())    -- Colombie — Ghana
on conflict (match_id) do update
  set home_short = excluded.home_short,
      away_short = excluded.away_short,
      source     = excluded.source,
      updated_at = excluded.updated_at
  -- Ne JAMAIS écraser un choix manuel posé depuis l'admin.
  where public.knockout_teams.source <> 'admin';
