import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { ensureNotificationInboxTables } from "./notification-inbox";

export const DEFAULT_ADMIN_NOTIFICATION_TITLE = "Message from Aim4price";
export const MAX_ADMIN_NOTIFICATION_TITLE_LENGTH = 120;
export const MAX_ADMIN_NOTIFICATION_BODY_LENGTH = 1_200;

type SendAdminAccountNotificationInput = {
  targetUserId: string;
  senderUserId: string;
  title?: string | null;
  body: string;
};

type TargetAccountRow = {
  id: string;
  email: string | null;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function sendAdminAccountNotification(
  input: SendAdminAccountNotificationInput,
): Promise<{ eventKey: string; targetEmail: string }> {
  const targetUserId = cleanText(input.targetUserId);
  const senderUserId = cleanText(input.senderUserId);
  const title = cleanText(input.title) || DEFAULT_ADMIN_NOTIFICATION_TITLE;
  const body = cleanText(input.body);

  if (!targetUserId) throw new Error("A recipient account is required.");
  if (!senderUserId) throw new Error("The sending admin could not be identified.");
  if (!body) throw new Error("A notification message is required.");
  if (title.length > MAX_ADMIN_NOTIFICATION_TITLE_LENGTH) {
    throw new Error(`Notification titles may not exceed ${MAX_ADMIN_NOTIFICATION_TITLE_LENGTH} characters.`);
  }
  if (body.length > MAX_ADMIN_NOTIFICATION_BODY_LENGTH) {
    throw new Error(`Notification messages may not exceed ${MAX_ADMIN_NOTIFICATION_BODY_LENGTH} characters.`);
  }

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
        'info',
        $3,
        $4,
        '/account',
        now(),
        false,
        $5::jsonb,
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
      JSON.stringify({
        source: "admin_account_message",
        notificationId,
        senderUserId,
        targetUserId: target.id,
      }),
    ],
  );

  return {
    eventKey,
    targetEmail: cleanText(target.email),
  };
}
