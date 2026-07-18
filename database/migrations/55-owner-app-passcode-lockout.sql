-- Four-digit Owner App passcodes use persistent failed-attempt protection.
-- Existing password hashes remain valid until an account owner resets the credential.
ALTER TABLE public.owner_app_users
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.owner_app_users
  ADD COLUMN IF NOT EXISTS login_locked_until timestamptz;
