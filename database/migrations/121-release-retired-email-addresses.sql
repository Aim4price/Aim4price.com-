-- Remove email-only retirement markers from ordinary core accounts.
-- Previous status, directory flags and billing enabled values were not recorded;
-- leave these for explicit admin review rather than guessing or enabling charges.
BEGIN;
DELETE FROM retired_specialist_accounts
WHERE previous_account_type IN ('owner', 'dealer', 'business', 'middleman')
  AND user_id NOT LIKE 'aim4price-assistance-%';
COMMIT;
