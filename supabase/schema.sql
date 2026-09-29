-- Public survey tables. Apply with `node dashboard/server/migrate.mjs`.
-- The local dashboard reads through a direct Postgres connection from .env.

create table if not exists public.survey_visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('owner', 'receptionist', 'dentist')),
  status text not null check (status in ('completed', 'screened_out')),
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 16000),
  created_at timestamptz not null default now()
);

create index if not exists idx_survey_visits_created_at on public.survey_visits (created_at desc);
create index if not exists idx_survey_responses_created_at on public.survey_responses (created_at desc);

alter table public.survey_visits enable row level security;
alter table public.survey_responses enable row level security;

revoke all on public.survey_visits from anon, authenticated;
revoke all on public.survey_responses from anon, authenticated;

-- Public visitors can submit answers and a page-view event; they cannot read records.
grant insert on public.survey_visits to anon;
grant insert (role, status, answers) on public.survey_responses to anon;

drop policy if exists "public may record a visit" on public.survey_visits;
drop policy if exists "public may submit a response" on public.survey_responses;
drop policy if exists "admin may read visits" on public.survey_visits;
drop policy if exists "admin may read responses" on public.survey_responses;

create policy "public may record a visit"
  on public.survey_visits for insert to anon with check (true);
create policy "public may submit a response"
  on public.survey_responses for insert to anon with check (true);
