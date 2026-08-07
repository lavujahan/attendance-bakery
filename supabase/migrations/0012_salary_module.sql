-- Salary/Payroll module: configurable salary cycles, an attendance verification/freeze
-- workflow gating payroll runs, per-employee-per-cycle salary records with historical
-- snapshot fields (survive employee/site hard deletes), and an audited finalize/reopen/pay
-- lifecycle. pgcrypto/btree_gist extensions already exist from 0001_init.sql.

-- ============ attendance: verification/freeze workflow ============
alter table attendance
  add column salary_verification_status text not null default 'Draft'
    check (salary_verification_status in ('Draft', 'Verified', 'Frozen')),
  -- Always reflects live check_out_time/status -- a correction automatically un-flags it,
  -- no trigger needed to sync it back, and it's still indexable like phone_prefix already is.
  add column is_pending_correction boolean generated always as (
    status <> 'Absent' and check_out_time is null
  ) stored,
  add column verified_at timestamptz,
  add column verified_by uuid references admin_profiles(id),
  add column frozen_at timestamptz,
  add column frozen_by uuid references admin_profiles(id);

create index idx_attendance_salary_verification on attendance (salary_verification_status, attendance_date);
create index idx_attendance_pending_correction on attendance (attendance_date) where is_pending_correction;

-- Cycle membership is derived by attendance_date between salary_cycles.from_date/to_date
-- (cycles can never overlap, see below) -- no salary_cycle_id FK needed on attendance.

-- Enforces immutability once Frozen, and auto-demotes Verified -> Draft if a Verified
-- (not-yet-Frozen) row is edited, so a stale verification can never survive a correction.
create or replace function enforce_attendance_verification_rules()
returns trigger language plpgsql as $$
begin
  if old.salary_verification_status = 'Frozen' and new.salary_verification_status = 'Frozen'
     and (new.check_in_time is distinct from old.check_in_time
          or new.check_out_time is distinct from old.check_out_time
          or new.status is distinct from old.status
          or new.remarks is distinct from old.remarks) then
    raise exception 'Attendance record is frozen for payroll. Reopen the salary cycle before editing.';
  end if;

  if old.salary_verification_status = 'Verified'
     and (new.check_in_time is distinct from old.check_in_time
          or new.check_out_time is distinct from old.check_out_time
          or new.status is distinct from old.status) then
    new.salary_verification_status := 'Draft';
    new.verified_at := null;
    new.verified_by := null;
  end if;

  return new;
end;
$$;

create trigger trg_attendance_verification_guard before update on attendance
  for each row execute function enforce_attendance_verification_rules();

