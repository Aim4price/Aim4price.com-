import { requireActivePageAccess } from "../../lib/account-access";
import AssetMapClient from "./asset-map-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AssetMapPage() {
  await requireActivePageAccess();

  return <AssetMapClient />;
}
