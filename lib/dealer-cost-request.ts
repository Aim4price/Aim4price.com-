import { businessToolProfile } from './business-tool-profile';
import { getServerSession } from './auth-session';
import { dealerRoleCan } from './dealer-app-access';
import { getDealerAppSession } from './dealer-app-session';
import type { DealerCostActor } from './dealer-costs';

export type DealerCostRequestContext = {
  actor: DealerCostActor;
  vatNumber: string;
  address: string;
};

export async function getDealerCostRequestContext(): Promise<DealerCostRequestContext | null> {
  const session = await getServerSession({allowBusinessWorkspace:true,  allowDealerApp: true });
  if (!session?.user?.id) return null;
  const dealerAppSession = await getDealerAppSession();
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'client_costs')) return null;

  const profile = await businessToolProfile(session);
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') return null;

  const supplierName = profile.businessName || profile.displayName || profile.name || 'Dealer';
  const displayName = dealerAppSession
    ? dealerAppSession.displayName
    : supplierName;

  return {
    actor: {
      dealerUserId: session.user.id,
      dealerStaffId: dealerAppSession?.staffId ?? '',
      displayName,
      supplierName,
    },
    vatNumber: profile.vatNumber,
    address: [
      profile.addressLine1,
      profile.addressLine2,
      profile.townCity,
      profile.province,
    ].filter(Boolean).join(', '),
  };
}
