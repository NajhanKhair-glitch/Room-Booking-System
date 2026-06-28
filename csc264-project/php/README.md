# BSU Space Booking System

## Overview

A web-based facility-booking portal for UiTM Kampus Tapah. Students request bookings;
moderators/admins approve, reject, or cancel them. The frontend is plain HTML/CSS/JS;
the backend is PHP + MySQL on XAMPP.

## File Structure

```
csc264-project/
├── source/
│   ├── login_page.html            # Login (real session auth)
│   ├── user_dashboard.html        # Student dashboard
│   ├── admin_dashboard.html       # Moderator/Admin dashboard
│   └── sso_login_page.html        # (placeholder - not wired)
├── css/
│   ├── login_styles.css
│   ├── user_dashboard_styles.css
│   └── admin_dashboard_styles.css
├── js/
│   ├── login_script.js
│   ├── user_dashboard_script.js
│   └── admin_dashboard_script.js
└── php/
    ├── db_config.php              # DB connection & query helpers
    ├── database_schema.sql        # Schema + seed data
    ├── setup.php                  # ONE-TIME password hashing
    ├── tests.php                  # Smoke-test runner (browse to it)
    ├── auth.php                   # login / logout / session
    ├── user_profile.php           # /me + profile update
    ├── user_bookings.php          # student booking ops
    ├── user_spaces.php            # space lookups + schedule search + clash preview
    ├── admin_bookings.php         # admin booking ops + dashboard stats
    ├── admin_spaces.php           # admin space CRUD
    ├── admin_users.php            # admin user CRUD (Admin role only)
    └── analytics.php              # calculations: reports, peak hours, top spaces, student stats
```

## First-Time Setup

1. **Start XAMPP** — Apache + MySQL must both be running.

2. **Create the database** — open `http://localhost/phpmyadmin`, click *Import*,
   and import `php/database_schema.sql`. This creates the `bsu_space_booking`
   database and seeds it with sample spaces and users.

