import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import { getAccountAccess } from "../../lib/account-access";
import { getAnyServerSession } from "../../lib/auth-session";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PendingPaymentPage() {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    redirect("/auth#login");
  }

  const access = await getAccountAccess(session.user);

  if (access.isActive) {
    redirect(access.isAdmin ? "/admin" : "/asset-register");
  }

  const isSuspended = access.status === "suspended";

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section
        className={styles.shell}
        aria-labelledby="pending-payment-heading"
      >
        <div className={styles.badge}>
          {isSuspended ? "Account suspended" : "Payment/admin approval pending"}
        </div>

        <h1 id="pending-payment-heading" className={styles.title}>
          {isSuspended
            ? "Your Aim4price access is suspended."
            : "Your Aim4price account has been created."}
        </h1>

        <p className={styles.text}>
          {isSuspended
            ? "Protected Aim4price pages are locked for this account. Contact Aim4price to review the account status."
            : "Payment is currently handled manually. Once Aim4price confirms payment and the admin activates your account, protected pages will unlock automatically."}
        </p>

        <div className={styles.infoCard}>
          <span className={styles.infoLabel}>Signed in as</span>
          <strong className={styles.email}>{session.user.email}</strong>
          <span className={styles.infoLabel}>Current status</span>
          <strong className={styles.status}>{access.statusLabel}</strong>
        </div>

        <div className={styles.actions}>
          <Link href="/" className={styles.secondaryButton}>
            Back to home
          </Link>
          <a href="mailto:aim4price@gmail.com" className={styles.primaryButton}>
            Contact Aim4price
          </a>
        </div>
      </section>
    </main>
  );
}
