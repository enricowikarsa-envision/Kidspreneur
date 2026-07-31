# Supabase Submissions + Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken Google Sheets submission pipeline with Supabase, and add a password-gated `/admin` page that lists all assessment submissions.

**Architecture:** `assessment-src/` (the quiz) writes rows straight to a Supabase Postgres table via `@supabase/supabase-js`, with Row Level Security allowing inserts but no reads for the public `anon` key. A new `admin-src/index.html` (hand-written static page, no build step, matching how the marketing site itself is built) reads submissions through a `SECURITY DEFINER` Postgres function that only returns rows when the caller supplies the correct password — the password check happens inside Postgres, never in shipped JS.

**Tech Stack:** Supabase (Postgres + hosted REST/RPC + `@supabase/supabase-js` client), Vite/React (existing `assessment-src/`), plain HTML/CSS/JS for the admin page (existing pattern for the marketing site — no bundler).

**Note on verification steps in this plan:** neither `assessment-src/` nor the marketing site has a test framework (no Jest/Vitest, no linter — confirmed by inspecting `package.json`). Rather than bolting one on for a two-file feature, every task's verification step is a concrete, runnable check: a `curl` command against the real Supabase REST API, or a manual browser walkthrough with exact clicks and expected results — the same style already used and proven out earlier in this project (see the `assessment/` build verification).

---

### Task 0 (optional): Initialize git

**Files:**
- Create: `.gitignore` (repo root, if not already covering everything needed)

This project currently has no git repository, which means none of this session's changes have any history or easy rollback path. This task is optional — skip it and skip the "Commit" steps in every later task if you'd rather not use git yet.

- [ ] **Step 1: Check current `.gitignore` coverage**

Run: `cat "/Users/enricoai/Kidspreneur Website/assessment-src/.gitignore"`
Expected: shows `node_modules/`, `dist/`, `.env`, etc. (already exists from the original assessment source).

- [ ] **Step 2: Initialize the repo at the project root**

Run:
```bash
cd "/Users/enricoai/Kidspreneur Website"
git init
```
Expected: `Initialized empty Git repository in /Users/enricoai/Kidspreneur Website/.git/`

- [ ] **Step 3: Add a root `.gitignore` covering both sub-apps**

Create `/Users/enricoai/Kidspreneur Website/.gitignore`:
```
assessment-src/node_modules/
assessment-src/dist/
assessment-src/.env
.DS_Store
Updated assets/
```

- [ ] **Step 4: Initial commit of existing state**

Run:
```bash
cd "/Users/enricoai/Kidspreneur Website"
git add -A
git commit -m "chore: initial commit of existing site + assessment"
```
Expected: a commit succeeds listing the marketing site, `assessment-src/`, and the built `assessment/`.

---

### Task 1: Supabase database schema

**Files:**
- Create: `supabase/schema.sql`

This task is partly manual — there is no tool access to run arbitrary SQL against the user's Supabase project, so the SQL must be run by hand in the Supabase dashboard's SQL Editor.

- [ ] **Step 1: Write the schema file to the repo**

Create `/Users/enricoai/Kidspreneur Website/supabase/schema.sql`:
```sql
-- Run this entire file in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ygenpyaqswifjqvrpjqo/sql/new

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
  scenario text,
  challenge_problem text,
  challenge_solution text,
  answers jsonb not null
);

alter table submissions enable row level security;

create policy "anon can insert submissions"
  on submissions for insert
  to anon
  with check (true);
-- Deliberately no select/update/delete policy for anon or authenticated:
-- this table cannot be read through the REST API at all, except via
-- the get_submissions() function below.

create table admin_secret (
  id int primary key default 1,
  password_hash text not null,
  constraint single_row check (id = 1)
);

alter table admin_secret enable row level security;
-- Deliberately zero policies: no role can read or write this table
-- via the REST API under any circumstances.

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

grant execute on function get_submissions(text) to anon;
```

- [ ] **Step 2: Run `schema.sql` in the Supabase SQL Editor**

Open https://supabase.com/dashboard/project/ygenpyaqswifjqvrpjqo/sql/new, paste the full contents of `supabase/schema.sql`, and run it.
Expected: "Success. No rows returned."

