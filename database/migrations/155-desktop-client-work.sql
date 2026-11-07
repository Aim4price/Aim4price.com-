-- Existing desktop users gain no client access.
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS client_work_ids jsonb NOT NULL DEFAULT '[]';
