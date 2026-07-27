-- All employees were cleared (data reset); serial_no_seq had advanced past its
-- start value. Rewind it so the next employee inserted gets serial_no = 11 again.
select setval('employee_serial_no_seq', 10, true);
