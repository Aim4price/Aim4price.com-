import { getDesktopScope } from './desktop-workspace';
import type { TeamScope } from './team-access';
import { getServerSession, isDealerAppSession } from "./auth-session";
import { sharingPlan } from "./sharing-foundation";
import { getAccountProfile } from "./account-profile";
import { isAim4priceAdminEmail } from "./account-constants";
import { dealerRoleCan } from "./dealer-app-access";
import { isMiddlemanAccountSubtype } from "./middleman-account";
export type PartsActor = {
  team?: TeamScope;
  id: string;
  email: string;
  staff: boolean;
  canContribute: boolean;
  viewerOnly?: boolean;
};
export async function getPartsActor(
  allowPending = false,
  membershipId?: string,
): Promise<PartsActor | null> {
  const team = await getDesktopScope(membershipId);
  if (team) {
    if (team.accountType !== 'dealer' || !team.grant.permissions.viewParts) return null;
    return {id:team.grant.ownerId, email:'', staff:true, canContribute:team.grant.permissions.manageParts, team};
  }
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
