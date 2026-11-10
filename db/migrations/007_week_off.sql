-- A flexible per-employee week off: stored as a record, treated as a day off (not an absence).
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'half_day', 'absent', 'incomplete', 'in_progress', 'week_off'));
