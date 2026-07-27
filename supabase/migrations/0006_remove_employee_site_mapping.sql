-- Removes the Employee Site Mapping feature entirely -- employees now carry a
-- direct site_id instead of a date-ranged assignment in its own table.
drop function if exists save_employee_site_mappings(uuid, uuid, date, date, text, uuid[]);
drop function if exists update_employee_site_mappings(uuid, uuid, date, date, text, uuid[]);

-- Dropping the table cascades to its RLS policy (admin_all_mappings), indexes,
-- trigger, the EXCLUDE constraint, and its supabase_realtime publication
-- membership -- no separate cleanup statements needed for those.
drop table if exists employee_site_mappings;

-- Nullable + ON DELETE SET NULL (not CASCADE): deleting a site must clear the
-- employee's site, never delete the employee.
alter table employees add column site_id uuid references sites(id) on delete set null;
create index idx_employees_site_id on employees (site_id);
