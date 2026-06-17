import { getDb } from './db';

export const ADMIN_USAGE_EVENT_TYPES = [
  'free_estimate_completed',
  'paid_estimate_completed',
  'asset_saved',
  'aim4price_asset_saved',
  'asset_register_created',
  'password_reset_clicked',
  'message_sent_options',
  'message_sent_qr_share',
  'message_sent_leave_note',
  'qr_asset_updated',
  'asset_updated',
  'maintenance_note_left',
  'user_activity_ping',
] as const;

export type AdminUsageEventType = (typeof ADMIN_USAGE_EVENT_TYPES)[number];

export type AdminUsageEventInput = {
  userId?: string | null;
  eventType: AdminUsageEventType;
  eventSource?: string | null;
  metadata?: Record<string, unknown> | null;
};

let adminUsageEventsEnsured = false;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeMetadata(value: Record<string, unknown> | null | undefined): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '{}';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

export async function ensureAdminUsageTrackingSchema(): Promise<void> {
  if (adminUsageEventsEnsured) {
    return;
  }

  const db = getDb();

  await db.query(`
    create table if not exists public.admin_usage_events (
      id bigserial primary key,
      user_id text,
      event_type text not null,
      event_source text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table public.admin_usage_events
      add column if not exists user_id text,
      add column if not exists event_type text,
      add column if not exists event_source text,
      add column if not exists metadata jsonb not null default '{}'::jsonb,
      add column if not exists created_at timestamptz not null default now()
  `);

  await db.query(`
    update public.admin_usage_events
    set metadata = '{}'::jsonb
    where metadata is null
  `);

  await db.query(`
    alter table public.admin_usage_events
      alter column event_type set not null,
      alter column metadata set default '{}'::jsonb,
      alter column metadata set not null,
      alter column created_at set default now(),
      alter column created_at set not null
  `);

  await db.query(`
    create index if not exists idx_admin_usage_events_event_type_created_at
      on public.admin_usage_events(event_type, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_admin_usage_events_user_id_created_at
      on public.admin_usage_events(user_id, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_admin_usage_events_created_at
      on public.admin_usage_events(created_at desc)
  `);

  adminUsageEventsEnsured = true;
}

export async function recordAdminUsageEvent(input: AdminUsageEventInput): Promise<void> {
  await ensureAdminUsageTrackingSchema();

  const db = getDb();
  const userId = cleanText(input.userId, 200) || null;
  const eventSource = cleanText(input.eventSource, 120) || null;

  await db.query(
    `
      insert into public.admin_usage_events (user_id, event_type, event_source, metadata, created_at)
      values ($1, $2, $3, $4::jsonb, now())
    `,
    [userId, input.eventType, eventSource, normalizeMetadata(input.metadata)],
  );
}

export async function recordAdminUsageEventSafely(input: AdminUsageEventInput): Promise<void> {
  try {
    await recordAdminUsageEvent(input);
  } catch (error) {
    console.warn('Aim4price usage event was not recorded.', error);
  }
}

export async function recordAdminUsageEventsSafely(inputs: AdminUsageEventInput[]): Promise<void> {
  for (const input of inputs) {
    await recordAdminUsageEventSafely(input);
  }
}
