-- TRIVELA — Statistiques admin (agrégats analytics, réservés aux administrateurs)
-- À coller dans Supabase → SQL Editor → Run. Idempotent.
--
-- Expose UNE fonction admin_stats() (security definer) qui agrège analytics_events
-- + profiles + bets et renvoie un seul objet jsonb. L'accès est refusé à tout joueur
-- non-admin (vérif is_admin()). La table analytics_events garde sa RLS « lecture
-- interdite au client » : seules les RPC security definer peuvent l'agréger.
--
-- Pré-requis : db-admin.sql (fonction is_admin) et db-analytics.sql (table). Par
-- sécurité, on (re)crée la table analytics_events ici si elle manque (idempotent).

-- ── Filet : garantit l'existence de analytics_events (cf. db-analytics.sql) ──
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

-- ── admin_stats() — tout l'overview en un seul appel (réservé aux admins) ─────
create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;

  select jsonb_build_object(
    'generated_at',   now(),
    'players',        (select count(*) from profiles),
    'bets',           (select count(*) from bets),
    'events_total',   (select count(*) from analytics_events),
    'visitors_total', (select count(distinct distinct_id) from analytics_events),
    'visitors_7d',    (select count(distinct distinct_id) from analytics_events where created_at > now() - interval '7 days'),
    'visitors_30d',   (select count(distinct distinct_id) from analytics_events where created_at > now() - interval '30 days'),
    'active_today',   (select count(distinct distinct_id) from analytics_events where created_at::date = now()::date),
    'registered_30d', (select count(distinct user_id) from analytics_events where user_id is not null and created_at > now() - interval '30 days'),

    'dau', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'visitors', visitors) order by day), '[]'::jsonb)
      from (
        select created_at::date as day, count(distinct distinct_id) as visitors
        from analytics_events
        where created_at > now() - interval '14 days'
        group by 1
      ) d
    ),

    'top_pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', views, 'visitors', visitors) order by views desc), '[]'::jsonb)
      from (
        select coalesce(path, '(inconnu)') as path, count(*) as views, count(distinct distinct_id) as visitors
        from analytics_events
        where event = '$pageview' and created_at > now() - interval '30 days'
        group by 1 order by views desc limit 10
      ) p
    ),

    'top_events', (
      select coalesce(jsonb_agg(jsonb_build_object('event', event, 'hits', hits, 'users', users) order by hits desc), '[]'::jsonb)
      from (
        select event, count(*) as hits, count(distinct distinct_id) as users
        from analytics_events
        where created_at > now() - interval '30 days'
        group by 1 order by hits desc limit 12
      ) e
    ),

    'retention_d1', (
      with first_seen as (
        select distinct_id, min(created_at)::date as d0 from analytics_events group by 1
      ),
      activity as (
        select distinct distinct_id, created_at::date as d from analytics_events
      )
      select round(100.0 * count(distinct a.distinct_id) filter (where a.d = f.d0 + 1)
             / nullif(count(distinct f.distinct_id), 0), 1)
      from first_seen f
      left join activity a on a.distinct_id = f.distinct_id
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_stats() to authenticated;
