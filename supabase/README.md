# Supabase Security Fix

Supabase reported `rls_disabled_in_public`, which means the `public.leaderboard` table can be accessed through the Data API without row-level protection.

For this project, the frontend should talk only to the FastAPI backend, and the backend should talk to Supabase with a server-side key.

## What to do

1. Open the Supabase SQL Editor for the `live-puzzle-db` project.
2. Run [`leaderboard_security.sql`](./leaderboard_security.sql).
3. In Render, store the backend key as `SUPABASE_SERVICE_ROLE_KEY`.
4. Keep that key out of the frontend and out of Vercel env vars.

## Why this is safe

- The browser no longer needs direct table access.
- RLS blocks `anon` and `authenticated` access on `public.leaderboard`.
- The backend can still read and write because the Supabase service role bypasses RLS on the server.
