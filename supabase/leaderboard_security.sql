-- Run this in the Supabase SQL Editor for the `live-puzzle-db` project.
-- Goal: keep the leaderboard accessible only through your backend service role.

alter table public.leaderboard enable row level security;

revoke all on table public.leaderboard from anon;
revoke all on table public.leaderboard from authenticated;

-- Optional defense-in-depth. Keep reads and writes routed through the backend only.
drop policy if exists "Public can read leaderboard" on public.leaderboard;
drop policy if exists "Public can insert leaderboard" on public.leaderboard;
drop policy if exists "Authenticated can read leaderboard" on public.leaderboard;
drop policy if exists "Authenticated can insert leaderboard" on public.leaderboard;

comment on table public.leaderboard is
'Leaderboard is protected by RLS. Public clients must use the backend API instead of direct table access.';
