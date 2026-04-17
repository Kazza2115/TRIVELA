-- ─── TRIVELA – Supabase schema ───────────────────────────────────────────────
-- Run this in the Supabase SQL Editor after creating your project.
-- Tables: profiles (public user info) + bets (pronostics)

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  pseudo       text        unique not null,
  country_code text        not null,
  country_name text        not null,
  score        int         not null default 0,
  created_at   timestamptz not null default now()
);

alter table profiles enable row level security;

-- Anyone can read the leaderboard
create policy "profiles_select_all" on profiles
  for select using (true);

-- Only the owner can update their own row
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Insert allowed during registration (service role handles it via trigger or from client)
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

-- ── bets ─────────────────────────────────────────────────────────────────────
create table if not exists bets (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  match_id    text        not null,
  home        text        not null,
  away        text        not null,
  home_score  int         not null,
  away_score  int         not null,
  stage       text        not null,
  created_at  timestamptz not null default now(),
  unique(user_id, match_id)
);

alter table bets enable row level security;

-- Users can only see/write their own bets
create policy "bets_select_own" on bets
  for select using (auth.uid() = user_id);

create policy "bets_insert_own" on bets
  for insert with check (auth.uid() = user_id);

create policy "bets_update_own" on bets
  for update using (auth.uid() = user_id);
