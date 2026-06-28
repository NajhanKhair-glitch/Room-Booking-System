# RBS Future Improvements And Publishing Guide

This note is for the Room Booking System at UiTM Cawangan Perak, Kampus Tapah. It focuses on how to make the system feel more detailed, cleaner, smoother and ready for public access.

## 1. Visual And UX Improvements

### Design system

- Create one shared style guide for colors, typography, spacing, buttons, cards, forms, tables, badges and modal layouts.
- Keep the RBS logo consistent across landing, login, SSO, student dashboard, admin dashboard, receipts and printable reports.
- Use the same page rhythm everywhere: header, toolbar, content area, empty state, action area and footer.
- Reduce overly large shadows and mixed border radiuses so the interface feels more premium and easier to scan.
- Standardize icons. Use the same icon style for dashboard navigation, buttons and status messages.

### Landing page

- Keep the first screen focused on the product name, real campus space imagery and the main booking action.
- Show the product flow directly on the page: search, check availability, reserve, pay and approval.
- Use real room photos where possible because facility users need confidence in the actual space.
- Add strong trust sections: availability, payment, approval, receipts and admin monitoring.
- Keep mobile layouts simple: one main call to action, stacked booking fields and readable cards.

### Dashboard experience

- Add polished empty states for no bookings, no spaces, no search results and no notifications.
- Add clearer loading states for API requests, table refresh and payment redirects.
- Use status timelines for each booking: Submitted, Pending Review, Approved, Paid, Completed or Cancelled.
- Add quick filters for upcoming bookings, pending requests, paid bookings and rejected bookings.
- Add confirmation dialogs for destructive admin actions such as reject, delete or deactivate.

## 2. Feature Improvements

### Booking features

- Recurring bookings for weekly classes or repeated events.
- Booking clash explanations that show exactly which date and time is unavailable.
- Capacity validation based on selected room maximum.
- Attachment upload for event letters, approval forms or supporting documents.
- Cancellation and refund policy handling with clear deadlines.

### Notification features

- Email notification for submitted, approved, rejected and paid bookings.
- In-app notification history instead of temporary alerts only.
- Reminder notifications before an approved booking starts.
- Admin notification when a pending request has waited too long.

### Admin features

- Role-based permissions for Admin, Moderator, Staff and Student.
- Room utilization report with date filters, category filters and export to PDF or CSV.
- Audit log for approval, rejection, edits, payment status updates and user management.
- Room maintenance mode so a facility can be blocked for repairs.
- Bulk import for rooms, users and schedules.

### Payment and receipt features

- Payment status sync from ToyyibPay callback and manual admin verification fallback.
- Printable receipt with the RBS logo, reference number, applicant details and approval status.
- Payment retry for failed or expired payment attempts.
- Staff-free booking reason shown in payment summary.

## 3. Technical Improvements

### Security

- Move database credentials and payment credentials into environment variables on the server.
- Force HTTPS in production.
- Add CSRF protection for state-changing forms.
- Validate and sanitize all server inputs, especially admin edit forms.
- Add rate limiting to login, signup, password reset and payment endpoints.
- Hide demo accounts on production.

### Performance

- Compress and resize room photos for the web.
- Add browser cache headers for CSS, JS and image assets.
- Minify CSS and JS for production.
- Paginate large admin tables from the backend instead of loading everything at once.
- Add indexes to frequently filtered database columns such as date, status, user ID and space ID.

### Reliability

- Add a production error log location outside the public web root.
- Add database backup schedule.
- Add health checks for database, payment callback and email sending.
- Add test data reset scripts for demo or presentation use.
- Keep deployment instructions in the repository so setup can be repeated.

## 4. Publishing The System

This project is a PHP and MySQL system, so the simplest publishing route is:

1. Buy shared hosting or a VPS that supports Apache, PHP and MySQL.
2. Upload the project files to the public web directory, usually `public_html` or `/var/www/html`.
3. Create a MySQL database on the host.
4. Import the current database schema and data from `php/db.sql` or an exported copy from phpMyAdmin.
5. Update `php/db_config.php` with the production database host, username, password and database name.
6. Configure ToyyibPay production credentials if real payment is required.
7. Enable HTTPS using the hosting SSL tool or Let's Encrypt.
8. Test public URLs for landing, login, signup, booking, admin approval, payment and receipt.
9. Remove demo credentials and any test-only notes before sharing publicly.

## 5. Recommended Hosting Options

### Easiest for a student project

Use shared hosting with cPanel, Apache, PHP and MySQL. This is the fastest option because it is similar to XAMPP and usually includes phpMyAdmin.

### More professional

Use a VPS such as Ubuntu with Apache or Nginx, PHP-FPM and MySQL/MariaDB. This gives more control but requires server setup and maintenance.

### Not ideal without changes

Static hosting such as GitHub Pages, Netlify or Vercel alone will not run the PHP backend. You would need to rewrite the backend as an API or host the PHP backend somewhere else.

## 6. Production Checklist

- Domain connected.
- HTTPS enabled.
- Database imported.
- `db_config.php` updated.
- File permissions checked.
- Demo accounts removed or disabled.
- Payment gateway tested.
- Email sending tested.
- Admin account created with strong password.
- Error display disabled in production.
- Backups enabled.
- Landing page tested on desktop and mobile.

