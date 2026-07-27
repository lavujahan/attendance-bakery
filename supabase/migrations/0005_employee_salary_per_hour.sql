-- Drops the employee email field (unused beyond the Add Employee form) and adds an
-- hourly salary rate captured on that same form.
alter table employees drop column email;
alter table employees add column salary_per_hour numeric(10, 2) not null default 0;
