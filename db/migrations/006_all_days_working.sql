-- Every day is a working day unless the admin marks it as a holiday / day off.
UPDATE settings
SET value = jsonb_set(value, '{attendance,weeklyOffs}', '[]'::jsonb)
WHERE key = 'app';
