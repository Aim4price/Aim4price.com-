import { requireActivePageAccess } from "../../lib/account-access";
import FuelClient from "./fuel-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FuelPage() {
  await requireActivePageAccess();

  return <FuelClient />;
}
