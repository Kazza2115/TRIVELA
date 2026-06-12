-- TRIVELA — Analytics « maison » : clics, pages vues, rétention
-- À coller dans Supabase → SQL Editor → Run. Idempotent.
--
-- Copie brute des évènements envoyés depuis le front (en parallèle de PostHog).
-- Les visiteurs NON connectés sont aussi enregistrés (clics + rétention) : l'insert
-- est autorisé pour tout le monde, mais la LECTURE est refusée côté client —
-- tu consultes les données depuis le dashboard Supabase (rôle service, ignore RLS).

create table if not exists analytics_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  event       text        not null,                 -- '$pageview', 'nav_click', 'chat_open', ...
  distinct_id text        not null,                 -- user.id si connecté, sinon id anonyme stable
  user_id     uuid,                                 -- non-null seulement si connecté (pas de FK : on garde les events anonymes)
  session_id  text,                                 -- id de session (par onglet)
  path        text,                                 -- section / page courante
  referrer    text,
  properties  jsonb       not null default '{}'::jsonb
);

-- Index pour les requêtes de rétention et d'usage par feature
create index if not exists analytics_events_distinct_day_idx on analytics_events (distinct_id, created_at);
create index if not exists analytics_events_event_idx        on analytics_events (event);
create index if not exists analytics_events_created_idx       on analytics_events (created_at);

alter table analytics_events enable row level security;

-- Écriture : tout le monde (y compris anon) peut envoyer un évènement.
drop policy if exists analytics_events_insert on analytics_events;
create policy analytics_events_insert on analytics_events for insert with check (true);

-- Lecture : AUCUNE policy → refusée pour anon/authenticated. Seul le dashboard
-- (rôle service) peut lire. (Les données analytics ne doivent pas fuiter au front.)

-- ── Exemples de requêtes (à lancer dans le SQL Editor) ──────────────────────
--
-- Usage par feature (clics) sur 30 jours :
--   select event, count(*) as hits, count(distinct distinct_id) as users
--   from analytics_events
--   where created_at > now() - interval '30 days'
--   group by event order by hits desc;
--
-- Pages les plus vues :
--   select path, count(*) as views, count(distinct distinct_id) as users
--   from analytics_events
--   where event = '$pageview' and created_at > now() - interval '30 days'
--   group by path order by views desc;
--
-- Utilisateurs actifs par jour (DAU) :
--   select date_trunc('day', created_at) as day, count(distinct distinct_id) as dau
--   from analytics_events group by 1 order by 1;
--
-- Rétention J+1 (revenus le lendemain de leur 1re visite) :
--   with first_seen as (
--     select distinct_id, min(created_at)::date as d0 from analytics_events group by 1
--   ),
--   activity as (
--     select distinct distinct_id, created_at::date as d from analytics_events
--   )
--   select f.d0,
--          count(distinct f.distinct_id)                                    as cohort,
--          count(distinct a.distinct_id) filter (where a.d = f.d0 + 1)      as retained_d1,
--          round(100.0 * count(distinct a.distinct_id) filter (where a.d = f.d0 + 1)
--                / nullif(count(distinct f.distinct_id), 0), 1)             as pct_d1
--   from first_seen f
--   left join activity a on a.distinct_id = f.distinct_id
--   group by f.d0 order by f.d0;