- [ ] **Step 3: Set the real admin password (do this yourself, separately — don't put the plaintext password in any file or chat message)**

In the same SQL Editor, run (substituting your own password for `CHANGE_ME`):
```sql
insert into admin_secret (id, password_hash)
values (1, crypt('CHANGE_ME', gen_salt('bf')));
```
Expected: "Success. 1 row affected."

- [ ] **Step 4: Verify the table exists and is unreadable by the public key**

Run (using the project's anon key):
```bash
curl -s "https://ygenpyaqswifjqvrpjqo.supabase.co/rest/v1/submissions" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZW5weWFxc3dpZmpxdnJwanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDY4NjMsImV4cCI6MjEwMTA4Mjg2M30.1m5R9E2DoXYqwkBu6PxXqMG4uIcpwn13pnn4dBTeerQ"
```
Expected: `[]` (empty array) — the table exists (no error), but RLS hides every row from the anon key since there's no select policy.

- [ ] **Step 5: Verify the RPC rejects a wrong password**

Run:
```bash
curl -s -X POST "https://ygenpyaqswifjqvrpjqo.supabase.co/rest/v1/rpc/get_submissions" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZW5weWFxc3dpZmpxdnJwanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDY4NjMsImV4cCI6MjEwMTA4Mjg2M30.1m5R9E2DoXYqwkBu6PxXqMG4uIcpwn13pnn4dBTeerQ" \
  -H "Content-Type: application/json" \
  -d '{"admin_password":"definitely-wrong"}'
```
Expected: `[]` (empty array, no error) — proves the RPC exists and correctly rejects a bad password without leaking anything.

- [ ] **Step 6: Commit**

```bash
cd "/Users/enricoai/Kidspreneur Website"
git add supabase/schema.sql
git commit -m "feat: add Supabase schema for assessment submissions + admin RPC"
```

---

### Task 2: Add Supabase client to the assessment app

**Files:**
- Modify: `assessment-src/package.json`
- Create: `assessment-src/src/supabaseClient.js`
- Modify: `assessment-src/.env.example`
- Modify: `assessment-src/.env`

- [ ] **Step 1: Add the dependency to `package.json`**

In `/Users/enricoai/Kidspreneur Website/assessment-src/package.json`, change the `dependencies` block from:
```json
  "dependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
```
to:
```json
  "dependencies": {
    "@supabase/supabase-js": "2.111.0",
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
```

- [ ] **Step 2: Install it**

Run:
```bash
cd "/Users/enricoai/Kidspreneur Website/assessment-src"
npm install
```
Expected: `added N packages` with no errors, and `node_modules/@supabase/supabase-js` exists.

- [ ] **Step 3: Verify the install**

Run: `ls "/Users/enricoai/Kidspreneur Website/assessment-src/node_modules/@supabase/supabase-js/package.json"`
Expected: the file path prints (exists).

- [ ] **Step 4: Create the Supabase client module**

Create `/Users/enricoai/Kidspreneur Website/assessment-src/src/supabaseClient.js`:
```js
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

- [ ] **Step 5: Replace the env vars**

Replace the contents of `/Users/enricoai/Kidspreneur Website/assessment-src/.env.example`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Replace the contents of `/Users/enricoai/Kidspreneur Website/assessment-src/.env` (already gitignored):
```
VITE_SUPABASE_URL=https://ygenpyaqswifjqvrpjqo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZW5weWFxc3dpZmpxdnJwanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDY4NjMsImV4cCI6MjEwMTA4Mjg2M30.1m5R9E2DoXYqwkBu6PxXqMG4uIcpwn13pnn4dBTeerQ
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/enricoai/Kidspreneur Website"
git add assessment-src/package.json assessment-src/package-lock.json assessment-src/src/supabaseClient.js assessment-src/.env.example
git commit -m "feat: add Supabase client dependency to assessment app"
```
(`.env` is gitignored and won't be added — that's correct.)

---

### Task 3: Migrate `submit()` to write to Supabase

**Files:**
- Modify: `assessment-src/src/main.jsx:1` (import)
- Modify: `assessment-src/src/main.jsx:472-486` (submission logic)

- [ ] **Step 1: Import the Supabase client**

In `/Users/enricoai/Kidspreneur Website/assessment-src/src/main.jsx`, change line 1 from:
```js
import React, { useMemo, useState } from "react";
```
to:
```js
import React, { useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
```

- [ ] **Step 2: Replace the submission try/catch block**

Find this block (currently lines 472-486):
```js
    try {
      const endpoint = import.meta.env.VITE_SHEETS_WEBHOOK_URL;
      if (!endpoint) throw new Error("Submission endpoint not configured");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const resultJson = await response.json().catch(() => ({ ok: response.ok }));
      if (!response.ok || resultJson.ok === false) throw new Error(resultJson.reason || "Submission was not accepted");
      setSavedToServer(true);
    } catch (error) {
      localStorage.setItem(`kidspreneur-result-${submissionId}`, JSON.stringify(payload));
      setSavedToServer(false);
    }
```

Replace it with:
```js
    try {
      const { error } = await supabase.from("submissions").insert({
        participant_code: payload.participantCode,
        submitted_at: payload.submittedAt,
        nickname: payload.nickname,
        age: payload.age,
        ai_frequency: payload.aiFrequency,
        ai_tools: payload.aiTools,
        experiences: payload.experiences,
        creative_score: payload.scores.creative,
        communicator_score: payload.scores.communicator,
        integrator_score: payload.scores.integrator,
        explorer_score: payload.scores.explorer,
        core_strength: payload.coreStrength,
        supporting_strength: payload.supportingStrength,
        next_skill: payload.nextSkill,
        scenario: payload.scenario,
        challenge_problem: payload.challengeProblem,
        challenge_solution: payload.challengeSolution,
        answers: payload.answers
      });
      if (error) throw error;
      setSavedToServer(true);
    } catch (error) {
      localStorage.setItem(`kidspreneur-result-${submissionId}`, JSON.stringify(payload));
      setSavedToServer(false);
    }
```

This preserves the existing fallback behavior exactly: any Supabase error (including a duplicate `participant_code` unique-constraint violation) falls into the `catch` block, saves to `localStorage`, and flips `savedToServer` to `false`, which the `Result` screen already renders as "Hasil belum tersimpan ke server, tersimpan di perangkatmu."

- [ ] **Step 3: Sanity-check the diff**

Run: `grep -n "supabase\|VITE_SHEETS_WEBHOOK_URL" "/Users/enricoai/Kidspreneur Website/assessment-src/src/main.jsx"`
Expected: two `supabase` matches (the import and the `.from("submissions")` call), zero `VITE_SHEETS_WEBHOOK_URL` matches.

- [ ] **Step 4: Commit**

```bash
cd "/Users/enricoai/Kidspreneur Website"
git add assessment-src/src/main.jsx
git commit -m "feat: submit assessment results to Supabase instead of Google Sheets"
```

---

### Task 4: Remove the Google Sheets pipeline

**Files:**
- Delete: `assessment-src/google-apps-script.gs`
- Modify: `assessment-src/README.md:12-21`

- [ ] **Step 1: Delete the Apps Script file**

Run: `rm "/Users/enricoai/Kidspreneur Website/assessment-src/google-apps-script.gs"`

- [ ] **Step 2: Replace the README's backend section**

In `/Users/enricoai/Kidspreneur Website/assessment-src/README.md`, replace lines 12-21 (the `## Google Sheets connection` section) with:
```markdown
## Supabase connection

Submissions are written directly to a Supabase table from the browser (no server proxy needed —
Supabase's REST API handles CORS correctly for browser clients).

1. Create a Supabase project.
2. Run `supabase/schema.sql` (in the repo root, one level up from this folder) in the Supabase SQL Editor.
3. Set your own admin password by running the `insert into admin_secret ...` statement described in
   that file's comments — do this directly in the SQL Editor, not via any file in this repo.
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your
   project's API settings.
5. Rebuild (`npm run build`) so the new environment variables are baked into the bundle.

The admin dashboard at `/admin` (see `../admin-src/`) reads submissions back out through a
password-gated Postgres function — see `../docs/superpowers/specs/2026-08-01-supabase-admin-design.md`
for the full design.
```

- [ ] **Step 3: Verify no other references remain**

Run: `grep -rn "google-apps-script\|GOOGLE_SHEETS_WEBHOOK_URL\|Apps Script" "/Users/enricoai/Kidspreneur Website/assessment-src"`
Expected: no output (no matches).

- [ ] **Step 4: Commit**

```bash
cd "/Users/enricoai/Kidspreneur Website"
git add -A assessment-src
git commit -m "chore: remove Google Sheets pipeline, document Supabase setup"
```

---

### Task 5: Build and deploy the updated assessment app

**Files:**
- Build output: `assessment/` (regenerated from `assessment-src/dist/`)

- [ ] **Step 1: Build**

Run:
```bash
cd "/Users/enricoai/Kidspreneur Website/assessment-src"
npm run build
```
Expected: `✓ built in <time>` with no errors, producing `dist/index.html` and `dist/assets/*.js`/`*.css`.

- [ ] **Step 2: Confirm the Supabase URL is baked into the built bundle**

Run: `grep -o "ygenpyaqswifjqvrpjqo" "/Users/enricoai/Kidspreneur Website/assessment-src/dist/assets/"*.js`
Expected: at least one match (the project ref appears in the built JS).

- [ ] **Step 3: Replace the deployed copy**

Run:
```bash
rm -rf "/Users/enricoai/Kidspreneur Website/assessment"
cp -R "/Users/enricoai/Kidspreneur Website/assessment-src/dist" "/Users/enricoai/Kidspreneur Website/assessment"
```

- [ ] **Step 4: Verify the deployed files**

Run: `ls "/Users/enricoai/Kidspreneur Website/assessment"`
Expected: `assets`, `index.html`, `logo.png`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/enricoai/Kidspreneur Website"
git add assessment
git commit -m "build: redeploy assessment with Supabase submission pipeline"
```

---

### Task 6: Verify the submission pipeline end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Serve the site locally**

Use the existing `static-site` launch config (`.claude/launch.json`, already present) to serve
`Kidspreneur Website/` at `http://localhost:8777/`.

- [ ] **Step 2: Complete a full quiz run in the browser**

Navigate to `http://localhost:8777/assessment/`, click "Mulai assessment", fill in a nickname/age,
answer the context questions, answer all 12 scenario questions, pick a creative challenge, write a
solution (≥12 characters), and submit.
Expected: the Result screen appears, and — critically — **no** "Hasil belum tersimpan ke server" notice
is shown (this confirms the Supabase insert succeeded; if the notice appears, check the browser
console/network tab for the Supabase error first).

- [ ] **Step 3: Confirm the row landed in Supabase**

Run (replace `YOUR_ADMIN_PASSWORD` with the password set in Task 1, Step 3):
```bash
curl -s -X POST "https://ygenpyaqswifjqvrpjqo.supabase.co/rest/v1/rpc/get_submissions" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZW5weWFxc3dpZmpxdnJwanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDY4NjMsImV4cCI6MjEwMTA4Mjg2M30.1m5R9E2DoXYqwkBu6PxXqMG4uIcpwn13pnn4dBTeerQ" \
  -H "Content-Type: application/json" \
  -d '{"admin_password":"YOUR_ADMIN_PASSWORD"}'
```
Expected: a JSON array with at least one object, whose `nickname` matches what was entered in Step 2.

- [ ] **Step 4: Confirm the duplicate-code fallback still works**

In the browser console on the Result screen, note that resubmitting isn't directly exposed in the UI —
instead verify the constraint itself by re-running the exact same insert twice via `curl`:
```bash
curl -s -X POST "https://ygenpyaqswifjqvrpjqo.supabase.co/rest/v1/submissions" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZW5weWFxc3dpZmpxdnJwanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDY4NjMsImV4cCI6MjEwMTA4Mjg2M30.1m5R9E2DoXYqwkBu6PxXqMG4uIcpwn13pnn4dBTeerQ" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"participant_code":"TEST-DUP-001","submitted_at":"2026-08-01T00:00:00Z","nickname":"Dup","age":10,"creative_score":1,"communicator_score":1,"integrator_score":1,"explorer_score":1,"core_strength":"x","supporting_strength":"x","next_skill":"x","answers":[]}'
```
Run it a second time with the identical body.
Expected: first call returns HTTP 201 (created); second call returns HTTP 409 (conflict) due to the
`participant_code` unique constraint — confirming `main.jsx`'s `catch` block will correctly trigger for
real duplicate submissions.

- [ ] **Step 5: Clean up the test row**

In the Supabase SQL Editor: `delete from submissions where participant_code = 'TEST-DUP-001';`

---

### Task 7: Build the admin dashboard page

**Files:**
- Create: `admin-src/index.html`

- [ ] **Step 1: Create the directory and file**

Create `/Users/enricoai/Kidspreneur Website/admin-src/index.html`:
```html
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>KidsPreneur — Admin Assessment</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/png" href="../assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Nunito',system-ui,sans-serif; color:#5B6B85; background:#F6F9FE; -webkit-font-smoothing:antialiased; min-height:100vh; }
  h1,h2 { font-family:'Poppins',sans-serif; color:#0F2340; margin:0; }
  a { color:#2563EB; text-decoration:none; }
  header { background:#fff; border-bottom:1px solid #EEF2F8; padding:16px 32px; display:flex; align-items:center; justify-content:space-between; }
  header img { height:36px; }
  .back-home { font-size:13px; font-weight:700; }
  main { max-width:1200px; margin:0 auto; padding:40px 24px; }
  #login { max-width:380px; margin:60px auto; background:#fff; border:1px solid #EEF2F8; border-radius:20px; padding:34px; box-shadow:0 12px 30px rgba(15,35,64,.06); }
  #login h1 { font-size:22px; margin-bottom:8px; }
  #login p { font-size:14px; margin-bottom:20px; }
  #login input { width:100%; padding:14px 15px; border:1.5px solid #D5E0F5; border-radius:11px; font:inherit; color:#0F2340; }
  #login button { width:100%; margin-top:14px; background:#2563EB; color:#fff; font-weight:800; font-size:15px; padding:14px; border:0; border-radius:11px; cursor:pointer; box-shadow:0 12px 24px rgba(37,99,235,.28); }
  #login .error { color:#D64545; font-size:13px; font-weight:700; margin-top:12px; display:none; }
  #dashboard { display:none; }
  #dashboard h1 { font-size:26px; margin-bottom:4px; }
  #dashboard .count { color:#5B6B85; font-size:14px; margin-bottom:24px; }
  table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #EEF2F8; border-radius:14px; overflow:hidden; font-size:13px; }
  th,td { text-align:left; padding:12px 14px; border-bottom:1px solid #EEF2F8; vertical-align:top; }
  th { background:#F8FAFD; font-weight:800; color:#0F2340; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
  tr.row:hover { background:#F8FAFD; cursor:pointer; }
  tr.detail { display:none; background:#F8FAFD; }
  tr.detail.open { display:table-row; }
  tr.detail td { padding:18px; }
  .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .detail-grid h4 { font-family:'Poppins',sans-serif; color:#0F2340; font-size:12px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:6px; }
  .detail-grid p { font-size:13px; line-height:1.6; }
  pre { white-space:pre-wrap; word-break:break-word; font-size:12px; background:#fff; border:1px solid #EEF2F8; border-radius:8px; padding:10px; max-height:220px; overflow:auto; }
  .empty { padding:40px; text-align:center; color:#5B6B85; }
</style>
</head>
<body>
  <header>
    <div style="display:flex; align-items:center; gap:14px;">
      <img src="../assets/logo.png" alt="KidsPreneur">
    </div>
    <a class="back-home" href="../">← Kembali ke KidsPreneur.com</a>
  </header>
  <main>
    <div id="login">
      <h1>Admin · Strength Assessment</h1>
      <p>Masukkan password admin untuk melihat hasil assessment.</p>
      <input id="password" type="password" placeholder="Password" autocomplete="off">
      <button id="loginBtn">Masuk</button>
      <p class="error" id="loginError">Password salah atau belum ada data.</p>
    </div>
    <div id="dashboard">
      <h1>Hasil Assessment</h1>
      <p class="count" id="rowCount"></p>
      <table>
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Nama</th>
            <th>Usia</th>
            <th>Core Strength</th>
            <th>Supporting</th>
            <th>Next Skill</th>
            <th>Creative</th>
            <th>Comm.</th>
            <th>Integrator</th>
            <th>Explorer</th>
            <th>Freq. AI</th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </main>
  <script>
    const SUPABASE_URL = "https://ygenpyaqswifjqvrpjqo.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZW5weWFxc3dpZmpxdnJwanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDY4NjMsImV4cCI6MjEwMTA4Mjg2M30.1m5R9E2DoXYqwkBu6PxXqMG4uIcpwn13pnn4dBTeerQ";
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const SESSION_KEY = "kp-admin-pw";

    const loginEl = document.getElementById("login");
    const dashboardEl = document.getElementById("dashboard");
    const passwordInput = document.getElementById("password");
    const loginBtn = document.getElementById("loginBtn");
    const loginError = document.getElementById("loginError");
    const rowsEl = document.getElementById("rows");
    const rowCountEl = document.getElementById("rowCount");

    function formatDate(iso) {
      return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    }

    function renderRows(rows) {
      rowsEl.innerHTML = "";
      rowCountEl.textContent = `${rows.length} submission${rows.length === 1 ? "" : "s"}`;
      if (rows.length === 0) {
        rowsEl.innerHTML = `<tr><td colspan="11" class="empty">Belum ada submission.</td></tr>`;
        return;
      }
      rows.forEach((row) => {
        const tr = document.createElement("tr");
        tr.className = "row";
        tr.innerHTML = `
          <td>${formatDate(row.submitted_at)}</td>
          <td>${row.nickname}</td>
          <td>${row.age}</td>
          <td>${row.core_strength}</td>
          <td>${row.supporting_strength}</td>
          <td>${row.next_skill}</td>
          <td>${row.creative_score}</td>
          <td>${row.communicator_score}</td>
          <td>${row.integrator_score}</td>
          <td>${row.explorer_score}</td>
          <td>${row.ai_frequency || ""}</td>
        `;
        const detailTr = document.createElement("tr");
        detailTr.className = "detail";
        detailTr.innerHTML = `
          <td colspan="11">
            <div class="detail-grid">
              <div>
                <h4>Challenge</h4>
                <p><strong>${row.scenario || ""}</strong></p>
                <p>${row.challenge_problem || ""}</p>
                <h4 style="margin-top:14px;">Solusi Anak</h4>
                <p>${row.challenge_solution || ""}</p>
              </div>
              <div>
                <h4>AI Tools</h4>
                <p>${(row.ai_tools || []).join(", ") || "—"}</p>
                <h4 style="margin-top:14px;">Pengalaman</h4>
                <p>${(row.experiences || []).join(", ") || "—"}</p>
                <h4 style="margin-top:14px;">Jawaban Lengkap</h4>
                <pre>${JSON.stringify(row.answers, null, 2)}</pre>
              </div>
            </div>
          </td>
        `;
        tr.addEventListener("click", () => detailTr.classList.toggle("open"));
        rowsEl.appendChild(tr);
        rowsEl.appendChild(detailTr);
      });
    }

    async function fetchSubmissions(password) {
      const { data, error } = await client.rpc("get_submissions", { admin_password: password });
      if (error) throw error;
      return data || [];
    }

    async function tryLogin(password) {
      loginError.style.display = "none";
      loginBtn.disabled = true;
      loginBtn.textContent = "Memeriksa...";
      try {
        const rows = await fetchSubmissions(password);
        if (rows.length === 0) {
          loginError.textContent = "Password salah atau belum ada data.";
          loginError.style.display = "block";
          loginBtn.disabled = false;
          loginBtn.textContent = "Masuk";
          return;
        }
        sessionStorage.setItem(SESSION_KEY, password);
        loginEl.style.display = "none";
        dashboardEl.style.display = "block";
        renderRows(rows);
      } catch (err) {
        loginError.textContent = "Terjadi kesalahan. Coba lagi.";
        loginError.style.display = "block";
        loginBtn.disabled = false;
        loginBtn.textContent = "Masuk";
      }
    }

    loginBtn.addEventListener("click", () => tryLogin(passwordInput.value));
    passwordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(passwordInput.value); });

    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) tryLogin(cached);
  </script>
</body>
</html>
```

- [ ] **Step 2: Sanity-check the file**

Run: `grep -c "get_submissions\|admin_password" "/Users/enricoai/Kidspreneur Website/admin-src/index.html"`
Expected: `3` (the two JS references plus the RPC name used once each — exact count isn't critical, just
confirming the file was written and isn't empty).

- [ ] **Step 3: Commit**

```bash
cd "/Users/enricoai/Kidspreneur Website"
git add admin-src/index.html
git commit -m "feat: add password-gated admin dashboard for assessment submissions"
```

---

### Task 8: Deploy the admin page

**Files:**
- Create: `admin/index.html` (copy of `admin-src/index.html` — no build step needed, it's plain HTML)

- [ ] **Step 1: Copy the file into the deployed location**

Run:
```bash
mkdir -p "/Users/enricoai/Kidspreneur Website/admin"
cp "/Users/enricoai/Kidspreneur Website/admin-src/index.html" "/Users/enricoai/Kidspreneur Website/admin/index.html"
```

- [ ] **Step 2: Verify**

Run: `diff "/Users/enricoai/Kidspreneur Website/admin-src/index.html" "/Users/enricoai/Kidspreneur Website/admin/index.html"`
Expected: no output (files are identical).

- [ ] **Step 3: Commit**

```bash
cd "/Users/enricoai/Kidspreneur Website"
git add admin
git commit -m "build: deploy admin dashboard to /admin"
```

---

### Task 9: Verify the admin dashboard end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Serve and open the admin page**

With the site served at `http://localhost:8777/` (same server as Task 6), navigate to
`http://localhost:8777/admin/`.
Expected: a password form, styled with the site's brand colors (blue/white cards, Poppins heading).

- [ ] **Step 2: Try a wrong password**

Type an incorrect password and click "Masuk" (or press Enter).
Expected: inline message "Password salah atau belum ada data." appears; the table never renders.

- [ ] **Step 3: Check the network request for the wrong-password attempt**

Open the browser's network tab, repeat Step 2, and inspect the `rpc/get_submissions` request.
Expected: HTTP 200 response with body `[]` — confirms the password check happened server-side and no
data was ever sent to the browser for a wrong guess.

- [ ] **Step 4: Log in with the real password**

Enter the password set in Task 1, Step 3.
Expected: the table renders with at least the row(s) created during Task 6's verification, sorted
newest-first.

- [ ] **Step 5: Expand a row**

Click anywhere on a submission row.
Expected: a detail panel appears below it showing the challenge, the child's written solution, AI
tools/experiences, and the raw JSON answers; clicking the row again collapses it.

- [ ] **Step 6: Confirm session caching**

Reload the page (same tab).
Expected: the table loads immediately without re-showing the password form (this happens automatically
via the RPC being retried using the cached `sessionStorage` password; expected to work since Postgres
performed the check again in the background — behavior is instant if this loads fast enough).
Open the admin URL in a **new** tab (or after closing and reopening the browser).
Expected: the password form appears again — `sessionStorage` doesn't carry across separate tabs/sessions.

- [ ] **Step 7: Confirm the marketing site links nowhere new for admin (deliberate — no public link exists to `/admin`)**

Run: `grep -n "admin" "/Users/enricoai/Kidspreneur Website/index.html"`
Expected: no output — `/admin` is reachable only if you know the URL directly, same as `/assessment/`
was before it got a homepage CTA link. This is deliberate: linking to it from the public nav would be
an unnecessary invitation to try the password form.
