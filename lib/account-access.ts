import { redirect } from "next/navigation";
import {
  accountStatusLabel,
  isAim4priceAdminEmail,
  type AccountStatus,
} from "./account-constants";
import { getAccountStatusForUser } from "./account-profile";
import {
  getAnyServerSession,
  getServerSession,
  isAdminSupportSession,
} from "./auth-session";

export type AccountAccessResult = {
  status: AccountStatus;
  isAdmin: boolean;
  isActive: boolean;
  statusLabel: string;
};

export async function getAccountAccess(user: {
  id: string;
  email?: string | null;
}): Promise<AccountAccessResult> {
  const isAdmin = isAim4priceAdminEmail(user.email);
  const status = isAdmin ? "active" : await getAccountStatusForUser(user);

  return {
    status,
    isAdmin,
    isActive: status === "active",
    statusLabel: accountStatusLabel(status),
  };
}

export async function redirectAdminToAdmin(): Promise<void> {
  const session = await getAnyServerSession();

  if (session?.user?.id && isAim4priceAdminEmail(session.user.email)) {
    redirect("/admin");
  }
}

export async function requireActivePageAccess() {
  const realSession = await getAnyServerSession();

  if (!realSession?.user?.id) {
    redirect("/auth#login");
  }

  const [effectiveSession, access] = await Promise.all([
    getServerSession({ requireActive: false, authSession: realSession }),
    getAccountAccess({
      id: realSession.user.id,
      email: realSession.user.email,
    }),
  ]);

  if (isAdminSupportSession(effectiveSession)) {
    return {
      session: effectiveSession,
      access: {
        status: "active" as AccountStatus,
        isAdmin: false,
        isActive: true,
        statusLabel: "Active",
      },
    };
  }

  if (access.isAdmin) {
    redirect("/admin");
  }

  if (!access.isActive) {
    redirect("/pending-payment");
  }

  return { session: realSession, access };
}

export async function requireAdminPageAccess() {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    redirect("/auth#login");
  }

  if (!isAim4priceAdminEmail(session.user.email)) {
    redirect("/account");
  }

  return session;
}
