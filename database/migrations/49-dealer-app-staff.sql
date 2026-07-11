-- Aim4price Dealer App staff access. Passwords are salted scrypt hashes only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.dealer_app_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  username text NOT NULL,
  username_normalized text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  session_version integer NOT NULL DEFAULT 1 CHECK (session_version > 0),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dealer_app_staff_username_normalized ON public.dealer_app_staff(username_normalized);
CREATE INDEX IF NOT EXISTS idx_dealer_app_staff_dealer_user ON public.dealer_app_staff(dealer_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_app_staff_active ON public.dealer_app_staff(dealer_user_id,is_active);
