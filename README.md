# Shree Aditya Geo Tech — SAGT - Verify UI bundle

This is the static HTML dashboard and invoice/survey editors, prepared for the **new** Supabase project named `SAGT - Verify`. The ZIP does not contain secrets or change any hosted project automatically.

## Current status

- UI and editor source retained.
- `supabase-config.js` is configured for the confirmed `SAGT - Verify` project URL and its public publishable key. Public keys are designed for frontend use; RLS is mandatory.
- SQL setup files are provided for review and manual execution in the **SAGT - Verify** project only.
- The project URL and publishable key were retrieved from the connected Supabase project (ref `gewvwdfolaaipkpbqpmr`). Live browser login, cloud save, Edge Function deployment, and end-to-end RLS behavior still require testing.

## Your steps (beginner-friendly)

### 1. Configure the public connection

1. Open the `SAGT - Verify` project in the Supabase dashboard.
2. Copy the **Project URL** from Connect / API settings.
3. Copy the **publishable key** (`sb_publishable_...`) from Settings → API Keys. A legacy `anon` public key is acceptable if that is what your project provides.
4. Edit `supabase-config.js` and replace the two placeholder values.
5. Never put a `service_role` or `sb_secret_...` key in browser code or this ZIP.

### 2. Install the schema and security policies

1. In Supabase, confirm the project selector says **SAGT - Verify** (not `sagt-bms`).
2. Open SQL Editor → New query.
3. Open `001_sagt_verify_schema.sql` from this ZIP, copy all of it into the SQL editor, and inspect it before running.
4. Click Run. If any error appears, stop and send a screenshot; do not run the next script until resolved.

This creates `profiles` and `documents`, least-privilege profiles for new Auth users, role/module checks, and RLS policies. The initial setup is tailored to the current dashboard's column usage. Review the schema against business requirements before adding production data.

### 3. Promote the existing owner account to admin

1. In the same project SQL Editor, open a New query.
2. Copy `002_promote_initial_admin.sql` into the editor.
3. Confirm the email in the script is exactly `shreeaditya2025@gmail.com`.
4. Click Run and check that the result shows one row with role `admin` and all four module permission flags `true`.
5. If the result is empty, the Auth user does not exist in this project under that exact email. Stop and verify Authentication → Users before proceeding.

This promotion script runs with SQL Editor privileges; never expose the database password or a service-role key. The `bootstrap_initial_admin()` RPC is also restricted to the exact initial owner email.

### 4. Configure Auth

In Authentication settings, review allowed redirect URLs for your local and production URLs. Use email/password sign-in, enable email confirmation according to your company policy, and configure SMTP before relying on production email delivery. Do not enable public self-sign-up unless you intend to allow it.

### 5. Run the UI locally

Serve this folder over HTTP (not `file://`):

```bash
python -m http.server 8080
```

Open `http://localhost:8080`. Test sign-in, sign-out, profile load, module permissions, and cloud saves. The existing save integration inserts new drafts; edit/reopen/update workflows must be tested and may require additional implementation before production.

## Security notes

- The frontend key is public; RLS is mandatory.
- UI permission checks are not a security boundary. RLS policies are the database boundary.
- The setup grants the initial administrator all invoice and survey permissions. New users receive no module permissions by default.
- Do not disable RLS to resolve errors. Review the policies and test with separate admin and employee accounts.
- Do not expose service-role/secret keys, passwords, or real client records in screenshots or chat.
- The supplied SQL is a starting migration for this current UI, not a comprehensive ERP schema or independent security certification. Test on a fresh project, inspect errors, and obtain review before production data is entered.

## Files

- `index.html` — responsive dashboard/login shell
- `invoice-editor.html` — invoice and quotation editor
- `survey-editor.html` — survey report editor
- `supabase-config.js` — public Supabase URL and key placeholders
- `001_sagt_verify_schema.sql` — initial schema and RLS policies
- `002_promote_initial_admin.sql` — narrowly scoped promotion for the named Auth account

## Employee management and navigation permissions (added)

The admin-only Team permissions page now supports invitation requests, per-navigation visibility, module view/edit flags, and employee deactivation/reactivation. Deactivation is preferred over hard deletion to preserve document history. An employee cannot deactivate their own account, and admin accounts cannot be deactivated from this screen.

### Install the employee-permissions migration

1. Confirm the Supabase project selector says **SAGT - Verify**.
2. Run `003_employee_navigation_permissions.sql` in SQL Editor after reviewing it.
3. The migration adds `nav_dashboard` and `is_active`, updates access helper functions so inactive users cannot access documents, and creates an admin-readable audit table.
4. The migration does not alter `sagt-bms` and does not create or change an Auth password.

