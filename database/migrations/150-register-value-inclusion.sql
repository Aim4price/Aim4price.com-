-- Existing registers continue contributing to combined totals.
ALTER TABLE public.asset_registers
  ADD COLUMN IF NOT EXISTS include_in_combined_totals boolean NOT NULL DEFAULT true;
-- Individual asset inclusion is stored in specs_json.includeInRegisterTotal.
-- Missing values mean included; existing saved valuations are unchanged.
