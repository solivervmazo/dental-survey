-- Run once in the Supabase SQL Editor. Do not paste a secret key into this project.

create table if not exists public.survey_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.survey_visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('owner', 'receptionist', 'dentist')),
  status text not null check (status in ('completed', 'screened_out')),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists idx_survey_visits_created_at on public.survey_visits (created_at desc);
create index if not exists idx_survey_responses_created_at on public.survey_responses (created_at desc);

alter table public.survey_admins enable row level security;
alter table public.survey_visits enable row level security;
alter table public.survey_responses enable row level security;

revoke all on public.survey_admins from anon, authenticated;
revoke all on public.survey_visits from anon, authenticated;
revoke all on public.survey_responses from anon, authenticated;

-- Public visitors can submit answers and a page-view event; they cannot read records.
grant insert on public.survey_visits to anon;
grant insert (role, status, answers) on public.survey_responses to anon;

create policy "public may record a visit"
  on public.survey_visits for insert to anon with check (true);
create policy "public may submit a response"
  on public.survey_responses for insert to anon with check (true);

-- The dashboard uses an ordinary Supabase Auth account listed in survey_admins.
create or replace function public.is_survey_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.survey_admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_survey_admin() from public;
grant execute on function public.is_survey_admin() to authenticated;

grant select on public.survey_visits to authenticated;
grant select on public.survey_responses to authenticated;

create policy "admin may read visits"
  on public.survey_visits for select to authenticated
  using ((select public.is_survey_admin()));
create policy "admin may read responses"
  on public.survey_responses for select to authenticated
  using ((select public.is_survey_admin()));

-- After creating your own user under Authentication > Users, run this separately
-- with your actual user UUID:
-- insert into public.survey_admins (user_id) values ('YOUR_AUTH_USER_UUID');
