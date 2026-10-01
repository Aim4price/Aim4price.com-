import { sharingPlan } from '../../lib/sharing-foundation';
import { sharedEnquiryReturnTo } from '../../lib/external-share-permissions';
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

export default async function AuthPage({ searchParams }: { searchParams?: { switchAccount?: string; returnTo?: string; accountAccess?: string } }) {
  const session = await getAnyServerSession();

  if (session?.user?.id) {
    const access = await getAccountAccess({
      id: session.user.id,
      email: session.user.email,
    });

    const profile = await getAccountProfile(session.user);
    if (searchParams?.switchAccount !== '1' && profile.accountStatus !== 'suspended' && await sharingPlan(session.user.id, profile.accountType) === 'free') {
      redirect(sharedEnquiryReturnTo(searchParams?.returnTo) || '/upgrade-account');
    }

    if (!access.isActive || searchParams?.switchAccount === '1') {
      return <main className={`${styles.page} ${styles.switchPage}`}>
        <AppHeader active="none" />
        <section className={styles.switchShell} aria-labelledby="switch-account-heading">
          <div className={styles.switchCard}>
            <span className={styles.switchIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/></svg></span>
            <h1 id="switch-account-heading" className={styles.switchTitle}>Switch account</h1>
            <p className={styles.switchText}>Sign out to continue with another account.</p>
            <div className={styles.switchIdentity}><span>Currently signed in</span><strong>{session.user.email}</strong></div>
            <SwitchAccountButton primary returnTo={sharedEnquiryReturnTo(searchParams?.returnTo)} />
          </div>
        </section>
      </main>;
    }

    if (access.isAdmin) {
      redirect("/admin");
    }

    if (access.isActive) {
      const returnTo = sharedEnquiryReturnTo(searchParams?.returnTo);
      if (returnTo) redirect(returnTo);
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

  const returnTo = sharedEnquiryReturnTo(searchParams?.returnTo);
  return <AuthClient businessSignup={Boolean(returnTo) && searchParams?.accountAccess !== 'desktop'} returnTo={returnTo}/>;
}
