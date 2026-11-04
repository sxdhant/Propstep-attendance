-- Profile photos. Stored in the database (small, resized in the browser) so no separate file store is needed.
-- owner_id is an employees.id or admins.id; the two never overlap.
CREATE TABLE avatars (
  owner_id     text PRIMARY KEY,
  content_type text        NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data         bytea       NOT NULL CHECK (octet_length(data) <= 400000),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
