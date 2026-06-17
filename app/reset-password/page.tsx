import ResetPasswordClient from "./reset-password-client";

type ResetPasswordSearchParams = Record<string, string | string[] | undefined>;

function firstSearchValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: ResetPasswordSearchParams;
}) {
  return (
    <ResetPasswordClient
      token={firstSearchValue(searchParams?.token)}
      error={firstSearchValue(searchParams?.error)}
    />
  );
}
