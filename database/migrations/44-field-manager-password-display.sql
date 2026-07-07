-- Aim4price Field Manager saved password display
-- Existing scrypt hashes cannot be reversed; this column is populated when a Field Manager password is created or reset after this migration.

ALTER TABLE public.field_managers
  ADD COLUMN IF NOT EXISTS password_display text;
