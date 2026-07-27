# Admin Module — Quick Reference

A short guide to the admin dashboard for bakery/office staff. This does not cover the employee check-in kiosk.

## 1. Admin Login (`/admin-login`)
Sign in to the dashboard.

- Enter your **Username** and **Password**, then click **Login**.
- Login is by username, not email.
- **Good to know:** the error message doesn't say whether the username or password was wrong — double-check both.

## 2. Dashboard
Your home screen — a live snapshot of today's attendance.

- Use the **Godown** dropdown to view all godowns or just one.
- Five tiles: Total Employees, Present Today, Absent Today, Late Arrivals, Early Leavers.
- Click any tile to jump into **Reports**, already filtered to that category for today.
- Updates automatically — no need to refresh the page.
- **Good to know:** only Active employees who are assigned to a godown count toward Present/Absent. A 10-minute grace period applies before someone is marked Late or an Early Leaver.

## 3. Godowns
Manage your godown/branch locations.

- **Add Godown**: enter Godown Name, Godown Incharge, and Status (Active/Inactive), then save.
- Use **Edit** or **Delete** on any row. Use the search box to find one by code, name, or incharge.
- **Good to know:** GPS/location fields are no longer part of this form — godowns are tracked by name only, not by map location.
- Setting a godown to Inactive doesn't move its current employees, it just hides it from the godown dropdown when adding/editing employees.

## 4. Employees
Manage your employee roster and their face check-in setup.

- **Add Employee**: fill in Name, Mobile Number, Salary per Hour, Gender, Designation, Joining Date, Daily Mandatory Start/End Time, Godown, and Status, then save.
- Right after saving a new employee, you'll be prompted to **enroll their face** — 4 photos are captured one at a time for kiosk check-in. Follow the on-screen instructions if a shot is rejected (e.g. too blurry, face not straight, more than one face).
- Use **Edit** to update details, or the **Enroll Face** / **Re-enroll Face** button to (re-)do face setup any time.
- Use **Delete** to remove an employee permanently — this also removes their face data.
- Use the search box or **Download PDF** to export the current employee list.
- **Good to know:** Godown is required — an employee can't be saved without one, and only Active godowns appear in the dropdown. Marking an employee Inactive automatically clears their face enrollment.

## 5. Attendance Management
Review and correct attendance for a single day.

- Filter by Employee, Godown, Date (defaults to today), and Status.
- Every assigned employee for that date is listed, even ones with no check-in yet (shown as "Absent — Not marked").
- Use **Edit** on a row to fix Check-In/Check-Out time, change the Status, or add a Remark.
- Use **Delete** to remove a record entirely.
- **Good to know:** you can only edit or delete a row that already has a record — there's no way to manually add a brand-new attendance entry from this screen.

## 6. Reports
Bulk reporting and exporting across any date range.

- Choose a **Report Type** (All Records, Employee-wise, Godown-wise, Late Arrival, Early Leaver, Absent, Present).
- Use the filter panel for Employee, Godown, Face Status, Start/End Date, or a text search.
- Click **Export Excel** or **Export PDF** to download exactly what's shown on screen.
- **Good to know:** exports only include the rows currently matching your filters, not your whole history.

## 7. Settings
Manage your own login.

- **Change Username**: enter a new username (4–30 characters) and click **Save Username**.
- **Change Password**: enter your current password, then a new password (6–50 characters) twice, and click **Save Password**.
- **Good to know:** you must enter your correct current password to change it — this only manages your own account, not other admins.
