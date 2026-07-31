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

-- AFTER running the above, set your admin password by running this
-- separately in the SQL Editor (substitute your own password):
--
--   insert into admin_secret (id, password_hash)
--   values (1, crypt('YOUR_PASSWORD_HERE', gen_salt('bf')));
--
-- Never commit the plaintext password to this repo.
