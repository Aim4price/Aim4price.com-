import { currentAppRealm } from './app-realm-server';
import { cookies, headers } from "next/headers";
import { isAim4priceAdminEmail } from "./account-constants";
import { isAccountActive, markAccountLastActive } from "./account-profile";
import { recordAdminUsageEventSafely } from "./admin-usage-events";
import { auth } from "./auth";
import { getDb } from "./db";
import { getDealerAppSession } from "./dealer-app-session";
import type { DealerStaffRole } from "./dealer-app";
import { getOwnerAppSession } from "./owner-app-session";

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

export type DealerAppSupportSession = NonNullServerSession & {
  dealerApp: { kind: "dealer-staff"; staffId: string; parentDealerUserId: string; displayName: string; username: string; role: DealerStaffRole };
};

export type OwnerAppSupportSession = NonNullServerSession & {
  ownerApp: { kind: "owner-app-user"; ownerAppUserId: string; parentOwnerUserId: string; displayName: string; username: string };
};

type EffectiveServerSession = NonNullServerSession | AdminSupportSession | DealerAppSupportSession | OwnerAppSupportSession | null;

type SessionOptions = {
  requireActive?: boolean;
  allowAdmin?: boolean;
  allowDealerApp?: boolean;
  allowOwnerApp?: boolean;
  authSession?: ServerSession;
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


export function isDealerAppSession(
  session: EffectiveServerSession,
): session is DealerAppSupportSession {
  return Boolean(session && "dealerApp" in session && session.dealerApp?.staffId);
}

export function isOwnerAppSession(
  session: EffectiveServerSession,
): session is OwnerAppSupportSession {
  return Boolean(session && "ownerApp" in session && session.ownerApp?.ownerAppUserId);
}

async function readDealerAppSupportSession(): Promise<DealerAppSupportSession | null> {
  const dealer = await getDealerAppSession();
  if (!dealer) return null;
  const now = new Date();
  return {
    user: {
      id: dealer.dealerUserId,
      name: dealer.displayName,
      email: "",
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
    session: {
      id: `dealer-app:${dealer.staffId}`,
      userId: dealer.dealerUserId,
      token: "",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
    dealerApp: {
      kind: "dealer-staff",
      staffId: dealer.staffId,
      parentDealerUserId: dealer.dealerUserId,
      displayName: dealer.displayName,
      username: dealer.username,
      role: dealer.role,
    },
  } as DealerAppSupportSession;
}

async function readOwnerAppSupportSession(): Promise<OwnerAppSupportSession | null> {
  const owner = await getOwnerAppSession();
  if (!owner) return null;
  const now = new Date();
  return {
    user: {
      id: owner.parentOwnerUserId,
      name: owner.displayName,
      email: "",
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
    session: {
      id: `owner-app:${owner.ownerAppUserId}`,
      userId: owner.parentOwnerUserId,
      token: "",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
    ownerApp: {
      kind: "owner-app-user",
      ownerAppUserId: owner.ownerAppUserId,
      parentOwnerUserId: owner.parentOwnerUserId,
      displayName: owner.displayName,
      username: owner.username,
    },
  } as OwnerAppSupportSession;
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

async function markRealUserActivity(session: NonNullServerSession): Promise<void> {
  try {
    const didUpdate = await markAccountLastActive({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    if (didUpdate) {
      await recordAdminUsageEventSafely({
        userId: session.user.id,
        eventType: "user_activity_ping",
        eventSource: "server_session",
      });
    }
  } catch (error) {
    console.warn("Aim4price last-active timestamp was not updated.", error);
  }
}

export async function getAnyServerSession(): Promise<ServerSession> {
  if (await currentAppRealm()) return null;
  return readAuthSession();
}

export async function getServerSession(
  options: SessionOptions = {},
): Promise<EffectiveServerSession> {
  // Installed apps use only their own staff cookie, never a website or sibling app login.
  const realm = await currentAppRealm();
  if (realm) {
    if (realm === 'owner') return options.allowOwnerApp ? await readOwnerAppSupportSession() : null;
    if (realm === 'field') return null; // Field Manager APIs enforce their own scoped permissions.
    return options.allowDealerApp ? await readDealerAppSupportSession() : null;
  }
  const session = options.authSession ?? await readAuthSession();

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
    await markRealUserActivity(session);
    return session;
  }

  const isActive = await isAccountActive({
    id: session.user.id,
    email: session.user.email,
  });

  if (!isActive) {
    return null;
  }

  await markRealUserActivity(session);
  return session;
}

