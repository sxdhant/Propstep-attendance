# Attendance & Payroll: frontend demo

An employee attendance system with admin approval and monthly salary management.
This is the **frontend phase only**. There is no backend, database, server-side auth or real
payment. Everything runs in the browser against realistic mock data, behind a service layer
that is shaped so a real API can replace it later without touching the UI.

Built with Next.js (App Router), TypeScript, React, Tailwind CSS v4, shadcn/ui, Lucide,
Recharts, React Hook Form and Zod.

> **Not real security.** The login form, the role switcher and the "demo" controls are
> conveniences for a prototype. Nothing is verified server-side, so do not enter real
> credentials or real employee data.

## Run it

```bash
npm install
npm run dev
```

Open the URL Next prints (usually <http://localhost:3000>; if that port is busy Next picks the
next free one). You land on `/login`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |

> If the project lives inside OneDrive, exclude `node_modules` and `.next` from syncing. It is
> slow and can lock files during builds.

## Demo accounts

Use the **Employee demo** / **Admin demo** buttons on the login page, or type credentials:

| Role | Email | Password |
| --- | --- | --- |
| Employee (Aarav Sharma, `EMP-1001`) | `aarav.sharma@kestrel.example` | `Employee@123` |
| Admin (Neha Kapoor, `ADM-001`) | `neha.kapoor@kestrel.example` | `Admin@123` |

Once signed in, the **role switcher** in the header (and the profile menu) jumps between the two
dashboards. It is labelled as a frontend demo on purpose. The **Demo** button next to it can also
preview the app as any other active employee.

## What is in it

### Employee

| Route | Features |
| --- | --- |
| `/employee/profile` | **Onboarding profile.** A new employee must complete it before anything else opens (the menu shows only *My Profile* and other URLs redirect here). Five steps: personal and address, education, work experience and skills, emergency contact and bank details, then review and submit. Each step validates before continuing, **Save draft** keeps progress, and the form can be edited again later. Bank account and PAN are masked when shown. |
| `/employee/dashboard` | Check-in / check-out with simulated time. A check-in is *pending admin approval*, a second check-in is refused, check-out is disabled once used, and an early check-out asks for confirmation. Five summary cards (today, approved days, pending requests, hours worked, estimated salary), recent attendance, a month summary, an hours-worked chart (with a table view) and the latest notifications. |
| `/employee/attendance` | Month calendar, month/year picker, summary cards, filterable table, details drawer, empty state, and eight statuses (approved, pending, rejected, incomplete, absent, holiday, weekly off, not checked in). |
| `/employee/salary` | Salary history and a breakdown for each month, with the formula shown. Marked as a demonstration calculation. |
| `/employee/notifications` | Decisions on attendance, payroll updates, announcements. Mark one or all as read. |

### Admin

| Route | Features |
| --- | --- |
| `/admin/dashboard` | Six summary cards, attendance trend and status charts (each with a table view), recent activity. |
| `/admin/employees` | Add, edit, view, deactivate and reactivate. Search, filters, pagination, validated form. Employees who have not finished their profile show a *Not started* or *In progress* badge. Opening someone shows their full submitted profile, or lets the admin send a reminder. Admins are notified when a profile is submitted or updated. |
| `/admin/attendance` | Approval queue with summary cards and five tabs. Approve in a dialog (choose a full or half day), reject with a required reason. Decisions reach the employee's views and notifications immediately. |
| `/admin/payroll` | Generate, finalize (with confirmation) and mark as paid (with a payment reference). Draft, Finalized and Paid are visibly different. Export to CSV. |
| `/admin/reports` | Attendance, working hours, absences and payroll reports with filters, charts and a CSV export that respects the filters. |
| `/admin/settings` | Company, attendance policy and salary policy, saved to local state. |

### Salary rules

```text
Payable Units = Full Days + Half Days x 0.5
Salary        = Basic Salary x Payable Units / Divisor
```

Example: Basic 30,000, divisor 25, 22 full days and 1 half day gives 22.5 units and
30,000 x 22.5 / 25 = 27,000.

- The calculation lives in one reusable, pure utility: [lib/salary-calculator.ts](lib/salary-calculator.ts).
- The divisor is a policy: scheduled working days (default), calendar days, or a fixed number.
- Salary is capped at basic, and the half-day value is configurable (0.5 / 0.25 / unpaid).
- **Draft** and "not generated" rows are computed live from attendance. **Finalized** and
  **Paid** rows are frozen snapshots, and finalizing a month locks its attendance: new check-ins
  and approve/reject decisions for that month are refused.

## How the demo data works

- **Seeded relative to today.** Four months of attendance, three past payroll months, ~11
  employees (one inactive), one admin, notifications and holidays are generated
  deterministically, so the calendar always has a believable "recent past". The demo employee
  has a hand-written story for the last few days so every status is visible.
- **Persisted in `localStorage`.** All changes (check-ins, approvals, employees, payroll,
  settings, notifications) survive a reload and sync across tabs. Storage is never read during
  server rendering, so there are no hydration mismatches. The layout shows a loading state until
  the stores are ready.
