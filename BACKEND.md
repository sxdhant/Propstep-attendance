# Backend

The app is a Next.js frontend backed by route handlers (`app/api/**`) and PostgreSQL. The browser holds no data of its own: it fetches one snapshot from `/api/bootstrap`, and every change goes through an API that the server authorizes and validates.

## Running it

```bash
npm install
npm run db:dev            # local Postgres (embedded binaries, development only); leave it running
npm run db:migrate        # apply db/migrations/*.sql
npm run db:seed:demo      # development only: demo company, employees, attendance and payroll
npm run dev
```

Demo logins (dev seed only): admin `neha.kapoor@kestrel.example` / `Admin@123`; employees e.g. `aarav.sharma@kestrel.example` / `Employee@123`. These are on the common-password list on purpose, so they can never be chosen as a real password.

### Tests

```bash
npm test                   # unit tests: password policy, TOTP (RFC 6238 vectors), salary and attendance rules
npm run test:integration   # 24 end-to-end API tests against the running dev server and database
```

Integration tests create their own records and delete them afterwards; seeded data is never modified.

## Deploying to production

1. Provision a managed PostgreSQL such as Neon or Supabase (see below; backups and point-in-time recovery enabled).
2. Set the variables in [env.example](env.example): `DATABASE_URL`, `DATABASE_SSL`, `APP_URL`, `APP_ENCRYPTION_KEY`, and `RESEND_API_KEY` + `MAIL_FROM` for reset emails. Set `TRUST_PROXY=true` only behind a proxy you control.
3. `npm run build`. The build needs no secrets.
4. `npm run db:migrate`, then create the first administrator once: `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed`. They must change the password at first sign-in. Demo seeding is refused in production.
5. `npm start`, served over HTTPS (the session cookie is `Secure` and `__Host-` prefixed in production).
6. Schedule `npm run db:cleanup` daily, and point your uptime monitor at `GET /api/health`.

## Using Supabase or Neon

Both are plain managed PostgreSQL, so the app needs only a connection string. It talks to the database directly with `pg`; you do **not** use the Supabase client libraries, Supabase Auth, or Neon's data API. The app has its own sign-in.

**Neon**
1. Create a project and copy two connection strings from the dashboard: the **pooled** one (host contains `-pooler`) and the **direct** one.
2. App: `DATABASE_URL=<pooled>`, `DATABASE_SSL=true`. Migrations and seeding: `MIGRATE_DATABASE_URL=<direct>`.
3. A suspended Neon database wakes on the first request, which can take a few seconds (the pool allows 15).

**Supabase**
1. Project Settings, Database, Connection string. Use the **Transaction pooler** string (port 6543) for the app and the **Direct connection** (port 5432) or Session pooler for migrations.
2. App: `DATABASE_URL=<transaction pooler>`, `DATABASE_SSL=no-verify` (or `true` plus `DATABASE_SSL_CA` set to the CA certificate from the dashboard). Migrations: `MIGRATE_DATABASE_URL=<direct>`.
3. Migration `003_lock_down_public_access.sql` turns on row-level security for every table and removes the `anon` / `authenticated` privileges. Supabase otherwise exposes the `public` schema through its REST API, so this matters: never skip that migration, and never put the Supabase `anon` key in this app.

Then, for either: run `npm run db:migrate` and `npm run db:seed` (first admin), set `DATABASE_POOL_MAX=3` on serverless hosting such as Vercel, and keep backups and point-in-time recovery enabled in the provider's dashboard.

## Authentication and security

- **Passwords:** Argon2id (OWASP parameters). Policy (deliberately relaxed): 6 to 128 characters, nothing else.
- **Sessions:** 256-bit random token in an httpOnly, SameSite=Lax cookie; only its SHA-256 is stored. 7-day absolute and 12-hour idle expiry, maximum 5 devices, new token on every sign-in. Password change and reset revoke sessions; users can see and sign out their devices.
- **Brute force:** 5 failed attempts per email and 20 per IP per 15 minutes, counted for unknown emails too. Same error and same timing for a wrong password and an unknown email.
- **Two-factor (TOTP):** optional, strongly recommended for admins. Authenticator-app codes plus 8 single-use recovery codes. Secrets are AES-256-GCM encrypted at rest, codes cannot be replayed, and a pending sign-in is a 5-minute challenge that carries no session and locks after 5 wrong codes.
- **CSRF:** SameSite plus an Origin / Sec-Fetch-Site check on every state-changing endpoint.
- **Temporary passwords:** new employees, admin resets and the first admin must choose their own password before any other API works.
- **Password reset:** single-use, 60-minute, hashed tokens; identical response for known and unknown emails; success signs out everywhere. Admins can also issue a temporary password for an employee who cannot receive email.
- **Authorization:** every endpoint checks the role on the server. Employees only ever receive their own records, and never administrator identities.
- **Audit log:** sign-ins (success, failure, throttled), logouts, password and 2FA changes, employee changes, attendance decisions, settings, holidays and payroll. Readable by admins at `GET /api/audit`.
- **Headers:** Content-Security-Policy, HSTS, nosniff, frame deny, referrer and permissions policies; `X-Powered-By` removed. All SQL is parameterized.
- **Integrity:** attendance and payroll writes are transactional and row-locked. Check-in is atomic; finalizing payroll locks the month so a simultaneous approval cannot slip in after the snapshot. Finalized and paid months reject check-ins and reviews.

