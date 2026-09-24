import { getAnyServerSession } from "../../lib/auth-session";
import { canUseEstimateBreakdown } from "../../lib/estimate-breakdown-access";
import { redirectAdminToAdmin } from "../../lib/account-access";
import EstimateReportPhotos from "./EstimateReportPhotos";
import ValuationClient from "./valuation-client";
import ValuationFlowPolish from "./ValuationFlowPolish";
import badgeStyles from "./advanced-badge-corner.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ValuationPage() {
  const session = await getAnyServerSession();
  const breakdownAccess = Boolean(session?.user?.id && canUseEstimateBreakdown(session.user.email));
  if (!breakdownAccess) await redirectAdminToAdmin();

  return (
    <div className={badgeStyles.scope}>
      <ValuationFlowPolish />
      <EstimateReportPhotos />
      <ValuationClient breakdownAccess={breakdownAccess} />
    </div>
  );
}
