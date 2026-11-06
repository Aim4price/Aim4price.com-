ALTER TABLE team_access ADD COLUMN IF NOT EXISTS document_access text NOT NULL DEFAULT 'selected' CHECK(document_access IN ('none','selected','all'));
ALTER TABLE team_access ADD COLUMN IF NOT EXISTS excluded_document_ids jsonb NOT NULL DEFAULT '[]';
