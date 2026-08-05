-- Per-godown holiday calendar. Sundays are treated as holidays by default and are
-- NEVER materialized as rows here (no cron exists in this project to keep generating
-- them month after month) -- only exceptions are stored:
--   CUSTOM          = an admin-added holiday on an arbitrary date, with a label.
--   SUNDAY_REMOVED  = an override that cancels the default-Sunday rule for one date,
--                     turning that specific Sunday back into a working day.
-- Effective holidays for a site+month are computed at query time in
-- services/holiday.service.ts by unioning "every Sunday in the month minus
-- SUNDAY_REMOVED overrides" with all CUSTOM rows for that month.
create table holidays (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  holiday_date date not null,
  type text not null check (type in ('CUSTOM', 'SUNDAY_REMOVED')),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, holiday_date, type)
);
create index idx_holidays_site_date on holidays (site_id, holiday_date);
create trigger trg_holidays_updated_at before update on holidays
  for each row execute function set_updated_at();

alter table holidays enable row level security;

create policy admin_all_holidays on holidays for all
  using (exists (select 1 from admin_profiles where id = auth.uid()))
  with check (exists (select 1 from admin_profiles where id = auth.uid()));

alter publication supabase_realtime add table holidays;