-- ============ salary_cycles ============
create table salary_cycles (
  id uuid primary key default gen_random_uuid(),
  from_date date not null,
  to_date date not null check (to_date >= from_date),
  date_range daterange generated always as (daterange(from_date, to_date, '[]')) stored,
  status text not null default 'Draft' check (status in ('Draft', 'Finalized', 'Paid')),
  notes text,
  finalized_at timestamptz,
  finalized_by uuid references admin_profiles(id),
  paid_at timestamptz,
  paid_by uuid references admin_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No `where status = ...` filter (unlike the old mapping table's partial exclusion):
  -- every cycle, Draft included, reserves its calendar period -- two Draft cycles covering
  -- the same days is always a data-entry mistake, not a valid state.
  exclude using gist (date_range with &&)
);
create index idx_salary_cycles_status on salary_cycles (status);
create trigger trg_salary_cycles_updated_at before update on salary_cycles
  for each row execute function set_updated_at();

-- ============ salary_cycle_audit_log ============
-- Append-only lifecycle trail. A cycle can legitimately be finalized -> reopened ->
-- finalized again multiple times, which flat columns on salary_cycles can't represent.
create table salary_cycle_audit_log (
  id uuid primary key default gen_random_uuid(),
  salary_cycle_id uuid not null references salary_cycles(id) on delete cascade,
  action text not null check (action in ('Finalized', 'Reopened', 'Paid')),
  from_status text,
  to_status text,
  reason text,
  performed_by uuid references admin_profiles(id),
  performed_at timestamptz not null default now()
);
create index idx_salary_cycle_audit_log_cycle on salary_cycle_audit_log (salary_cycle_id, performed_at desc);

-- ============ salary_records ============
-- Per-employee, per-cycle line item -- the historical snapshot. employee_id/site_id are
-- nullable with `on delete set null` because deleteEmployee/deleteSite are hard deletes;
-- all display fields are captured once at compute time and never re-joined live, so a
-- later name change, site reassignment, or employee deletion can never alter a past report.
create table salary_records (
  id uuid primary key default gen_random_uuid(),
  salary_cycle_id uuid not null references salary_cycles(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  employee_code text not null,
  employee_name text not null,
  designation text not null,
  site_id uuid references sites(id) on delete set null,
  site_code text not null default '—',
  site_name text not null default '—',
  worked_minutes integer not null default 0 check (worked_minutes >= 0),
  deduction_minutes integer not null default 0 check (deduction_minutes >= 0),
  payable_minutes integer not null default 0 check (payable_minutes >= 0),
  hourly_rate numeric(10,2) not null default 0,
  gross_salary_amount numeric(12,2) not null default 0,
  override_payable_minutes integer check (override_payable_minutes is null or override_payable_minutes >= 0),
  override_reason_category text
    check (override_reason_category in ('Rain','Power Failure','Festival','Management Decision','Emergency','Other')),
  override_note text,
  override_by uuid references admin_profiles(id),
  override_at timestamptz,
  final_payable_minutes integer generated always as (coalesce(override_payable_minutes, payable_minutes)) stored,
  final_salary_amount numeric(12,2) not null default 0,
  attendance_days_count integer not null default 0,
  missing_checkout_count integer not null default 0,
  record_status text not null default 'Draft' check (record_status in ('Draft', 'Finalized', 'Paid')),
  paid_at timestamptz,
  paid_by uuid references admin_profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salary_cycle_id, employee_id),
  check (
    override_payable_minutes is null
    or (override_reason_category is not null and override_note is not null and override_by is not null)
  )
);
create index idx_salary_records_cycle on salary_records (salary_cycle_id);
create index idx_salary_records_employee on salary_records (employee_id);
create index idx_salary_records_site on salary_records (site_id);
create index idx_salary_records_status on salary_records (record_status);
create trigger trg_salary_records_updated_at before update on salary_records
  for each row execute function set_updated_at();

-- Financial fields become read-only once record_status leaves Draft; record_status/paid_*
-- stay updatable so Draft -> Finalized -> Paid transitions still work. No separate
-- override-audit table: these flat columns already carry who/when/why/original-vs-override,
-- and once locked here they're frozen exactly like the rest of the record.
create or replace function enforce_salary_record_draft_editable()
returns trigger language plpgsql as $$
begin
  if old.record_status <> 'Draft' and (
       new.worked_minutes is distinct from old.worked_minutes or
       new.deduction_minutes is distinct from old.deduction_minutes or
       new.payable_minutes is distinct from old.payable_minutes or
       new.hourly_rate is distinct from old.hourly_rate or
       new.gross_salary_amount is distinct from old.gross_salary_amount or
       new.override_payable_minutes is distinct from old.override_payable_minutes or
       new.override_reason_category is distinct from old.override_reason_category or
       new.override_note is distinct from old.override_note
     ) then
    raise exception 'Salary record is % and cannot be edited.', old.record_status;
  end if;
  return new;
end;
$$;

create trigger trg_salary_records_guard before update on salary_records
  for each row execute function enforce_salary_record_draft_editable();

-- ============ RPCs ============
-- Validates the full finalize checklist inside the transaction, then locks. Does NOT
-- recompute payroll math in SQL -- the client always writes a fresh preview via
-- computeAndUpsertPreview() immediately before calling this; step 5 below rejects a stale
-- preview rather than trusting SQL to re-derive money math (kept single-sourced in TS).
create or replace function finalize_salary_cycle(p_cycle_id uuid, p_admin_id uuid)
returns void language plpgsql as $$
declare
  v_from date; v_to date; v_status text;
  v_unfrozen_count int; v_pending_count int; v_missing_rate_count int;
  v_dup_count int; v_missing_preview_count int;
begin
  select from_date, to_date, status into v_from, v_to, v_status
  from salary_cycles where id = p_cycle_id for update;
  if not found then raise exception 'Salary cycle not found.'; end if;
  if v_status <> 'Draft' then
    raise exception 'Salary cycle is already % and cannot be finalized again.', v_status;
  end if;

  -- 1. attendance frozen for the full window
  select count(*) into v_unfrozen_count from attendance
    where attendance_date between v_from and v_to and salary_verification_status <> 'Frozen';
  if v_unfrozen_count > 0 then
    raise exception 'Cannot finalize: % attendance record(s) are not frozen yet.', v_unfrozen_count;
  end if;

  -- 2. no missing checkouts (defensive; Frozen rows should never be pending by construction)
  select count(*) into v_pending_count from attendance
    where attendance_date between v_from and v_to and is_pending_correction;
  if v_pending_count > 0 then
    raise exception 'Cannot finalize: % attendance record(s) have a missing checkout.', v_pending_count;
  end if;

  -- 3. hourly rate exists for every employee with frozen attendance in range
  select count(distinct a.employee_id) into v_missing_rate_count
    from attendance a join employees e on e.id = a.employee_id
    where a.attendance_date between v_from and v_to
      and a.salary_verification_status = 'Frozen' and e.salary_per_hour <= 0;
  if v_missing_rate_count > 0 then
    raise exception 'Cannot finalize: % employee(s) have no hourly rate configured.', v_missing_rate_count;
  end if;

  -- 4. duplicate attendance -- formality only; attendance's own unique(employee_id,
  --    attendance_date) already makes this structurally impossible. Explicit safety net.
  select count(*) into v_dup_count from (
    select employee_id, attendance_date from attendance
    where attendance_date between v_from and v_to
    group by employee_id, attendance_date having count(*) > 1
  ) dups;
  if v_dup_count > 0 then raise exception 'Cannot finalize: duplicate attendance rows detected.'; end if;

  -- 5. preview freshness -- rejects a stale/partial preview race (e.g. attendance frozen
  --    after the last preview compute). Should never fire in normal use.
  select count(distinct a.employee_id) into v_missing_preview_count
    from attendance a
    where a.attendance_date between v_from and v_to and a.salary_verification_status = 'Frozen'
      and not exists (select 1 from salary_records sr
                       where sr.salary_cycle_id = p_cycle_id and sr.employee_id = a.employee_id);
  if v_missing_preview_count > 0 then
    raise exception 'Salary preview is out of date. Reopen the salary grid to recompute, then try again.';
  end if;

  update salary_records set record_status = 'Finalized'
    where salary_cycle_id = p_cycle_id and record_status = 'Draft';
  update salary_cycles set status = 'Finalized', finalized_at = now(), finalized_by = p_admin_id
    where id = p_cycle_id;
  insert into salary_cycle_audit_log (salary_cycle_id, action, from_status, to_status, performed_by)
    values (p_cycle_id, 'Finalized', 'Draft', 'Finalized', p_admin_id);
