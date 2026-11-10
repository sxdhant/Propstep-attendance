-- Comp-off: a paid day off an employee earns by working on a company holiday and takes on another day.
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'half_day', 'absent', 'incomplete', 'in_progress', 'week_off', 'comp_off'));
