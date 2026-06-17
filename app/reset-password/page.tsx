import { redirectAdminToAdmin } from "../../lib/account-access";
import ResetPasswordClient from "./reset-password-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResetPasswordSearchParams = Record<string, string | string[] | undefined>;

function firstSearchValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: ResetPasswordSearchParams;
}) {
  await redirectAdminToAdmin();

  return (
    <ResetPasswordClient
      token={firstSearchValue(searchParams?.token)}
      error={firstSearchValue(searchParams?.error)}
    />
  );
}
