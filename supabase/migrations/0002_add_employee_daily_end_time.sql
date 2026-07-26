-- Adds the mandatory daily end time per employee, mirroring daily_start_time.
alter table employees
  add column daily_end_time time not null default '18:00:00'; -- per-employee expected end; drives "early leaver" instead of a hardcoded cutoff
