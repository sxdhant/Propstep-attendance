-- Administrators can maintain their own profile.
ALTER TABLE admins ADD COLUMN phone text NOT NULL DEFAULT '';
