import { cookies, headers } from "next/headers";
import { isAim4priceAdminEmail } from "./account-constants";
import { isAccountActive } from "./account-profile";
import { auth } from "./auth";
import { getDb } from "./db";

export const ADMIN_SUPPORT_COOKIE_NAME = "aim4price_admin_support_user_id";
export const ADMIN_SUPPORT_COOKIE_MAX_AGE_SECONDS = 60 * 60;

type ServerSession = Awaited<ReturnType<typeof auth.api.getSession>>;
type NonNullServerSession = NonNullable<ServerSession>;

type AuthUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean | null;
  image: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

export type AdminSupportContext = {
  adminUserId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
};

export type AdminSupportSession = NonNullServerSession & {
  adminSupport: AdminSupportContext;
};

type EffectiveServerSession = NonNullServerSession | AdminSupportSession | null;

type SessionOptions = {
  requireActive?: boolean;
  allowAdmin?: boolean;
};

function cleanCookieUserId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 200);
}

function toDate(value: string | Date | null | undefined, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

async function readAuthSession(): Promise<ServerSession> {
  return auth.api.getSession({
    headers: await headers(),
  });
}

async function readAuthUser(userId: string): Promise<AuthUserRow | null> {
  if (!userId) {
    return null;
  }

  const db = getDb();
  const result = await db.query<AuthUserRow>(
    `
      select
        id,
        name,
        email,
        "emailVerified",
        image,
        "createdAt",
        "updatedAt"
      from "user"
      where id = $1
      limit 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

async function readAdminSupportUserId(): Promise<string> {
  const cookieStore = await cookies();
  return cleanCookieUserId(cookieStore.get(ADMIN_SUPPORT_COOKIE_NAME)?.value);
}

async function applyAdminSupportSession(
  session: NonNullServerSession,
): Promise<EffectiveServerSession> {
  if (!isAim4priceAdminEmail(session.user.email)) {
    return session;
  }

  const targetUserId = await readAdminSupportUserId();

  if (!targetUserId || targetUserId === session.user.id) {
    return session;
  }

  const targetUser = await readAuthUser(targetUserId);

  if (!targetUser || isAim4priceAdminEmail(targetUser.email)) {
    return session;
  }

  const fallbackDate = new Date();

  return {
    ...session,
    user: {
      ...session.user,
      id: targetUser.id,
      name: targetUser.name ?? "",
      email: targetUser.email ?? "",
      emailVerified: Boolean(targetUser.emailVerified),
      image: targetUser.image ?? null,
      createdAt: toDate(targetUser.createdAt, session.user.createdAt ?? fallbackDate),
      updatedAt: toDate(targetUser.updatedAt, session.user.updatedAt ?? fallbackDate),
    },
    adminSupport: {
      adminUserId: session.user.id,
      adminEmail: session.user.email ?? "",
      targetUserId: targetUser.id,
      targetEmail: targetUser.email ?? "",
    },
  } as AdminSupportSession;
}

export function isAdminSupportSession(
  session: EffectiveServerSession,
): session is AdminSupportSession {
  return Boolean(
    session &&
      "adminSupport" in session &&
      session.adminSupport?.adminUserId &&
      session.adminSupport?.targetUserId,
  );
}

export async function getAnyServerSession(): Promise<ServerSession> {
  return readAuthSession();
}

export async function getServerSession(
  options: SessionOptions = {},
): Promise<EffectiveServerSession> {
  const session = await readAuthSession();

  if (!session?.user?.id) {
    return session;
  }

  const effectiveSession = await applyAdminSupportSession(session);

  if (isAdminSupportSession(effectiveSession)) {
    return effectiveSession;
  }

  if (!options.allowAdmin && isAim4priceAdminEmail(session.user.email)) {
    return null;
  }

  if (options.requireActive === false) {
    return session;
  }

  return (await isAccountActive({
    id: session.user.id,
    email: session.user.email,
  }))
    ? session
    : null;
}
