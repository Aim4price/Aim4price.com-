import AdminNavigation from "../../../components/AdminNavigation";
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
            <h1>Lifecycle &amp; Cash-Flow Model</h1>
            <span>Ownership scenario planning workspace</span>
          </div>

          <AdminNavigation active="lifecycle" />
        </header>

        <LifecycleCalculatorClient />
      </section>
    </main>
  );
}