- **Demo clock.** Check-in needs a believable time of day. If your real time is outside
  08:30-13:30, or it is a day off, the demo clock is anchored to 09:40 AM on the nearest working
  day and a notice says so. The **Demo** menu in the header lets you fast-forward the clock
  (+1h / +4h / +8h), jump to the next working day, return to real time, simulate teammates
  checking in, and **Reset demo data**.
- **Simulated latency.** Service calls wait 260 ms like a network call. Set
  `SIMULATED_LATENCY_MS` to `0` in [lib/constants.ts](lib/constants.ts) to make them instant.
- **Time zone and currency.** Asia/Kolkata and INR. Dates are `YYYY-MM-DD` day keys in IST and
  timestamps are ISO strings with `+05:30`.

Profiles are seeded too: most of the team is complete, EMP-1011 has a saved draft and EMP-1009 has not started, so every state is visible. Add an employee, then use **Demo → Preview as** (or *Preview employee view* in their profile) to go through the onboarding as them. Changing the stored data shape bumps `DB_VERSION` in [lib/constants.ts](lib/constants.ts), which replaces older saved demo data with a fresh seed.

The seed is relative to today, so early in a month the demo employee has no earlier days to carry pending, rejected or incomplete states. Check in, or use **Simulate teammates**, to create approvals.

Storage keys: `attendance-payroll:demo-database`, `attendance-payroll:demo-session`,
`attendance-payroll:remembered-email`. Clearing them (or using **Reset demo data**) returns to
the seed.

## Architecture

```text
app/            Routes. Pages are thin server components that render one view.
components/     ui/ (shadcn), layout/, shared/, dashboard/, attendance/, employees/,
                payroll/, reports/, settings/, auth/, employee/ and admin/ views.
hooks/          useDb, useSessionState, useAppData, useAction, usePagination.
lib/
  services/     The backend boundary. Async functions that return ServiceResult<T>.
  selectors/    Pure read functions: Database in, view model out.
  mock-store.ts, session-store.ts   Hydration-safe external stores (useSyncExternalStore).
  mock-data.ts  Deterministic seed.
  salary-calculator.ts, attendance-utils.ts, payroll-utils.ts   Domain rules (pure).
  validation/   Zod schemas shared by the forms.
  export-utils.ts   CSV builders (BOM, spreadsheet formula-injection guard).
types/          Domain interfaces (Employee, AttendanceRecord, PayrollRecord, ...).
```

Data flows one way: **components call services to write, and selectors to read.** A component
never edits the store directly.

## Moving to a real backend

The seams are already in place. Roughly, in order:

| Today (mock) | Becomes |
| --- | --- |
| [lib/services/session-service.ts](lib/services/session-service.ts): demo sign-in, role switch | Real auth (sessions or JWT, password hashing, reset email). Role checks move to the server and middleware. The role switcher is removed. |
| [lib/services/employee-service.ts](lib/services/employee-service.ts) | `GET/POST/PATCH /api/employees`, with the Zod schemas reused on the server. |
| [lib/services/profile-service.ts](lib/services/profile-service.ts) | Profile draft, submit and reminder endpoints, with [profile-schemas.ts](lib/validation/profile-schemas.ts) reused on the server. Bank account, PAN and UAN need encryption at rest, field-level access control and audit logging. Document uploads (ID proof, certificates) are not built yet. The "must complete before using the app" rule has to be enforced by the server too, not only by the redirect. |
| [lib/services/attendance-service.ts](lib/services/attendance-service.ts): `checkIn`, `checkOut`, `reviewAttendance` | Endpoints that stamp **server time** (the demo clock goes away), enforce one check-in per day, and verify the reviewer is an admin. |
| [lib/services/payroll-service.ts](lib/services/payroll-service.ts): generate, finalize, mark paid | Payroll jobs and endpoints. Snapshots are stored when a month is finalized, and a real payment provider replaces "payment reference". |
| [lib/services/settings-service.ts](lib/services/settings-service.ts), [notification-service.ts](lib/services/notification-service.ts) | Settings and notification endpoints (push or polling for the bell). |
| `lib/selectors/*` | Server queries or aggregations. Report and dashboard numbers should be computed in the database. |
| `mock-store.ts` / `mock-data.ts` | Replaced by data fetching and caching (for example server components plus a client cache). The `Database` type documents the shape of every collection. |
| [lib/salary-calculator.ts](lib/salary-calculator.ts), [lib/validation/schemas.ts](lib/validation/schemas.ts) | Keep. Run the same code on the server so both sides agree. |
| [lib/export-utils.ts](lib/export-utils.ts) | Keep for small exports, or move to a streamed server export for large ones. |

Every service already returns `{ ok: true, data } | { ok: false, error }`, so swapping a body
from "update the mock store" to "call the API" leaves the components unchanged.

Things that are intentionally **not** implemented yet: MongoDB or Mongoose, API routes,
server-side authentication, real payroll rules (tax, PF, deductions) and real payments.

## Notes

- This version of Next.js has **Cache Components** enabled. Hidden routes stay mounted, client
  code must not read the time during server rendering, and the dashboard pages export
  `instant = false`. See `AGENTS.md` and `node_modules/next/dist/docs/` before changing routing or
  rendering behaviour.
- The small "N" badge in the corner while developing is Next.js's dev indicator. It does not
  appear in a production build.
- Light theme only.
