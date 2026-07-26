-- Attendance V2 -- full schema, including face verification from day one
-- (attendance_updated-main's schema plus: employees.daily_start_time,
-- employees.face_enrolled, and a richer face_status enum on attendance
-- instead of a plain boolean).

create extension if not exists pgcrypto;
create extension if not exists btree_gist; -- for the daterange EXCLUDE constraint
create extension if not exists vector;      -- for face_embeddings

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ employees ============
create sequence if not exists employee_code_seq start 1;

create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique not null default ('EMP' || lpad(nextval('employee_code_seq')::text, 6, '0')),
  employee_name text not null,
  mobile_number text not null,
  phone_prefix text generated always as (left(mobile_number, 5)) stored, -- kiosk login ID
  email text not null default '',
  gender text not null check (gender in ('Male', 'Female', 'Other')),
  designation text not null,
  joining_date date not null,
  daily_start_time time not null default '09:00:00', -- per-employee expected start; drives "late" instead of a hardcoded cutoff
  face_enrolled boolean not null default false,        -- flipped true by app logic once 4 onboarding shots succeed; face-service never writes here
  status text not null check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_employees_phone_prefix_status on employees (phone_prefix, status);
create trigger trg_employees_updated_at before update on employees
  for each row execute function set_updated_at();

-- ============ sites ============
create sequence if not exists site_code_seq start 1;

create table sites (
  id uuid primary key default gen_random_uuid(),
  site_code text unique not null default ('SITE' || lpad(nextval('site_code_seq')::text, 6, '0')),
  site_name text not null,
  client_name text not null,
  site_incharge text not null,
  latitude double precision not null,
  longitude double precision not null,
  allowed_radius integer not null,
  status text not null check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_sites_updated_at before update on sites
  for each row execute function set_updated_at();

-- ============ employee_site_mappings ============
create table employee_site_mappings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  employee_id uuid not null references employees(id) on delete cascade,
  employee_code text not null,
  employee_name text not null,
  site_id uuid not null references sites(id) on delete cascade,
  site_code text not null,
  site_name text not null,
  client_name text not null,
  from_date date not null,
  to_date date not null check (to_date >= from_date),
  status text not null check (status in ('Active', 'Inactive')),
  date_range daterange generated always as (daterange(from_date, to_date, '[]')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  exclude using gist (employee_id with =, date_range with &&) where (status = 'Active')
);
create index idx_mappings_group_id on employee_site_mappings (group_id);
create index idx_mappings_employee_active on employee_site_mappings (employee_id, status);
create trigger trg_mappings_updated_at before update on employee_site_mappings
  for each row execute function set_updated_at();

-- ============ face_embeddings ============
-- Owned entirely by face-service (Insightface/face-service) -- this app never
-- reads/writes rows here directly, only calls face-service's HTTP API.
create table face_embeddings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  embedding vector(512) not null,
  model_version text not null default 'arcface_r100_v1',
  source text not null check (source in ('onboarding', 'adaptive')),
  quality_score float not null,
  created_at timestamptz not null default now()
);
create index face_embeddings_embedding_hnsw_idx on face_embeddings using hnsw (embedding vector_cosine_ops);
create index face_embeddings_employee_id_idx on face_embeddings (employee_id);

-- ============ attendance ============
create table attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  employee_code text not null,
  employee_name text not null,
  designation text not null,
  site_id uuid not null references sites(id),
  site_code text not null,
  site_name text not null,
  attendance_date date not null,
  check_in_time text,
  check_out_time text,
  check_in_latitude double precision,
  check_in_longitude double precision,
  check_in_accuracy double precision,
  check_out_latitude double precision,
  check_out_longitude double precision,
  check_out_accuracy double precision,
  -- null = not attempted yet; 'verified' = face matched; 'unverified' = face captured but
  -- didn't clear the confidence threshold (fail-open, flagged for HR); 'service_error' =
  -- face-service was unreachable/timed out (also fail-open, but a distinct remediation
  -- from 'unverified' -- see the face-service integration hardening notes).
  check_in_face_status text check (check_in_face_status in ('verified', 'unverified', 'service_error')),
  check_in_face_confidence float,
  check_out_face_status text check (check_out_face_status in ('verified', 'unverified', 'service_error')),
  check_out_face_confidence float,
  status text not null check (status in ('Checked In', 'Completed', 'Absent')),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, attendance_date)
);
create index idx_attendance_employee_date on attendance (employee_id, attendance_date);
create trigger trg_attendance_updated_at before update on attendance
  for each row execute function set_updated_at();

-- ============ admin_profiles ============
-- Mirrors a display username against a real auth.users row (Supabase Auth requires an
-- email; the app maps username -> a synthetic email at bootstrap time -- see SETUP.md).
create table admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_admin_profiles_updated_at before update on admin_profiles
  for each row execute function set_updated_at();

-- Resolves a username to its synthetic auth email for the login form, without exposing
-- admin_profiles/auth.users to broad anon reads.
create or replace function admin_email_for_username(p_username text)
returns text language sql security definer stable as $$
  select u.email from admin_profiles p
  join auth.users u on u.id = p.id
  where p.username = p_username;
$$;
revoke all on function admin_email_for_username(text) from public;
grant execute on function admin_email_for_username(text) to anon, authenticated;

