import { redirect } from "next/navigation";
import { getAccountAccess } from "../../lib/account-access";
import { getAnyServerSession } from "../../lib/auth-session";
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
      redirect("/asset-register");
    }

    redirect("/pending-payment");
  }

  return <AuthClient />;
}
