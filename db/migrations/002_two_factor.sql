-- Optional TOTP two-factor authentication.

ALTER TABLE users
  ADD COLUMN totp_secret    text,     -- AES-256-GCM encrypted, never stored in clear
  ADD COLUMN totp_enabled   boolean NOT NULL DEFAULT false,
  ADD COLUMN totp_last_step bigint;   -- last accepted 30-second step, blocks code replay

CREATE TABLE recovery_codes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at   timestamptz
);
CREATE INDEX recovery_codes_user_idx ON recovery_codes (user_id);

-- Between "password accepted" and "code accepted" the user holds only this short-lived challenge, never a session.
CREATE TABLE login_challenges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text        NOT NULL UNIQUE,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  attempts   integer     NOT NULL DEFAULT 0
);
