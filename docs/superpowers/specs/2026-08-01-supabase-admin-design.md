# Supabase-backed submissions + admin dashboard

## Context

The KidsPreneur Strength Assessment (`assessment-src/`, deployed to `assessment/`) currently tries to
submit each completed quiz directly to a Google Apps Script web app, which writes a row into a Google
Sheet. That deployment is broken (`SpreadsheetApp.getActiveSpreadsheet()` returns `null` because the
script isn't bound to a sheet), and there's no way to see submissions short of opening the sheet by hand
anyway.

Decision: replace the Google Sheets pipeline with Supabase (Postgres + hosted REST/RPC), and add a
password-gated `/admin` page to the marketing site so submissions can be reviewed without touching a
spreadsheet.

Supabase project already exists:
- URL: `https://ygenpyaqswifjqvrpjqo.supabase.co`
- Anon key: provided by the user (safe to embed client-side; grants only what RLS allows)

## Architecture

Two independently-built static outputs, following the existing `assessment-src/` → `assessment/`
pattern:

1. **`assessment-src/`** (existing Vite/React quiz) — `submit()` in `src/main.jsx` stops POSTing to the
   Apps Script webhook and instead inserts a row into Supabase via `@supabase/supabase-js`.
2. **New `admin-src/index.html`** — a single hand-written static page, no build step (matches how the
   main marketing site itself is built: flat HTML/JS, no bundler). Deployed to `Kidspreneur Website/admin/`.
   Loads `@supabase/supabase-js` from a CDN `<script>` tag rather than via npm, since there's no build
   pipeline for this page.

No custom server of our own is added (no Node/Express, no Cloudflare Worker) — both pieces are static
files talking directly to Supabase's hosted API over HTTPS, the same shape of integration the assessment
already has with Google Apps Script today. The password check itself does run server-side, but as a
Postgres function inside the existing Supabase project, not a service we host or maintain.

## Data flow: submission → storage → admin read

### Submission (write path)

`assessment-src/src/main.jsx`'s `submit()`:
1. Builds the same `payload` object it builds today (participant code, nickname, age, AI-usage context,
   per-question answers, aggregate scores, core/support/growth strength names, chosen challenge + written
   solution).
2. Calls `supabase.from('submissions').insert({...columns})` (client initialized with the project URL +
   anon key).
3. On a unique-constraint violation on `participant_code` (Postgres error code `23505`), treat it the same
   way the old `duplicate_code` response was treated: fall through to the existing `localStorage` fallback
   and `savedToServer=false` notice — no new UI state needed.
4. On any other failure (network, etc.), same existing fallback: write to `localStorage`, show the
   "hasil belum tersimpan ke server" notice, still advance to the Result screen.

This preserves the exact UX already built and verified (see 2025-07/2026-07-31 session): silent-failure
protection stays, just the write target changes.

### Admin read path — the password gate

There is no server to hold a secret, so the check cannot happen in browser JS (anyone could read the
anon key and the "correct" password out of the shipped bundle and call the REST API directly). Instead,
the check happens **inside Postgres**:

- `submissions` table: Row Level Security enabled.
  - Policy: `anon` role may `INSERT`. No `SELECT`/`UPDATE`/`DELETE` policy exists for `anon` — direct reads
    via the REST API return nothing, even with the anon key.
- `admin_secret` table: one row, one column (`password_hash`). RLS enabled with **zero** policies — no
  role can read or write it via the REST API at all. Only reachable from inside a `SECURITY DEFINER`
  Postgres function (which runs with the privileges of the function's owner, bypassing RLS for its own
  queries).
- `get_submissions(admin_password text)` — a Postgres function, `SECURITY DEFINER`:
  1. Hashes `admin_password` with `pgcrypto`'s `crypt()` and compares it against the stored
     `password_hash` in `admin_secret`.
  2. Returns all rows from `submissions` (ordered newest-first) only if the hash matches; otherwise
     returns an empty set.
- The admin page calls `supabase.rpc('get_submissions', { admin_password })`. Right password → rows.
  Wrong password → empty array, indistinguishable at the network layer from "no submissions yet" (no
  information leak about whether the password was close).

On successful auth, the entered password is cached in `sessionStorage` (cleared when the tab closes) so
refreshing the admin page during the same session doesn't require re-entering it. Every actual data
fetch still re-calls the RPC with that cached password — there is no separate "session token"; the
password itself, re-verified server-side on each call, is the only credential.

Rotating the password later is one `UPDATE admin_secret SET password_hash = crypt('new-password',
gen_salt('bf'))` statement in the Supabase SQL editor — no code or redeploy needed.

## Schema

```sql
create extension if not exists pgcrypto;

create table submissions (
  id bigint generated always as identity primary key,
  participant_code text unique not null,
  submitted_at timestamptz not null default now(),
  nickname text not null,
  age int not null,
  ai_frequency text,
  ai_tools text[],
  experiences text[],
  creative_score int not null,
  communicator_score int not null,
  integrator_score int not null,
  explorer_score int not null,
  core_strength text not null,
  supporting_strength text not null,
  next_skill text not null,
  scenario text,              -- which creative challenge was chosen
  challenge_problem text,
  challenge_solution text,
  answers jsonb not null       -- full per-question answer detail, same shape as today's sheet blob
);

alter table submissions enable row level security;
create policy "anon can insert" on submissions for insert to anon with check (true);
-- deliberately no select/update/delete policy for anon or authenticated

create table admin_secret (
  id int primary key default 1,
  password_hash text not null,
  constraint single_row check (id = 1)
);
alter table admin_secret enable row level security;
-- deliberately zero policies: no role can read/write this table via the REST API

create or replace function get_submissions(admin_password text)
returns setof submissions
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from admin_secret
    where password_hash = crypt(admin_password, password_hash)
  ) then
    return query select * from submissions order by submitted_at desc;
  end if;
  return;
end;
$$;
```

The initial `password_hash` row is inserted once, by hand, in the Supabase SQL editor:
`insert into admin_secret (id, password_hash) values (1, crypt('<the shared password>', gen_salt('bf')));`
— the plaintext password is never written to any file in this repo.

## Admin UI (`admin-src/index.html` → `admin/`)

Single static page, styled with the same brand tokens as the main site (Poppins/Nunito, `#2563EB`/
`#1BA84A`/`#F6A821`/`#7C5CE6`, same card/button conventions) so it doesn't look like a bolted-on tool.

- **Password form**: one input + submit. On submit, calls the RPC; empty result with no thrown error is
  treated as "wrong password" (shows an inline error) since the function can't distinguish "wrong
  password" from "no rows yet" — acceptable for a single-admin internal tool.
- **Table** (shown after successful auth): columns — Submitted At, Nickname, Age, Core Strength,
  Supporting Strength, Next Skill to Grow, the 4 dimension scores, AI usage frequency. Sorted
  newest-first (already sorted by the RPC).
- **Expandable row detail**: clicking a row reveals the chosen challenge, the child's written solution,
  AI tools/experiences multi-select answers, and the raw 12-question answer detail — kept collapsed by
  default to keep the table scannable.
- No pagination in v1 (submission volume is expected to be low for a pre-class assessment); can be added
  later if needed.
- A small back-link to the marketing homepage (`../`), consistent with the assessment page's own
  back-link.

## Migration from the old Sheets pipeline

- `assessment-src/src/main.jsx`: replace the `fetch(endpoint, ...)` block in `submit()` with a Supabase
  insert; remove the `text/plain` CORS workaround (no longer needed — Supabase's REST API handles CORS
  correctly for browser clients).
- `assessment-src/.env` / `.env.example`: replace `VITE_SHEETS_WEBHOOK_URL` with `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`.
- `assessment-src/package.json`: add `@supabase/supabase-js` as a pinned dependency.
- `assessment-src/google-apps-script.gs`: delete — no longer part of the architecture. (The Google Sheet
  itself is left alone; the user can keep or discard it independently of this repo.)

## Error handling

- Insert failure (network, RLS misconfiguration, etc.) → existing `localStorage` fallback +
  "hasil belum tersimpan ke server" notice, same as today. No new failure states introduced on the quiz
  side.
- Admin wrong password → inline "Password salah atau belum ada data." message, no distinction from
  empty-table (deliberate, avoids leaking whether a password attempt was close).
- Admin RPC network failure → inline generic error with a retry button.

## Testing / verification plan

1. Run the SQL above in the Supabase SQL editor; confirm `submissions`, `admin_secret`, and
   `get_submissions` exist as expected via the Supabase dashboard.
2. Insert the real admin password hash by hand (not committed anywhere).
3. Rebuild `assessment-src` with the new Supabase env vars; complete a full quiz run in the browser;
   confirm a row appears in `submissions` via the Supabase dashboard table view.
4. Attempt a second submission with the same identity flow twice in a row (or manually replay a POST)
   to confirm the `participant_code` unique constraint triggers the existing fallback path correctly.
5. Open `/admin`, try a wrong password (expect the inline error, confirm via Network tab that no row
   data was returned), then the correct password (expect the table to populate).
6. Confirm `sessionStorage` caches the password within a tab (refresh `/admin` without re-entering it)
   and that a new tab / after closing the browser requires re-entry.
7. Expand a table row and confirm the full challenge solution and raw answers render correctly.

## Out of scope (v1)

- Multiple admin accounts / per-user login (only one shared password requested).
- Pagination, filtering, CSV export, or charts on the admin page.
- Editing or deleting submissions from the admin UI (read-only).
