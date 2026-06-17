import Link from "next/link";
import { requireAdminPageAccess } from "../../../lib/account-access";
import { getAdminDashboardStats } from "../../../lib/admin-dashboard";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default async function AdminDashboardPage() {
  await requireAdminPageAccess();
  const dashboard = await getAdminDashboardStats();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Aim4price admin</p>
            <h1>Dashboard</h1>
            <span>Updated {formatGeneratedAt(dashboard.generatedAtIso)}</span>
          </div>

          <nav className={styles.toolbar} aria-label="Admin dashboard navigation">
            <Link href="/admin" className={styles.adminButton}>
              Users
            </Link>
            <Link href="/admin/dashboard" className={styles.adminButton}>
              Dashboard
            </Link>
          </nav>
        </header>

        <section className={styles.summaryNote}>
          <strong>No external analytics.</strong> Historical event-based metrics start from the new tracking table after this migration is deployed.
        </section>

        <section className={styles.grid} aria-label="Admin usage statistics">
          {dashboard.cards.map((card) => (
            <article key={card.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>{card.title}</h2>
                {card.description ? <p>{card.description}</p> : null}
              </div>

              <dl className={styles.values}>
                {card.values.map((item) => (
                  <div key={`${card.id}-${item.label}`} className={styles.valueRow}>
                    <dt>{item.label}</dt>
                    <dd>
                      <strong>{item.value}</strong>
                      {item.detail ? <span>{item.detail}</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>

        <section className={styles.storageCard} aria-label="Storage source breakdown">
          <div>
            <p className={styles.eyebrow}>Storage sources</p>
            <h2>Known uploaded storage</h2>
          </div>

          <div className={styles.storageRows}>
            {dashboard.storage.sources.map((source) => (
              <div key={source.label} className={styles.storageRow}>
                <span>{source.label}</span>
                <strong>{source.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
