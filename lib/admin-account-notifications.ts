import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { ensureNotificationInboxTables } from "./notification-inbox";

export const DEFAULT_ADMIN_NOTIFICATION_TITLE = "Message from Aim4price";
export const MAX_ADMIN_NOTIFICATION_TITLE_LENGTH = 120;
export const MAX_ADMIN_NOTIFICATION_BODY_LENGTH = 1_200;
export const ADMIN_NOTIFICATION_AUDIENCES = [
  "all",
  "owner",
  "dealer",
  "insurance",
  "finance",
  "licensing",
] as const;

export type AdminNotificationAudience =
  (typeof ADMIN_NOTIFICATION_AUDIENCES)[number];

type SendAdminAccountNotificationInput = {
  targetUserId: string;
  senderUserId: string;
  title?: string | null;
  body: string;
  priority?: boolean;
};

type SendAdminGroupNotificationInput = {
  audience: AdminNotificationAudience;
  senderUserId: string;
  title?: string | null;
  body: string;
  priority?: boolean;
};

type TargetAccountRow = {
  id: string;
  email: string | null;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isAdminNotificationAudience(
  value: unknown,
): value is AdminNotificationAudience {
  return ADMIN_NOTIFICATION_AUDIENCES.includes(
    cleanText(value).toLowerCase() as AdminNotificationAudience,
  );
}

function cleanNotificationContent(input: {
  title?: string | null;
  body: string;
}) {
  const title = cleanText(input.title) || DEFAULT_ADMIN_NOTIFICATION_TITLE;
  const body = cleanText(input.body);

  if (!body) throw new Error("A notification message is required.");
  if (title.length > MAX_ADMIN_NOTIFICATION_TITLE_LENGTH) {
    throw new Error(
      `Notification titles may not exceed ${MAX_ADMIN_NOTIFICATION_TITLE_LENGTH} characters.`,
    );
  }
  if (body.length > MAX_ADMIN_NOTIFICATION_BODY_LENGTH) {
    throw new Error(
      `Notification messages may not exceed ${MAX_ADMIN_NOTIFICATION_BODY_LENGTH} characters.`,
    );
  }

  return { title, body };
}

export async function sendAdminAccountNotification(
  input: SendAdminAccountNotificationInput,
): Promise<{ eventKey: string; targetEmail: string }> {
  const targetUserId = cleanText(input.targetUserId);
  const senderUserId = cleanText(input.senderUserId);
  const { title, body } = cleanNotificationContent(input);
  const priority = input.priority === true;

  if (!targetUserId) throw new Error("A recipient account is required.");
  if (!senderUserId) throw new Error("The sending admin could not be identified.");

  await ensureNotificationInboxTables();
  const db = getDb();
  const targetResult = await db.query<TargetAccountRow>(
    `
      select id, email
      from "user"
      where id = $1
      limit 1
    `,
    [targetUserId],
  );
  const target = targetResult.rows[0];
  if (!target) throw new Error("Recipient account not found.");

  const notificationId = randomUUID();
  const eventKey = `admin-message:${notificationId}`;
  await db.query(
    `
      insert into public.user_notifications (
        user_id,
        event_key,
        category,
        tone,
        title,
        body,
        href,
        source_created_at,
        action_required,
        payload,
        last_seen_at,
        created_at,
        updated_at
      )
      values (
        $1,
        $2,
        'admin_message',
        $5,
        $3,
        $4,
        '/account',
        now(),
        false,
        $6::jsonb,
        now(),
        now(),
        now()
      )
    `,
    [
      `account:${target.id}`,
      eventKey,
      title,
      body,
      priority ? "warning" : "info",
      JSON.stringify({
        source: "admin_account_message",
        notificationId,
        senderUserId,
        targetUserId: target.id,
        deliveryScope: "account",
        priority,
      }),
    ],
  );

  return {
    eventKey,
    targetEmail: cleanText(target.email),
  };
}

export async function sendAdminGroupNotification(
  input: SendAdminGroupNotificationInput,
): Promise<{
  eventKey: string;
  audience: AdminNotificationAudience;
  recipientCount: number;
}> {
  const senderUserId = cleanText(input.senderUserId);
  const audience = cleanText(input.audience).toLowerCase();
  const { title, body } = cleanNotificationContent(input);
  const priority = input.priority === true;

  if (!senderUserId) throw new Error("The sending admin could not be identified.");
  if (!isAdminNotificationAudience(audience)) {
    throw new Error("Select a valid account group.");
  }

  await ensureNotificationInboxTables();
  const notificationId = randomUUID();
  const eventKey = `admin-message:${notificationId}`;
  const result = await getDb().query(
    `
      with recipients as (
        select
          u.id,
          coalesce(nullif(lower(trim(ap.account_type)), ''), 'owner') as account_type
        from "user" u
        left join public.account_profiles ap on ap.user_id = u.id
        where u.id <> $1
          and (
            $2 = 'all'
            or coalesce(nullif(lower(trim(ap.account_type)), ''), 'owner') = $2
          )
      )
      insert into public.user_notifications (
        user_id,
        event_key,
        category,
        tone,
        title,
        body,
        href,
        source_created_at,
        action_required,
        payload,
        last_seen_at,
        created_at,
        updated_at
      )
      select
        'account:' || recipient.id,
        $3,
        'admin_message',
        $4,
        $5,
        $6,
        '/account',
        now(),
        false,
        jsonb_build_object(
          'source', 'admin_account_message',
          'notificationId', $7::text,
          'senderUserId', $1,
          'targetUserId', recipient.id,
          'deliveryScope', 'account_group',
          'audience', $2,
          'priority', $8::boolean
        ),
        now(),
        now(),
        now()
      from recipients recipient
    `,
    [
      senderUserId,
      audience,
      eventKey,
      priority ? "warning" : "info",
      title,
      body,
      notificationId,
      priority,
    ],
  );

  return {
    eventKey,
    audience,
    recipientCount: result.rowCount ?? 0,
  };
}
