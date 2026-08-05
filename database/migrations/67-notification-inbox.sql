BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  event_key text NOT NULL,
  category text NOT NULL,
  tone text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL DEFAULT '',
  source_created_at timestamptz NOT NULL,
  action_required boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  archived_at timestamptz,
  resolved_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS user_notifications_user_activity_idx
  ON public.user_notifications (user_id, source_created_at DESC);

CREATE INDEX IF NOT EXISTS user_notifications_user_state_idx
  ON public.user_notifications (user_id, action_required, read_at, archived_at);

COMMIT;
