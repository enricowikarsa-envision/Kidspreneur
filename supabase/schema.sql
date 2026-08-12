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

-- NOTE: search_path must include `extensions`, not just `public`.
-- Supabase installs pgcrypto into the `extensions` schema, so a SECURITY DEFINER
-- function pinned to `public` alone cannot see crypt() and fails at runtime with
-- "function crypt(text, text) does not exist". Listing both schemas works whether
-- pgcrypto lives in `extensions` (Supabase default) or `public` (vanilla Postgres).
create or replace function get_submissions(admin_password text)
returns setof submissions
language plpgsql
security definer
set search_path = public, extensions
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

-- AFTER running the above, set your admin password by running this
-- separately in the SQL Editor (substitute your own password):
--
--   insert into admin_secret (id, password_hash)
--   values (1, crypt('YOUR_PASSWORD_HERE', gen_salt('bf')));
--
-- Never commit the plaintext password to this repo.

-- ============================================================
-- MIGRATION: expand the assessment's Identity step to match the
-- Kontak form fields. Run this once against an EXISTING project
-- (one that already ran the `create table submissions` above).
-- A brand-new project only needs this if it also needs the wider
-- field set; run it right after the initial create table either way.
--
-- - `nickname` is reused as-is: it now holds the parent's name
--   ("Nama Orang Tua") instead of the child's nickname. No rename,
--   to avoid a breaking column change; only its meaning shifted.
-- - `age` becomes free text ("mis. 10 tahun") instead of a strict
--   int, and is no longer required, matching Kontak's own
--   "Usia Anak" field (no asterisk = optional there).
-- - whatsapp/email/interests/ai_experience/expectations are new,
--   all nullable at the DB level — the app enforces "Nama Orang Tua"
--   and "Nomor WhatsApp" as required client-side, same as Kontak.
-- ============================================================
alter table submissions
  alter column age type text using age::text,
  alter column age drop not null,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists interests text,
  add column if not exists ai_experience text,
  add column if not exists expectations text;

-- ============================================================
-- MIGRATION: add "Nama Anak" (child's name) as the opening question
-- of the assessment's "A little about you" step. Run once against an
-- EXISTING project that already ran the migration above.
--
-- - `child_name` is new and nullable at the DB level — the app
--   enforces it as required client-side, same treatment as the other
--   "* " fields on this form.
-- ============================================================
alter table submissions
  add column if not exists child_name text;
