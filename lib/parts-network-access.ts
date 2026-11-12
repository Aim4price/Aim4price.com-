import { getServerSession, isDealerAppSession } from "./auth-session";
import { sharingPlan } from "./sharing-foundation";
import { getAccountProfile } from "./account-profile";
import { isAim4priceAdminEmail } from "./account-constants";
import { dealerRoleCan } from "./dealer-app-access";
import { isMiddlemanAccountSubtype } from "./middleman-account";
export type PartsActor = {
  id: string;
  email: string;
  staff: boolean;
  canContribute: boolean;
  viewerOnly?: boolean;
};
export async function getPartsActor(
  allowPending = false,
): Promise<PartsActor | null> {
  const session = await getServerSession({
    allowDealerApp: true,
    allowAdmin: false,
    requireActive: false,
  });
  if (!session?.user?.id) return null;
  const staff = isDealerAppSession(session);
  if (isAim4priceAdminEmail(session.user.email)) return null;
  if (staff && !dealerRoleCan(session.dealerApp.role, "parts_network"))
    return null;
  const p = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (
    p.accountStatus === "suspended" ||
    isMiddlemanAccountSubtype(p.accountSubtype)
  )
    return null;
  const plan = await sharingPlan(session.user.id, p.accountType);
  const dealer =
    p.accountType === "dealer" &&
    plan === "desktop" &&
    p.accountStatus === "active";
  const freeDealer = !staff && p.accountType === "dealer" && plan === "free";
  const business =
    p.accountType === "business" &&
    (plan === "free" || p.accountStatus === "active");
  const pending =
    allowPending &&
    p.accountType === "dealer" &&
    p.accountStatus === "pending_payment";
  if (!dealer && !freeDealer && !business && !pending) return null;
  if (staff && !dealer) return null;
  return {
    id: session.user.id,
    email: (session.user.email || "").trim().toLowerCase(),
    staff,
    viewerOnly: !dealer,
    canContribute:
      dealer && (!staff || ["owner", "parts"].includes(session.dealerApp.role)),
  };
}
