-- Preserve business activity when a desktop membership is removed.
ALTER TABLE team_access_activity ALTER COLUMN membership_id DROP NOT NULL;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='team_access_activity'::regclass AND conname='team_access_activity_membership_id_fkey' AND confdeltype='c') THEN
  ALTER TABLE team_access_activity DROP CONSTRAINT team_access_activity_membership_id_fkey;
  ALTER TABLE team_access_activity ADD CONSTRAINT team_access_activity_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES team_access(id) ON DELETE SET NULL;
 END IF;
END $$;
