import Link from "next/link";
import { requireAdminPageAccess } from "../../../lib/account-access";
import CaptureQueueClient from "./capture-queue-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminCaptureQueuePage() {
  await requireAdminPageAccess();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Aim4price admin</p>
            <h1>Capture Queue</h1>
            <span>Verify submitted invoices and fuel slips before they reach a ledger.</span>
          </div>

          <nav className={styles.toolbar} aria-label="Admin navigation">
            <Link href="/admin" className={styles.adminButton}>Users</Link>
            <Link href="/admin/dashboard" className={styles.adminButton}>Dashboard</Link>
            <Link
              href="/admin/capture-queue"
              className={`${styles.adminButton} ${styles.adminButtonActive}`}
              aria-current="page"
            >
              Capture Queue
            </Link>
            <Link href="/admin/lifecycle-calculator" className={styles.adminButton}>Lifecycle Model</Link>
            <Link href="/admin/assistance-network" className={styles.adminButton}>Assistance Network</Link>
          </nav>
        </header>

        <CaptureQueueClient />
      </section>
    </main>
  );
}
