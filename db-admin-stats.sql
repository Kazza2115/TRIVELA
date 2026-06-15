-- TRIVELA — Statistiques admin (agrégats analytics, réservés aux administrateurs)
-- À coller dans Supabase → SQL Editor → Run. Idempotent.
--
-- admin_stats(p_days, p_bucket) — security definer, réservé aux admins (is_admin()).
--   • p_days   : fenêtre d'analyse en jours (7, 30, 90, 365…). Défaut 30.
--   • p_bucket : 'day' ou 'week' → granularité de la série temporelle. Défaut 'day'.
-- Renvoie un objet jsonb : KPIs globaux + KPIs sur la fenêtre + série temporelle
-- (visiteurs & actions par jour/semaine) + top pages + top features + rétention.
--
-- Pré-requis : db-admin.sql (is_admin). La table analytics_events est (re)créée ici
-- au besoin (idempotent), comme dans db-analytics.sql.

-- ── Filet : garantit l'existence de analytics_events ─────────────────────────
create table if not exists analytics_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  event       text        not null,
  distinct_id text        not null,
  user_id     uuid,
  session_id  text,
  path        text,
  referrer    text,
  properties  jsonb       not null default '{}'::jsonb
);
create index if not exists analytics_events_distinct_day_idx on analytics_events (distinct_id, created_at);
create index if not exists analytics_events_event_idx        on analytics_events (event);
create index if not exists analytics_events_created_idx       on analytics_events (created_at);
alter table analytics_events enable row level security;
drop policy if exists analytics_events_insert on analytics_events;
create policy analytics_events_insert on analytics_events for insert with check (true);

-- On remplace l'ancienne version sans argument par la version paramétrée.
drop function if exists public.admin_stats();