### Deploy the trusted Edge Function before inviting or deactivating users

The function source is at `supabase/functions/admin-employee-management/index.ts`. It uses Supabase Auth to identify the caller, checks the caller's active admin profile, and keeps the service-role key server-side. **Never put `SUPABASE_SERVICE_ROLE_KEY` in `supabase-config.js` or any browser file.**

From a computer with the Supabase CLI installed and authenticated to the correct project, deploy the function to the `SAGT - Verify` project. Ensure the project's standard Edge Function secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are configured server-side by Supabase. Set CORS to your actual production origin before production deployment; the included permissive CORS header is not an origin allowlist, although each action still requires a valid authenticated admin session.

The UI uses `supabase.functions.invoke('admin-employee-management', ...)`. Until the function is deployed and tested, invite/deactivate/reactivate actions will fail safely and show an error. New employees receive no invoice or survey permissions by default. The admin must explicitly enable the required navigation and view/edit rights.

### Security and verification limits

- Navigation visibility is a usability feature; database RLS and protected functions are the actual security boundary.
- The SQL migration must be applied before the new UI fields will load.
- Edge Function deployment and live end-to-end tests have not been performed by this ZIP build. Verify invite email delivery, RLS under a non-admin account, deactivation of an existing session, and document access before production use.
- Deactivation bans Auth sign-in and marks the profile inactive. Already-open browser tabs may remain visible until their next server request/session refresh, but the updated RLS helpers deny further document access.
- No hard-delete control is exposed; preserve business records and use deactivation for offboarding.


## Follow-up security hardening (004)

The connected `SAGT - Verify` project has had the equivalent security-grant hardening applied successfully, and the three foreign-key indexes have been added. The `004_security_hardening.sql` file records these changes for reproducibility; it is idempotent and may be run again after review. It revokes browser RPC execution from the maintenance helper `rls_auto_enable()` (if present), disables further browser execution of the one-time bootstrap function, preserves authenticated execution of the two RLS helper functions used by database policies, and adds indexes for the documents/audit foreign keys.

## Edge Function CORS and deployment

The employee-management Edge Function now uses a server-side `SAGT_ALLOWED_ORIGINS` comma-separated allowlist. Before production deployment, set it to the exact origin(s) serving the app, for example `https://your-domain.example`; for local testing, include `http://localhost:8080` if needed. Do not leave localhost in the production allowlist unless you specifically need it. Set secrets through Supabase Edge Function secrets, not browser code. The function uses the service-role key only server-side.

## Additional dashboard security

Supabase's security advisor reported leaked-password protection disabled. Enable it in Authentication → Password Security before production. Re-run Supabase Security and Performance Advisors after applying migrations. The advisor also flags security-definer RLS helper functions as callable by authenticated users; this is expected only because RLS invokes these helpers, and their bodies must remain narrowly scoped to `auth.uid()` and active profile permissions.

## Honest production status

This archive has been source-reviewed; JavaScript syntax checks and ZIP integrity checks are performed at packaging time. It is not certified production-ready until migration `004` is reviewed/applied, the Edge Function is deployed with an exact origin allowlist, leaked-password protection is enabled, email/redirect settings are configured, and tests pass using separate admin and restricted employee accounts. Document saving currently creates drafts; full update/reopen workflows should be tested and completed before business-critical use.


## Deployment status note (updated)
The `admin-employee-management` Edge Function source is included at
`supabase/functions/admin-employee-management/index.ts`, with shared CORS code at
`supabase/functions/_shared/cors.ts`. The function was deployed to the Supabase
project `gewvwdfolaaipkpbqpmr` (`SAGT - Verify`) during the setup conversation.
This ZIP does not deploy or change any hosted project by itself.

Invitation delivery and the full end-to-end workflow have not yet been verified.
Before relying on it, test invitations with an authorized test email, confirm
the function's logs, and test with an administrator and a restricted employee.
Configure `SAGT_ALLOWED_ORIGINS` as a server-side Edge Function secret using the
exact site origin(s) before production use. Never put service-role/secret keys
in browser files or share them in chat.

## Invite form runtime fix (v2)
The invite submit handler captures the form reference before awaiting the Edge Function. This avoids `e.currentTarget` becoming `null` after the async event handler yields, which caused `Invite failed: can't access property "reset", e.currentTarget is null`. Replace the local website files with this archive, then refresh the page. This UI fix does not itself prove email delivery; retest the invite and check Edge Function logs for any remaining server-side issue.

## Final bundle status (16 October 2026)

