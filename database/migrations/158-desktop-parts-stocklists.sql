ALTER TABLE team_access ADD COLUMN IF NOT EXISTS parts_list_ids jsonb NOT NULL DEFAULT '[]';
