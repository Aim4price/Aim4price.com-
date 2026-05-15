-- Adds a locked secondary account classification for the signup flow.
-- account_type stays broad: owner | finance | dealer | insurance.
-- account_subtype stores the specific role selected at signup, e.g. farmer, bank, auction-house.

ALTER TABLE public.account_profiles
  ADD COLUMN IF NOT EXISTS account_subtype text;

UPDATE public.account_profiles
SET account_subtype = CASE account_type
  WHEN 'finance' THEN 'bank'
  WHEN 'dealer' THEN 'machinery-dealer'
  WHEN 'insurance' THEN 'insurer'
  ELSE 'farmer'
END
WHERE account_subtype IS NULL OR trim(account_subtype) = '';

CREATE INDEX IF NOT EXISTS idx_account_profiles_account_subtype
  ON public.account_profiles(account_type, account_subtype);
