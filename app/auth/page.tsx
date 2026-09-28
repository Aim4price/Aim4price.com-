import AppHeader from '../../components/AppHeader';
import SwitchAccountButton from '../../components/SwitchAccountButton';
import styles from './page.module.css';
import { redirect } from "next/navigation";
import { getAccountAccess } from "../../lib/account-access";
import { getAccountProfile } from "../../lib/account-profile";
import { getAnyServerSession } from "../../lib/auth-session";
import { isMiddlemanAccountSubtype } from "../../lib/middleman-account";
import AuthClient from "./auth-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams?: { switchAccount?: string } }) {
  const session = await getAnyServerSession();

  if (session?.user?.id) {
    const access = await getAccountAccess({
      id: session.user.id,
      email: session.user.email,
    });

    if (!access.isActive || searchParams?.switchAccount === '1') {
      return <main className={styles.page}>
        <AppHeader active="none" />
        <section className={styles.shell}>
          <div className={styles.authCard}>
            <h1 className={styles.authTitle}>Sign in to another account</h1>
            <p className={styles.authText}>You are signed in as {session.user.email}. Sign out to continue with another account.</p>
            <SwitchAccountButton />
          </div>
        </section>
      </main>;
    }

    if (access.isAdmin) {
      redirect("/admin");
    }

    if (access.isActive) {
      const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
      redirect(
        profile.accountType === "business" ? "/business" : profile.accountType === "dealer"
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
