import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ContactSupportModal from "./contact-support-modal";
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
        <div
          className={`${styles.statusPanel} ${
            isSuspended ? styles.statusPanelSuspended : styles.statusPanelPending
          }`}
        >
          <span className={styles.statusMarker} aria-hidden="true" />
          <span>
            {isSuspended ? "Account suspended" : "Payment/admin approval pending"}
          </span>
        </div>

        <div className={styles.heroCard}>
          <div className={styles.heroContent}>
            <p className={styles.kicker}>
              {isSuspended ? "Access review required" : "Account review in progress"}
            </p>

            <h1 id="pending-payment-heading" className={styles.title}>
              {isSuspended
                ? "Your Aim4price access is currently suspended."
                : "Your Aim4price account is waiting for activation."}
            </h1>

            <p className={styles.text}>
              {isSuspended
                ? "Protected Aim4price pages are temporarily locked for this account. Contact Aim4price so the account status can be reviewed and resolved."
                : "Payment and account approvals are currently handled manually. Once Aim4price confirms payment and the admin activates your account, protected pages will unlock automatically."}
            </p>

            <div className={styles.actions}>
              <Link href="/" className={styles.secondaryButton}>
                Back to home
              </Link>
              <ContactSupportModal
                accountEmail={session.user.email}
                statusLabel={access.statusLabel}
              />
            </div>
          </div>

          <aside className={styles.accountCard} aria-label="Account status summary">
            <div className={styles.accountCardHeader}>
              <span className={styles.accountCardLabel}>Account details</span>
              <strong>{isSuspended ? "Locked" : "Pending"}</strong>
            </div>

            <dl className={styles.infoList}>
              <div className={styles.infoRow}>
                <dt>Signed in as</dt>
                <dd className={styles.email}>{session.user.email}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Current status</dt>
                <dd className={styles.status}>{access.statusLabel}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    </main>
  );
}
