-- Core schema. Migrations are applied in filename order by scripts/migrate.mts
-- and recorded in schema_migrations, so each runs exactly once.

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role                text        NOT NULL CHECK (role IN ('admin', 'employee')),
  email               text        NOT NULL,
  password_hash       text        NOT NULL,
  -- employees.id or admins.id, depending on role
  ref_id              text        NOT NULL,
  must_change_password boolean    NOT NULL DEFAULT false,
  disabled            boolean     NOT NULL DEFAULT false,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));
CREATE UNIQUE INDEX users_ref_key ON users (role, ref_id);

-- Only a SHA-256 of the session token is stored, so a database leak can't be replayed as cookies.
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   text        NOT NULL UNIQUE,
  user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  ip           text,
  user_agent   text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE password_resets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text        NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id);

-- Failed sign-in attempts, keyed by "ip:<addr>" and "email:<address>" for rate limiting.
CREATE TABLE login_attempts (
  key text        NOT NULL,
  at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_key_idx ON login_attempts (key, at DESC);

CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  action        text        NOT NULL,
  target        text,
  ip            text,
  meta          jsonb       NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_user_id, at DESC);

CREATE TABLE admins (
  id        text PRIMARY KEY,
  full_name text NOT NULL,
  email     text NOT NULL,
  title     text NOT NULL
);

CREATE SEQUENCE employee_number_seq START 1001;

CREATE TABLE employees (
  id                   text PRIMARY KEY,
  full_name            text           NOT NULL,
  email                text           NOT NULL,
  phone                text           NOT NULL,
  department           text           NOT NULL,
  designation          text           NOT NULL,
  joining_date         date           NOT NULL,
  monthly_basic_salary numeric(12, 2) NOT NULL CHECK (monthly_basic_salary > 0),
  status               text           NOT NULL CHECK (status IN ('active', 'inactive')),
  deactivated_on       date,
  profile              jsonb,
  created_at           timestamptz    NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX employees_email_key ON employees (lower(email));

CREATE TABLE attendance (
  id               text PRIMARY KEY,
  employee_id      text        NOT NULL REFERENCES employees (id),
  date             date        NOT NULL,
  check_in         timestamptz,
  check_out        timestamptz,
  status           text        NOT NULL CHECK (status IN ('present', 'half_day', 'absent', 'incomplete', 'in_progress')),
  approval         text        NOT NULL CHECK (approval IN ('pending', 'approved', 'rejected', 'not_required')),
  remarks          text,
  rejection_reason text,
  reviewed_at      timestamptz,
  reviewed_by      text,
  review_note      text,
  UNIQUE (employee_id, date),
  CHECK (check_out IS NULL OR check_in IS NOT NULL)
);
CREATE INDEX attendance_date_idx ON attendance (date);

CREATE TABLE holidays (
  date date PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE notifications (
  id         text PRIMARY KEY,
  -- an employee id, or 'admin' for every administrator
  recipient  text        NOT NULL,
  type       text        NOT NULL,
  title      text        NOT NULL,
  message    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read       boolean     NOT NULL DEFAULT false,
  href       text
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient, created_at DESC);

CREATE TABLE payroll (
  id          text  PRIMARY KEY,
  employee_id text  NOT NULL REFERENCES employees (id),
  data        jsonb NOT NULL
);
CREATE INDEX payroll_employee_idx ON payroll (employee_id);

CREATE TABLE settings (
  key   text  PRIMARY KEY,
  value jsonb NOT NULL
);
