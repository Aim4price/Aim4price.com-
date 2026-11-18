import { redirect } from "next/navigation";
import { requireAdminPageAccess } from "../../../lib/account-access";

export default async function RetiredBusinessDirectory({ searchParams }: {
  searchParams: Promise<{ verify?: string }>;
}) {
  await requireAdminPageAccess();
  redirect((await searchParams).verify === "1" ? "/admin?verify=1" : "/admin");
}
