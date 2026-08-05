-- Admins enter a daily wage on the Add/Edit Employee form; salary_per_hour remains the
-- internally-used rate (derived from salary_per_day and the employee's own
-- daily_start_time/daily_end_time shift length, rounded to the nearest 10). Storing the
-- typed daily amount separately means editing an employee always shows exactly what was
-- entered, instead of a value re-derived from the rounded hourly rate.
alter table employees add column salary_per_day numeric(10, 2) not null default 0;