3. **Hash the seed passwords** (the schema ships with placeholder hashes that
   won't match anything). Browse to:
   ```
   http://localhost/csc264-project/php/setup.php
   ```
   You should see a green success table. After it runs you can delete `setup.php`.

4. **Log in** at `http://localhost/csc264-project/source/login_page.html`.

   | Role      | Email                              | Password    |
   |-----------|------------------------------------|-------------|
   | Student   | 2024220654@student.uitm.edu.my     | Student@123 |
   | Moderator | nursyalin@uitm.edu.my              | Mod@123     |
   | Moderator | mior@uitm.edu.my                   | Mod@123     |
   | Admin     | admin@bsu.uitm.edu.my              | Admin@123   |

   Students are redirected to `user_dashboard.html`; Moderators and Admins are
   redirected to `admin_dashboard.html`.

## How It Works

- **Sessions** live in PHP sessions (`HttpOnly` cookie). Every protected endpoint
  calls `requireLogin()` or `requireRole([...])` in `auth.php`. JS uses
  `fetch(..., { credentials: 'same-origin' })` so the cookie is included.
- **All data comes from the database.** The JS files have no hardcoded arrays —
  on load, they call PHP endpoints and render whatever the DB returns.
- **Booking conflict detection** runs in `user_bookings.php?action=submit_booking`.
  An existing Pending/Approved/In-Progress booking on the same space with an
  overlapping date (and time, if provided) causes the request to be rejected.
- **Admin audit log** — every approve/reject/cancel/delete by an admin writes a
  row to `admin_logs` (see `logAdminAction()` in `auth.php`).

## API Quick Reference

All endpoints return `{ success, message, data }` JSON.
`POST` endpoints accept JSON body; `GET` endpoints take query params.

### `auth.php`
| Action            | Method | Notes                                  |
|-------------------|--------|----------------------------------------|
| `login`           | POST   | body: `{email, password}` → role-based redirect path |
| `logout`          | POST   | destroys session                       |
| `session`         | GET    | returns current user, 401 if not in   |
| `change_password` | POST   | body: `{old_password, new_password}`   |

### `user_profile.php`
| Action  | Method | Notes                              |
|---------|--------|------------------------------------|
| `me`    | GET    | current user + initials            |
| `update`| POST   | phone/campus/faculty/program       |

### `user_bookings.php`
| Action                | Method | Notes                                 |
|-----------------------|--------|---------------------------------------|
| `get_my_bookings`     | GET    | own bookings                          |
| `get_dashboard_stats` | GET    | totals for stat cards                 |
| `get_calendar_events` | GET    | own bookings for calendar dots        |
| `submit_booking`      | POST   | server-side validation + conflict check |
| `cancel_booking`      | POST   | own Pending / Approved / In Progress  |
| `get_booking_detail`  | GET    | one row (own, or any if admin)        |

### `user_spaces.php`
| Action            | Method | Notes                                |
|-------------------|--------|--------------------------------------|
| `get_spaces`      | GET    | active spaces, optional `category`   |
| `get_categories`  | GET    | distinct categories                  |
| `get_space_names` | GET    | spaces in a category                 |
| `get_schedule`    | GET    | bookings for one space + date range  |
| `search_schedule` | GET    | grouped by space, used by Calendar page |

### `admin_bookings.php` (Moderator/Admin)
| Action                  | Method | Notes                                 |
|-------------------------|--------|---------------------------------------|
| `get_booking_requests`  | GET    | bookings with `status='Pending'`      |
| `get_all_bookings`      | GET    | any status                            |
| `approve_request`       | POST   | sets `Approved`, writes admin log     |
| `reject_request`        | POST   | sets `Rejected` with reason           |
| `cancel_booking`        | POST   | admin-side cancel                     |
| `get_dashboard_stats`   | GET    | counts for the admin overview         |
| `get_calendar_events`   | GET    | every active booking, for cal dots    |

### `admin_spaces.php` (Moderator/Admin)
| Action          | Method | Notes                                 |
|-----------------|--------|---------------------------------------|
| `get_spaces`    | GET    | all (inactive too)                    |
| `add_space`     | POST   | rejects duplicate `space_code`        |
| `edit_space`    | POST   | partial updates                       |
| `delete_space`  | POST   | refuses if active bookings exist      |
| `toggle_active` | POST   | soft-deactivate                       |

### `admin_users.php` (Admin only)
| Action          | Method | Notes                                 |
|-----------------|--------|---------------------------------------|
| `get_users`     | GET    | all                                   |
| `add_user`      | POST   | hashes password, rejects duplicates   |
| `edit_user`     | POST   | partial; password optional            |
| `delete_user`   | POST   | refuses last admin / yourself         |
| `change_role`   | POST   | Student/Moderator/Admin               |
| `change_status` | POST   | Active/Inactive                       |

### `analytics.php` (calculation endpoints)
| Action                | Auth                | Notes |
|-----------------------|---------------------|-------|
| `admin_rich_stats`    | Moderator/Admin     | KPI numbers for the admin dashboard cards |
| `admin_overview`      | Moderator/Admin     | Approval %, by-category, monthly trend, averages |
| `space_utilization`   | Moderator/Admin     | Top + bottom spaces by hours and `utilization_pct` (last N days) |
| `peak_hours`          | Moderator/Admin     | 24-bucket histogram of start-time |
| `top_applicants`      | Moderator/Admin     | Top 10 students by booking count |
| `activity_log`        | Moderator/Admin     | Last N rows from `admin_logs` |
| `student_rich_stats`  | Any logged-in user  | Stat-card numbers for the student dashboard |
| `student_stats`       | Any logged-in user  | Calculations: approval rate, total hours, avg lead, capacity %, favourite category |

### `user_spaces.php?action=clash_preview` (new)
Returns `{ has_clash, reservations: [...] }` for the proposed space/date(/time) so the
student gets a real-time warning *before* submitting.

## Calculations & Formulas

All calculations are pure SQL aggregations in `analytics.php`:

- **Booking minutes** — see `bookingMinutesSql()`. Uses `TIMESTAMPDIFF(MINUTE, ...)`
  on combined `start_date + start_time`. Falls back to 8 hours/day when times are
  null.
- **Utilization %** — `used_minutes / (days × 10 hours × 60) × 100`. Assumes a
  10-hour operating window per day per space.
- **Approval rate** — `approved / (approved + rejected) × 100`. Excludes Pending,
  Cancelled, and In Progress from the denominator since they haven't been "reviewed".
- **Average lead days** — `AVG(DATEDIFF(start_date, applied_date))`.
- **Average capacity usage** — `AVG(total_participants / seating_capacity) × 100`,
  with `NULLIF` to skip spaces of capacity 0.
- **Peak hours** — `COUNT(*) GROUP BY HOUR(start_time)`; missing hours zero-filled.
- **Monthly trend** — `COUNT(*) GROUP BY DATE_FORMAT(applied_date,'%Y-%m')` over
  the last 12 months.

## Testing

A simple smoke-test runner lives at `php/tests.php`. Browse to it:

```
http://localhost/csc264-project/php/tests.php
```

It checks: database connection, schema presence, seed data, password hashing,
the SQL underlying booking conflict detection, and that protected JSON endpoints
return HTTP 401 to unauthenticated requests. Re-run after schema changes.

## Security Notes

- Passwords hashed with `password_hash(..., PASSWORD_DEFAULT)` (bcrypt).
- All queries use prepared statements (`mysqli`).
- Session cookie is `HttpOnly` + `SameSite=Lax`.
- Session ID rotates on successful login (`session_regenerate_id`).
- Role gating: `requireRole(['Admin'])` enforces server-side, not just client-side.
- No HTML escaping is applied to user input on the server because all output is
  JSON; the frontend renders into `innerHTML` so be careful if you ever surface
  user-controlled strings unescaped (the current code paths embed values that
  came from controlled enums or that the user owns).

## Troubleshooting

- **Login always says "Invalid credentials"** → you forgot to run `php/setup.php`.
- **API calls return 401 then redirect to login** → session expired; just log in again.
- **"Database connection error"** → check XAMPP MySQL is running, and that the
  `bsu_space_booking` DB exists with no MySQL root password (or update `db_config.php`).
- **"Booking conflict with existing reservation…"** → working as intended;
  pick a different space or time.
