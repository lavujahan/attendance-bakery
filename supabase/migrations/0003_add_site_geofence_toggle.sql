-- Adds a per-site toggle for GPS geofence enforcement at kiosk check-in/out.
alter table sites
  add column geofence_enabled boolean not null default true; -- per-site GPS geofence enforcement at kiosk check-in/out
