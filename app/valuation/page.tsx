import { redirectAdminToAdmin } from "../../lib/account-access";
import QuickValuationClient from "./quick-valuation-client";
import ValuationClient from "./valuation-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValuationSearchParams = Record<string, string | string[] | undefined>;

const SPECIALIST_VALUATION_PARAMS = [
  "accountantShareId",
  "registerId",
  "dealerRegisterMode",
  "convertAssetId",
  "conversionAssetId",
  "conversion",
  "marketplace",
  "marketplaceListing",
] as const;

function hasSpecialistValuationContext(searchParams?: ValuationSearchParams): boolean {
  return SPECIALIST_VALUATION_PARAMS.some((key) => {
    const value = searchParams?.[key];
    if (Array.isArray(value)) return value.some((entry) => String(entry ?? "").trim());
    return Boolean(String(value ?? "").trim());
  });
}

export default async function ValuationPage({ searchParams }: { searchParams?: ValuationSearchParams }) {
  await redirectAdminToAdmin();

  // Keep the mature specialist client for workflows that already depend on
  // explicit destination registers, accountant shares, manual conversions or
  // Marketplace publishing. Plain Get Estimate traffic uses the new Quick flow.
  if (hasSpecialistValuationContext(searchParams)) {
    return <ValuationClient />;
  }

  return <QuickValuationClient />;
}
