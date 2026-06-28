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

-- ── Tour des 32 — slots = positions du TABLEAU officiel FIFA (pas l'ordre des horaires) ──
-- L'arbre de l'app appaire r32-1&r32-2 → r16-1, r32-3&r32-4 → r16-2, etc. ; on place donc
-- chaque affiche dans son vrai créneau de bracket pour que les chemins 8es/quarts/demies
-- soient corrects. (No de match FIFA en commentaire.)
insert into public.knockout_teams (match_id, home_short, away_short, source, updated_at) values
  ('r32-1',  'GER', 'PAR', 'api', now()),   -- M74  Allemagne — Paraguay
  ('r32-2',  'FRA', 'SWE', 'api', now()),   -- M77  France — Suède
  ('r32-3',  'ZAF', 'CAN', 'api', now()),   -- M73  Afrique du Sud — Canada
  ('r32-4',  'NED', 'MAR', 'api', now()),   -- M75  Pays-Bas — Maroc
  ('r32-5',  'POR', 'CRO', 'api', now()),   -- M83  Portugal — Croatie
  ('r32-6',  'ESP', 'AUT', 'api', now()),   -- M84  Espagne — Autriche
  ('r32-7',  'USA', 'BIH', 'api', now()),   -- M81  États-Unis — Bosnie-Herzégovine
  ('r32-8',  'BEL', 'SEN', 'api', now()),   -- M82  Belgique — Sénégal
  ('r32-9',  'BRA', 'JPN', 'api', now()),   -- M76  Brésil — Japon
  ('r32-10', 'CIV', 'NOR', 'api', now()),   -- M78  Côte d'Ivoire — Norvège
  ('r32-11', 'MEX', 'ECU', 'api', now()),   -- M79  Mexique — Équateur
  ('r32-12', 'ENG', 'COD', 'api', now()),   -- M80  Angleterre — RD Congo
  ('r32-13', 'ARG', 'CPV', 'api', now()),   -- M86  Argentine — Cap-Vert
  ('r32-14', 'AUS', 'EGY', 'api', now()),   -- M88  Australie — Égypte
  ('r32-15', 'SUI', 'DZA', 'api', now()),   -- M85  Suisse — Algérie
  ('r32-16', 'COL', 'GHA', 'api', now())    -- M87  Colombie — Ghana
on conflict (match_id) do update
  set home_short = excluded.home_short,
      away_short = excluded.away_short,
      source     = excluded.source,
      updated_at = excluded.updated_at
  -- Ne JAMAIS écraser un choix manuel posé depuis l'admin.
  where public.knockout_teams.source <> 'admin';
