# attendance-v2 — local setup (fresh Supabase project)

Full rewrite of the attendance admin + kiosk, with face verification designed in from
the start (not retrofitted). Has no local database — points at its own live Supabase
project (`acounzqkrcbfysujuwwv.supabase.co`), separate from `attendance_updated-main`'s
project.

## 1. Prerequisites

- Node.js 18.18+ or 20+ (Next.js 16).
- `face-service` running and reachable (see `../Insightface/face-service/SETUP.md`) --
  it's been repointed at this project's Supabase project (see `face-service/.env`), so
  it now serves attendance-v2, not attendance_updated-main.
- Outbound access to `acounzqkrcbfysujuwwv.supabase.co`. **Blocked on this project's dev
  machine** (same DNS/proxy-level block on `supabase.co` seen for the other project) --
  applying the migration and the live-DB smoke test both need a different network.

## 2. Environment

`.env.local` already has real values for the new project (URL/anon/service-role keys)
plus `FACE_SERVICE_URL`/`FACE_SERVICE_API_KEY` matching `face-service/.env`. Nothing to
fill in unless you rotate keys.

```
npm install
```

## 3. Apply the schema

One migration, `supabase/migrations/0001_init.sql` -- run its contents in the Supabase
Dashboard SQL Editor for the new project. It creates every table fresh (`employees`
with `daily_start_time`/`face_enrolled`, `sites`, `employee_site_mappings`,
`face_embeddings`, `attendance` with the `check_in/out_face_status` enum,
`admin_profiles`), the batch-assignment RPCs, and RLS policies.

## 4. Create the first admin user

No default admin is seeded. Run once:

```
NEXT_PUBLIC_SUPABASE_URL=<from .env.local> SUPABASE_SERVICE_ROLE_KEY=<from .env.local> \
  node scripts/bootstrap-admin.mjs <username> <password>
```

## 5. Run it
npm run de
```
npm run dev
```

- Kiosk: http://localhost:3000/attendance (no login -- runs entirely through
  server-side service-role actions, gate-checked before any GPS/camera prompt: employee
  active → face enrolled → site assignment for today, in that order).
- Admin: http://localhost:3000/dashboard (redirects to `/admin-login` until you sign in
  with the account from step 4).

## 6. Smoke test (needs face-service + Supabase reachable)

1. Dashboard → Employees → add a test employee, then capture all 4 "Enroll Face" shots.
   Confirm `employees.face_enrolled` flips to `true` only after the 4th accepted shot.
2. Dashboard → Sites → add a site, capturing GPS via the browser.
3. Dashboard → Employee Mapping → assign the test employee to that site for today.
4. Kiosk: check in as that employee with their own face -- confirm it succeeds before
   ever prompting for GPS/camera if any earlier gate would have failed (test by trying
   an unenrolled or unassigned employee ID first -- should fail immediately with a
   specific message, no permission prompts).
5. Check in with a different face -- attendance still recorded (fail-open),
   `check_in_face_status = 'unverified'`.
6. Stop `face-service` and try another check-in -- attendance still recorded,
   `check_in_face_status = 'service_error'` (distinct from `unverified`).
7. Attendance Management / Reports: confirm both `unverified` and `service_error` rows
   are visible and independently filterable.
