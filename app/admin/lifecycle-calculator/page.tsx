import Link from "next/link";
import { requireAdminPageAccess } from "../../../lib/account-access";
import LifecycleCalculatorClient from "./lifecycle-calculator-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LifecycleCalculatorPage() {
  await requireAdminPageAccess();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Aim4price admin</p>
            <h1>Asset Lifecycle &amp; Cash-Flow Model</h1>
            <span>Admin-exclusive financial advice and ownership scenario workspace</span>
          </div>

          <nav className={styles.toolbar} aria-label="Admin navigation">
            <Link href="/admin" className={styles.adminButton}>
              Users
            </Link>
            <Link href="/admin/dashboard" className={styles.adminButton}>
              Dashboard
            </Link>
            <Link href="/admin/capture-queue" className={styles.adminButton}>
              Capture Queue
            </Link>
            <Link
              href="/admin/lifecycle-calculator"
              className={`${styles.adminButton} ${styles.adminButtonActive}`}
              aria-current="page"
            >
              Lifecycle Model
            </Link>
            <Link href="/admin/assistance-network" className={styles.adminButton}>
              Assistance Network
            </Link>
          </nav>
        </header>

        <LifecycleCalculatorClient />
      </section>
    </main>
  );
}