create or replace function public.admin_stats(p_days int default 30, p_bucket text default 'day')
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result   jsonb;
  v_bucket text        := case when lower(coalesce(p_bucket, 'day')) = 'week' then 'week' else 'day' end;
  v_days   int         := greatest(1, least(coalesce(p_days, 30), 730));
  v_since  timestamptz := now() - make_interval(days => v_days);
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'days',   v_days,
    'bucket', v_bucket,

    -- ── KPIs globaux (tout l'historique) ──
    'players',        (select count(*) from profiles),
    'bets',           (select count(*) from bets),
    'events_total',   (select count(*) from analytics_events),
    'visitors_total', (select count(distinct distinct_id) from analytics_events),
    'active_today',   (select count(distinct distinct_id) from analytics_events where created_at::date = now()::date),

    -- ── KPIs sur la fenêtre sélectionnée ──
    'visitors_window',   (select count(distinct distinct_id) from analytics_events where created_at >= v_since),
    'sessions_window',   (select count(distinct session_id)  from analytics_events where created_at >= v_since and session_id is not null),
    'events_window',     (select count(*)                    from analytics_events where created_at >= v_since),
    'registered_window', (select count(distinct user_id)     from analytics_events where user_id is not null and created_at >= v_since),
    'bets_window',       (select count(*)                    from bets where created_at >= v_since),

    -- ── Série temporelle (visiteurs & actions par jour/semaine) ──
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket',   to_char(b, 'YYYY-MM-DD'),
        'visitors', visitors,
        'events',   events
      ) order by b), '[]'::jsonb)
      from (
        select date_trunc(v_bucket, created_at)::date as b,
               count(distinct distinct_id)            as visitors,
               count(*)                               as events
        from analytics_events
        where created_at >= v_since
        group by 1
      ) s
    ),

    -- ── Top pages (fenêtre) ──
    'top_pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', views, 'visitors', visitors) order by views desc), '[]'::jsonb)
      from (
        select coalesce(path, '(inconnu)') as path, count(*) as views, count(distinct distinct_id) as visitors
        from analytics_events
        where event = '$pageview' and created_at >= v_since
        group by 1 order by views desc limit 12
      ) p
    ),

    -- ── Top features / évènements (fenêtre) ──
    'top_events', (
      select coalesce(jsonb_agg(jsonb_build_object('event', event, 'hits', hits, 'users', users) order by hits desc), '[]'::jsonb)
      from (
        select event, count(*) as hits, count(distinct distinct_id) as users
        from analytics_events
        where created_at >= v_since
        group by 1 order by hits desc limit 15
      ) e
    ),

    -- ── Temps passé par page / section (fenêtre) ──
    'time_by_page', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'section', section, 'views', views, 'avg_seconds', avg_seconds, 'total_seconds', total_seconds
      ) order by total_seconds desc), '[]'::jsonb)
      from (
        select coalesce(properties->>'section', '(inconnu)')    as section,
               count(*)                                          as views,
               round(avg((properties->>'seconds')::numeric))::int as avg_seconds,
               sum((properties->>'seconds')::int)                as total_seconds
        from analytics_events
        where event = 'page_time' and created_at >= v_since
          and (properties->>'seconds') ~ '^[0-9]+$'
        group by 1 order by total_seconds desc limit 12
      ) t
    ),

    -- ── Temps moyen par page vue (fenêtre, en secondes) ──
    'avg_visit_seconds', (
      select coalesce(round(avg((properties->>'seconds')::numeric))::int, 0)
      from analytics_events
      where event = 'page_time' and created_at >= v_since
        and (properties->>'seconds') ~ '^[0-9]+$'
    ),

    -- ── Clics les plus fréquents (fenêtre) ──
    'top_clicks', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'clicks', clicks, 'users', users) order by clicks desc), '[]'::jsonb)
      from (
        select coalesce(properties->>'label', '(sans texte)') as label,
               count(*)                                        as clicks,
               count(distinct distinct_id)                     as users
        from analytics_events
        where event = 'click' and created_at >= v_since
        group by 1 order by clicks desc limit 15
      ) c
    ),

    -- ── Nouveaux visiteurs (toute 1re visite dans la fenêtre) ──
    'new_visitors_window', (
      select count(*) from (
        select distinct_id from analytics_events group by distinct_id having min(created_at) >= v_since
      ) x
    ),

    -- ── Activité par heure (heure de Genève, fenêtre) ──
    'activity_by_hour', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', hour, 'visitors', visitors) order by hour), '[]'::jsonb)
      from (
        select extract(hour from created_at at time zone 'Europe/Zurich')::int as hour,
               count(distinct distinct_id) as visitors
        from analytics_events
        where created_at >= v_since
        group by 1
      ) h
    ),

    -- ── Répartition des joueurs (inscrits) par pays ──
    'top_countries', (
      select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'players', players) order by players desc), '[]'::jsonb)
      from (
        select country_code as code, max(country_name) as name, count(*) as players
        from profiles
        where country_code is not null and country_code <> ''
        group by country_code order by players desc limit 12
      ) c
    ),

    -- ── Rétention J+1 / J+7 / J+30 (global ; dénominateur = cohortes assez anciennes) ──
    'retention', (
      with first_seen as (select distinct_id, min(created_at)::date as d0 from analytics_events group by 1),
           activity   as (select distinct distinct_id, created_at::date as d from analytics_events)
      select jsonb_build_object(
        'd1',  round(100.0 * count(distinct a.distinct_id) filter (where a.d = f.d0 + 1)  / nullif(count(distinct f.distinct_id) filter (where f.d0 <= current_date - 1), 0), 1),
        'd7',  round(100.0 * count(distinct a.distinct_id) filter (where a.d = f.d0 + 7)  / nullif(count(distinct f.distinct_id) filter (where f.d0 <= current_date - 7), 0), 1),
        'd30', round(100.0 * count(distinct a.distinct_id) filter (where a.d = f.d0 + 30) / nullif(count(distinct f.distinct_id) filter (where f.d0 <= current_date - 30), 0), 1)
      )
      from first_seen f
      left join activity a on a.distinct_id = f.distinct_id
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_stats(int, text) to authenticated;