end;
$$;

-- The explicit, audited, Admin-only unlock action. Resets attendance all the way to Draft
-- (not Verified), forcing a full re-verify -> re-freeze pass rather than trusting a stale
-- verification after whatever correction motivated the reopen.
create or replace function reopen_salary_cycle(p_cycle_id uuid, p_admin_id uuid, p_reason text)
returns void language plpgsql as $$
declare v_from date; v_to date; v_status text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to reopen a salary cycle.';
  end if;

  select from_date, to_date, status into v_from, v_to, v_status
    from salary_cycles where id = p_cycle_id for update;
  if not found then raise exception 'Salary cycle not found.'; end if;
  if v_status not in ('Finalized', 'Paid') then
    raise exception 'Only a Finalized or Paid cycle can be reopened.';
  end if;

  update attendance set salary_verification_status = 'Draft',
    verified_at = null, verified_by = null, frozen_at = null, frozen_by = null
    where attendance_date between v_from and v_to and salary_verification_status = 'Frozen';

  update salary_records set record_status = 'Draft'
    where salary_cycle_id = p_cycle_id and record_status in ('Finalized', 'Paid');

  update salary_cycles set status = 'Draft', finalized_at = null, finalized_by = null,
    paid_at = null, paid_by = null where id = p_cycle_id;

  insert into salary_cycle_audit_log (salary_cycle_id, action, from_status, to_status, reason, performed_by)
    values (p_cycle_id, 'Reopened', v_status, 'Draft', p_reason, p_admin_id);
end;
$$;

-- Bulk-pay: flips every remaining Finalized record (skipping ones already individually
-- Paid via markSalaryRecordPaid) to Paid, and the cycle itself, in one transaction.
create or replace function mark_salary_cycle_paid(p_cycle_id uuid, p_admin_id uuid)
returns void language plpgsql as $$
declare v_status text;
begin
  select status into v_status from salary_cycles where id = p_cycle_id for update;
  if not found then raise exception 'Salary cycle not found.'; end if;
  if v_status <> 'Finalized' then raise exception 'Only a Finalized cycle can be marked Paid.'; end if;

  update salary_records set record_status = 'Paid', paid_at = now(), paid_by = p_admin_id
    where salary_cycle_id = p_cycle_id and record_status = 'Finalized';
  update salary_cycles set status = 'Paid', paid_at = now(), paid_by = p_admin_id where id = p_cycle_id;
  insert into salary_cycle_audit_log (salary_cycle_id, action, from_status, to_status, performed_by)
    values (p_cycle_id, 'Paid', 'Finalized', 'Paid', p_admin_id);
end;
$$;

grant execute on function finalize_salary_cycle(uuid, uuid) to authenticated;
grant execute on function reopen_salary_cycle(uuid, uuid, text) to authenticated;
grant execute on function mark_salary_cycle_paid(uuid, uuid) to authenticated;

-- ============ RLS ============
alter table salary_cycles enable row level security;
alter table salary_records enable row level security;
alter table salary_cycle_audit_log enable row level security;

create policy admin_all_salary_cycles on salary_cycles for all
  using (exists (select 1 from admin_profiles where id = auth.uid()))
  with check (exists (select 1 from admin_profiles where id = auth.uid()));
create policy admin_all_salary_records on salary_records for all
  using (exists (select 1 from admin_profiles where id = auth.uid()))
  with check (exists (select 1 from admin_profiles where id = auth.uid()));
create policy admin_all_salary_cycle_audit_log on salary_cycle_audit_log for all
  using (exists (select 1 from admin_profiles where id = auth.uid()))
  with check (exists (select 1 from admin_profiles where id = auth.uid()));

-- ============ realtime ============
alter publication supabase_realtime add table salary_cycles;
alter publication supabase_realtime add table salary_records;
alter publication supabase_realtime add table salary_cycle_audit_log;
