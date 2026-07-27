-- Short 2-digit kiosk login code, replacing the phone-number-derived
-- phone_prefix. NO CYCLE means nextval() raises once past 99 (SQLSTATE
-- 2200H), giving a natural "range exhausted" failure instead of silent
-- reuse or overflow -- caught and turned into a friendly message in
-- employee.service.ts's addEmployee.
create sequence if not exists employee_serial_no_seq start 11 minvalue 11 maxvalue 99 no cycle;

alter table employees add column serial_no integer not null unique default nextval('employee_serial_no_seq');
alter sequence employee_serial_no_seq owned by employees.serial_no;
