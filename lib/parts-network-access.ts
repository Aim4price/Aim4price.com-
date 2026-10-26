import { getServerSession, isDealerAppSession } from "./auth-session";
import { getAccountProfile } from "./account-profile";
import { isAim4priceAdminEmail } from "./account-constants";
import { dealerRoleCan } from "./dealer-app-access";
import { isMiddlemanAccountSubtype } from "./middleman-account";
export type PartsActor = {
  id: string;
  email: string;
  platformAdmin: boolean;
  staff: boolean;
  canContribute: boolean;
};
export async function getPartsActor(
  allowPending = false,
): Promise<PartsActor | null> {
  const session = await getServerSession({
    allowDealerApp: true,
    allowAdmin: true,
    requireActive: !allowPending,
  });
  if (!session?.user?.id) return null;
  const staff = isDealerAppSession(session);
  const platformAdmin = !staff && isAim4priceAdminEmail(session.user.email);
  if (staff && !dealerRoleCan(session.dealerApp.role, "parts_network"))
    return null;
  if (!platformAdmin) {
    const p = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    if (
      p.accountType !== "dealer" ||
      (p.accountStatus !== "active" &&
        !(allowPending && p.accountStatus === "pending_payment")) ||
      isMiddlemanAccountSubtype(p.accountSubtype)
    )
      return null;
  }
  return {
    id: session.user.id,
    email: (session.user.email || "").trim().toLowerCase(),
    platformAdmin,
    staff,
    canContribute:
      !staff || ["owner", "parts"].includes(session.dealerApp.role),
  };
}