-- ============ employee_site_mappings batch RPCs ============
-- Attempts one insert per employee id inside its own subtransaction so a single overlap
-- violation only skips that employee instead of aborting the whole batch.
create or replace function save_employee_site_mappings(
  p_group_id uuid,
  p_site_id uuid,
  p_from_date date,
  p_to_date date,
  p_status text,
  p_employee_ids uuid[]
) returns table(employee_id uuid, assigned boolean) language plpgsql as $$
declare
  eid uuid;
begin
  foreach eid in array p_employee_ids loop
    begin
      insert into employee_site_mappings
        (group_id, employee_id, employee_code, employee_name, site_id, site_code, site_name, client_name, from_date, to_date, status)
      select p_group_id, e.id, e.employee_code, e.employee_name, s.id, s.site_code, s.site_name, s.client_name, p_from_date, p_to_date, p_status
      from employees e, sites s
      where e.id = eid and s.id = p_site_id;

      employee_id := eid;
      assigned := true;
      return next;
    exception when exclusion_violation then
      employee_id := eid;
      assigned := false;
      return next;
    end;
  end loop;
end;
$$;

-- Replaces all rows for a mapping group (delete + recreate) inside one transaction, but
-- only if at least one employee is assignable -- if every employee would overlap another
-- Active mapping, the existing group rows are left untouched. Overlap is pre-checked
-- excluding the group's own current rows so editing a mapping's dates doesn't
-- self-conflict with its pre-edit version.
create or replace function update_employee_site_mappings(
  p_group_id uuid,
  p_site_id uuid,
  p_from_date date,
  p_to_date date,
  p_status text,
  p_employee_ids uuid[]
) returns table(employee_id uuid, assigned boolean) language plpgsql as $$
declare
  eid uuid;
  v_range daterange := daterange(p_from_date, p_to_date, '[]');
  v_assignable uuid[] := '{}';
  v_skipped uuid[] := '{}';
begin
  foreach eid in array p_employee_ids loop
    if exists (
      select 1 from employee_site_mappings m
      where m.employee_id = eid
        and m.status = 'Active'
        and m.group_id <> p_group_id
        and m.date_range && v_range
    ) then
      v_skipped := array_append(v_skipped, eid);
    else
      v_assignable := array_append(v_assignable, eid);
    end if;
  end loop;

  if array_length(v_assignable, 1) is null then
    foreach eid in array v_skipped loop
      employee_id := eid;
      assigned := false;
      return next;
    end loop;
    return;
  end if;

  delete from employee_site_mappings where group_id = p_group_id;

  foreach eid in array v_assignable loop
    begin
      insert into employee_site_mappings
        (group_id, employee_id, employee_code, employee_name, site_id, site_code, site_name, client_name, from_date, to_date, status)
      select p_group_id, e.id, e.employee_code, e.employee_name, s.id, s.site_code, s.site_name, s.client_name, p_from_date, p_to_date, p_status
      from employees e, sites s
      where e.id = eid and s.id = p_site_id;

      employee_id := eid;
      assigned := true;
      return next;
    exception when exclusion_violation then
      employee_id := eid;
      assigned := false;
      return next;
    end;
  end loop;

  foreach eid in array v_skipped loop
    employee_id := eid;
    assigned := false;
    return next;
  end loop;
end;
$$;

-- ============ RLS ============
alter table employees enable row level security;
alter table sites enable row level security;
alter table employee_site_mappings enable row level security;
alter table attendance enable row level security;
alter table admin_profiles enable row level security;
alter table face_embeddings enable row level security;

-- Admin (authenticated + present in admin_profiles) has full access to all app tables.
create policy admin_all_employees on employees for all
  using (exists (select 1 from admin_profiles where id = auth.uid()))
  with check (exists (select 1 from admin_profiles where id = auth.uid()));

create policy admin_all_sites on sites for all
  using (exists (select 1 from admin_profiles where id = auth.uid()))
  with check (exists (select 1 from admin_profiles where id = auth.uid()));

create policy admin_all_mappings on employee_site_mappings for all
  using (exists (select 1 from admin_profiles where id = auth.uid()))
  with check (exists (select 1 from admin_profiles where id = auth.uid()));

create policy admin_all_attendance on attendance for all
  using (exists (select 1 from admin_profiles where id = auth.uid()))
  with check (exists (select 1 from admin_profiles where id = auth.uid()));

create policy admin_self_profile_select on admin_profiles for select
  using (id = auth.uid());
create policy admin_self_profile_update on admin_profiles for update
  using (id = auth.uid());

-- face_embeddings: no anon/authenticated policies at all -- only the service-role key
-- (used exclusively by face-service) can read/write it.
create policy face_embeddings_service_role_only on face_embeddings for all
  to service_role using (true) with check (true);

-- No anon policies are granted on employees/sites/mappings/attendance either: the
-- /attendance kiosk flow (employee lookup, site assignment, check-in/out) is
-- deliberately unauthenticated at the Supabase level and instead runs entirely through
-- server-side Server Actions using the service-role key (lib/supabase/admin.ts), which
-- bypasses RLS. This keeps GPS/geofence/face-gate enforcement server-side where a
-- tampered client can't skip it.

-- ============ realtime ============
alter publication supabase_realtime add table employees;
alter publication supabase_realtime add table sites;
alter publication supabase_realtime add table employee_site_mappings;
alter publication supabase_realtime add table attendance;
