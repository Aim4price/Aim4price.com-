-- Read-only dealer maintenance tracking for assets explicitly shared by owners or Field Managers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.dealer_maintenance_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  dealer_user_id text NOT NULL,
  asset_register_item_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
  granted_by_actor_type text NOT NULL DEFAULT 'owner',
  granted_by_actor_id text,
  granted_by_name text,
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, dealer_user_id, asset_register_item_id)
);

CREATE INDEX IF NOT EXISTS dealer_maintenance_access_dealer_active_idx
  ON public.dealer_maintenance_access (dealer_user_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS dealer_maintenance_access_owner_asset_idx
  ON public.dealer_maintenance_access (owner_user_id, asset_register_item_id, is_active);

CREATE TABLE IF NOT EXISTS public.dealer_maintenance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_user_id text NOT NULL,
  access_id uuid NOT NULL REFERENCES public.dealer_maintenance_access(id) ON DELETE CASCADE,
  asset_register_item_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
  maintenance_record_id uuid NOT NULL REFERENCES public.asset_maintenance_records(id) ON DELETE CASCADE,
  notification_status text NOT NULL CHECK (notification_status IN ('due_soon', 'due', 'overdue')),
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (access_id, maintenance_record_id, notification_status)
);

CREATE INDEX IF NOT EXISTS dealer_maintenance_notifications_dealer_idx
  ON public.dealer_maintenance_notifications (dealer_user_id, created_at DESC);
