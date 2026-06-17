import { redirect } from "next/navigation";
import {
  accountStatusLabel,
  isAim4priceAdminEmail,
  type AccountStatus,
} from "./account-constants";
import { getAccountStatusForUser } from "./account-profile";
import { getAnyServerSession } from "./auth-session";

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
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    redirect("/auth#login");
  }

  const access = await getAccountAccess({
    id: session.user.id,
    email: session.user.email,
  });

  if (access.isAdmin) {
    redirect("/admin");
  }

  if (!access.isActive) {
    redirect("/pending-payment");
  }

  return { session, access };
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
