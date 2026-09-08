import { redirectAdminToAdmin } from "../../lib/account-access";
import EstimateReportPhotos from "./EstimateReportPhotos";
import ValuationClient from "./valuation-client";
import ValuationFlowPolish from "./ValuationFlowPolish";
import badgeStyles from "./advanced-badge-corner.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ValuationPage() {
  await redirectAdminToAdmin();

  return (
    <div className={badgeStyles.scope}>
      <ValuationFlowPolish />
      <EstimateReportPhotos />
      <ValuationClient />
    </div>
  );
}
