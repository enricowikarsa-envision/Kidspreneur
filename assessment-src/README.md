# KidsPreneur Strength Assessment

Interactive pre-class assessment for KidsPreneur participants aged 9–12.

## Local development

```bash
npm install
npm run dev
```

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