- This bundle includes the corrected invite form handler, which keeps a stable form reference and does not rely on `event.currentTarget` after an asynchronous operation.
- The `admin-employee-management` Edge Function source and shared CORS file are included. The function was previously deployed to the `SAGT - Verify` project (`gewvwdfolaaipkpbqpmr`) during setup; this ZIP does not deploy code or modify the hosted database.
- The user reports that custom SMTP settings were saved in Supabase. SMTP delivery and the complete employee invitation flow have **not yet been verified end-to-end**.
- After replacing the local files, serve the folder over HTTP (for example, `npx -y http-server -p 8080`) and open `http://localhost:8080`. Do not open `index.html` directly with a `file://` URL.
- If an invitation still fails, inspect the latest Edge Function invocation/log and use the specific returned error. Do not repeatedly retry invitations or expose SMTP/app passwords.
- Never place a service-role/secret API key, SMTP password, or Google App Password in browser files or the ZIP.

## Business module navigation and permissions (migration 005)

The dashboard now includes navigation for Client & Project Payments, Attendance, Leave, Holidays, Flat Expense, Office Expense, Payroll, and Payslip. The Team permissions screen provides Show, View, and Edit controls for these modules.

**Database migration required:** review and apply `005_business_module_navigation_permissions.sql` in the SQL Editor for the **SAGT - Verify** project only. This adds permission columns and the `sagt_can_navigate_module()` helper. New employee permissions default to denied. Payroll is restricted to administrator accounts in this two-role profile model; do not grant employee payroll access through direct SQL.

**Scope limitation:** these are navigation and permission controls plus placeholder module workspaces. The module-specific business tables, forms, approvals, calculations, exports, and RLS policies for actual records are not included yet. Do not treat the modules as ready to store live attendance, expenses, payments, payroll, or payslip data. Apply the migration before opening the revised UI; otherwise profile permission updates may report missing-column errors. The migration has been packaged but has not been applied to the hosted project by this ZIP operation.

## Attendance and leave workflows (migration 006)

This revision adds:
- **Leave:** employees submit leave requests with type, dates and reason; active administrators can approve or reject pending requests and record an optional note.
- **Attendance:** employees with attendance edit permission use Check in / Check out. The database records the event time using server time and company date in `Asia/Kolkata`; duplicate check-ins are rejected and check-out requires check-in.
- **Forgotten attendance correction:** employees submit a correction request with date, missed check-in/out type, requested times and reason. Only an active administrator can approve/reject. An approved correction updates/creates the attendance record.

Before testing, review and run `006_attendance_leave_workflows.sql` in SQL Editor for **SAGT - Verify** only. The migration has not been applied to the hosted database by this ZIP operation. Keep RLS enabled. Grant the employee `Show`, `View`, and `Edit` for Attendance and/or Leave in Team permissions as needed; employees default to no access. The approval RPC verifies active admin status server-side.

This implements the first attendance/leave workflow slice. It does not yet include holiday-aware payable days, 8-hour/4-hour day classification, overtime, device/location verification, payroll linkage, email notifications, or full audit/report exports. Those need a separate implementation and tests before production use.

## Automatic daily/monthly payroll and payslips (migration 007)

This revision adds `007_automatic_payroll.sql` and a Payroll/Payslip workspace. **The migration is bundled but has NOT been applied to the hosted Supabase project.** Run it only in the **SAGT - Verify** project after reviewing and backing up; never run it in `sagt-bms`.

- Admin can save per-employee monthly salary, fixed monthly deduction, one-time/additional monthly pay, overtime hourly rate, and monthly advance repayment.
- Admin can calculate/regenerate a monthly draft for all active employee profiles. By default, the UI opens the previous month, matching the intended draft-on-the-1st workflow; this ZIP does not create a scheduled server job, so an administrator must trigger calculation unless a scheduled Supabase job is separately configured.
- Daily rows show working day, Sunday/holiday, attendance state, payable fraction, overtime, and absence/unpaid-leave deduction. Sundays and dates in `company_holidays` are excluded from the month's working-day denominator. Approved `unpaid` leave is deducted; approved other leave is treated as paid leave. Missing attendance is treated as absent; check-in without check-out is marked pending and blocks finalization.
- Admin can finalize a month; finalized monthly records are skipped by later draft regeneration. Employees can read only their own payroll summary and daily details through RLS; administrators can read all employees' payroll.
- The payroll migration assumes migrations 001–006 are already reviewed/applied and the existing `profiles.is_active`, business-module helpers, attendance table, and leave table exist.

**Important scope limitations before production:** this first payroll workflow does not yet implement an advance ledger, approved post-finalization adjustment runs, partial-month joining/exit calculations, payslip PDF/email delivery, statutory deductions/GST, or an automatic scheduled job. Salary settings and attendance/leave inputs must be verified by the administrator. It has not been live-tested against the hosted database; run test cases with a separate admin and employee account before using real payroll data.