## Endpoints

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `POST /api/auth/login`, `/verify-totp`, `/logout` | public / signed in | Sign in (with optional second step) and out |
| `GET /api/auth/me` | signed in | Current user, `mustChangePassword`, `totpEnabled` |
| `POST /api/auth/change-password` | signed in | Change password; signs out other devices |
| `POST /api/auth/forgot-password`, `/reset-password` | public | Email reset flow |
| `GET/DELETE /api/auth/sessions` | signed in | List devices / sign one out |
| `POST /api/auth/totp/setup`, `/enable`, `/disable` | signed in | Two-factor enrollment |
| `GET /api/bootstrap` | signed in | One snapshot of everything the user may see |
| `GET/POST /api/employees` | admin | List / create (returns a one-time temporary password) |
| `GET/PATCH /api/employees/[id]` | admin (GET: self too) | Read / edit / deactivate |
| `POST /api/employees/[id]/reset-password` | admin | New temporary password, signs the employee out |
| `POST /api/employees/[id]/profile-reminder` | admin | Nudge an incomplete profile |
| `PUT /api/profile`, `POST /api/profile` | employee | Save a draft / validate and submit |
| `GET /api/attendance?month=` or `?date=` | signed in | Employees see their own; admins can add `&employeeId=` |
| `POST /api/attendance/check-in`, `/check-out` | employee | Server-clock times; atomic and race-safe |
| `POST /api/attendance/[id]/review` | admin | Approve / reject. An open check-in can be approved at once and then reads Present |
| `POST /api/attendance/backfill` | admin | Add attendance for past days (see below). `dryRun: true` previews without saving |
| `GET /api/payroll?year=&month=` | signed in | Admin: all lines. Employee: own line |
| `POST /api/payroll/generate`, `/finalize`, `/[id]/pay` | admin | Draft, lock and record payment |
| `PUT /api/settings/[section]` | admin | `company`, `attendance` or `salary` |
| `GET/POST/DELETE /api/holidays` | signed in / admin | List / add / remove |
| `GET/POST /api/notifications`, `POST /api/notifications/[id]` | signed in | List / mark read |
| `GET /api/audit` | admin | Security trail |
| `GET /api/health` | public | Liveness and database check |

## Adding past attendance (backfill)

For days before the app was in use. Admin screen: **Attendance, Add past attendance** (monthly grid or CSV import).

- **Only months listed in `BACKFILL_ALLOWED_MONTHS`** (`lib/backfill.ts`, currently `2026-10`) can be backfilled. To open or close a month, edit that list.
- **Rules (same in the browser preview and on the server):** not future dates, not before the employee's joining date or after deactivation, not weekly offs or holidays, nothing in a month whose payroll is finalized or paid, and a real check-in record is never overwritten.
- **Result:** each day is stored already approved, with the remark "Entered by admin", the approver and an audit entry. Absent clears a backfilled day. Employees get one notification per month, not one per day.
- **All-or-nothing:** if any row breaks a rule, nothing is saved. The preview lists every problem first.
- **CSV:** `employee_id,date,status[,check_in,check_out]`. Status is `present`, `half_day` or `absent` (or P / H / A). Rows with an empty status are ignored, so the downloadable template can be partly filled. Missing times default to the office hours.
- **After backfilling**, generate, finalize and mark the month's payroll as usual on the Payroll page.

## Layout

- `db/migrations/` SQL schema, applied in order and recorded in `schema_migrations`.
- `lib/server/` database pool, auth, TOTP, crypto, mailer, audit, request helpers (server-only).
- `app/api/` route handlers.
- `lib/services/` thin browser clients that call the API and refresh the data cache (`lib/data-store.ts`).
- `scripts/` `dev-db`, `migrate`, `seed`, `cleanup`.
- `lib/mock-data.ts` is used only by the demo seed.

## Known limits and next steps

- **Scale:** `/api/bootstrap` sends 12 months of attendance in one response. Fine for a few hundred employees; beyond that, page the attendance and payroll endpoints per screen.
- **Email:** only Resend is wired. Swap `lib/server/mailer.ts` for SES, SMTP or another provider if needed.
- **Rate limiting** is database-backed, so it works across several servers; add a WAF or CDN rule for volumetric attacks.
- **Not built:** an admin screen for the audit log (the API exists), editing a past day's attendance on an employee's behalf, salary-revision history, and file uploads for profile documents.
- **UI not browser-tested:** the screens were rewired to these APIs and compile, lint and build cleanly, and the APIs are covered by tests, but the interface itself has not been clicked through in a real browser.
