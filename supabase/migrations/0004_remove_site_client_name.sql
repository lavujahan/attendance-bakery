-- Drops "Client Name" -- no longer captured on sites/mappings.
alter table sites drop column client_name;
alter table employee_site_mappings drop column client_name;

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
        (group_id, employee_id, employee_code, employee_name, site_id, site_code, site_name, from_date, to_date, status)
      select p_group_id, e.id, e.employee_code, e.employee_name, s.id, s.site_code, s.site_name, p_from_date, p_to_date, p_status
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
        (group_id, employee_id, employee_code, employee_name, site_id, site_code, site_name, from_date, to_date, status)
      select p_group_id, e.id, e.employee_code, e.employee_name, s.id, s.site_code, s.site_name, p_from_date, p_to_date, p_status
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
