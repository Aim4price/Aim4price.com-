import { redirect } from "next/navigation";
import { getAccountAccess } from "../../lib/account-access";
import { getAccountProfile } from "../../lib/account-profile";
import { getAnyServerSession } from "../../lib/auth-session";
import { isMiddlemanAccountSubtype } from "../../lib/middleman-account";
import AuthClient from "./auth-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AuthPage() {
  const session = await getAnyServerSession();

  if (session?.user?.id) {
    const access = await getAccountAccess({
      id: session.user.id,
      email: session.user.email,
    });

    if (access.isAdmin) {
      redirect("/admin");
    }

    if (access.isActive) {
      const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
      redirect(
        profile.accountType === "dealer"
          ? isMiddlemanAccountSubtype(profile.accountSubtype)
            ? "/my-showroom"
            : "/leads"
          : "/asset-register",
      );
    }

    redirect("/pending-payment");
  }

  return <AuthClient />;
}
