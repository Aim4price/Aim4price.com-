-- Allow an insurance share (asset_lead) to be removed after it has been
-- imported into the normalized insurance workspace. Snapshot records are
-- owned by that share and should be removed with it, rather than blocking the
-- account/share deletion transaction.
BEGIN;

ALTER TABLE public.insurance_snapshot_revisions
  DROP CONSTRAINT IF EXISTS insurance_snapshot_revisions_source_share_id_fkey;

ALTER TABLE public.insurance_snapshot_revisions
  ADD CONSTRAINT insurance_snapshot_revisions_source_share_id_fkey
  FOREIGN KEY (source_share_id)
  REFERENCES public.asset_leads(id)
  ON DELETE CASCADE;

COMMIT;
