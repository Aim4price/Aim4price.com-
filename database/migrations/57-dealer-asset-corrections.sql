-- Dealer-proposed serial number and replacement-price corrections.
-- The owner Asset Register changes only after the owner accepts the request.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.dealer_asset_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  dealer_user_id text NOT NULL,
  asset_register_item_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('lead', 'maintenance')),
  source_id text NOT NULL,
  dealer_name text NOT NULL,
  actor_name text NOT NULL,
  current_serial_number text,
  proposed_serial_number text,
  current_replacement_price_ex_vat numeric(14, 2),
  proposed_replacement_price_ex_vat numeric(14, 2),
  serial_number_changed boolean NOT NULL DEFAULT false,
  replacement_price_changed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  resolved_by_user_id text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (serial_number_changed OR replacement_price_changed)
);

CREATE UNIQUE INDEX IF NOT EXISTS dealer_asset_correction_pending_unique_idx
  ON public.dealer_asset_correction_requests (owner_user_id, dealer_user_id, asset_register_item_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS dealer_asset_correction_owner_pending_idx
  ON public.dealer_asset_correction_requests (owner_user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS dealer_asset_correction_dealer_pending_idx
  ON public.dealer_asset_correction_requests (dealer_user_id, status, updated_at DESC);
