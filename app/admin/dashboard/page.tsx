import Link from "next/link";
import AdminNavigation from "../../../components/AdminNavigation";
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
    timeZone: "Africa/Johannesburg",
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
  const overviewIds = new Set([
    "free-estimates",
    "paid-estimates",
    "total-assets-saved",
    "total-accounts-created",
  ]);
  const accountIds = new Set([
    "free-estimate-users",
    "owner-accounts-created",
    "dealer-accounts-created",
    "finance-accounts-created",
    "insurer-accounts-created",
    "average-user-time",
  ]);
  const productIds = new Set([
    "aim4price-assets-saved",
    "marketplace-advertised",
    "asset-registers-created",
    "storage",
  ]);
  const overviewCards = dashboard.cards.filter((card) => overviewIds.has(card.id));
  const accountCards = dashboard.cards.filter((card) => accountIds.has(card.id));
  const productCards = dashboard.cards.filter((card) => productIds.has(card.id));
  const detailedCards = dashboard.cards.filter(
    (card) => !overviewIds.has(card.id) && !accountIds.has(card.id) && !productIds.has(card.id),
  );

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Aim4price admin</p>
            <h1>Dashboard</h1>
            <span>Updated {formatGeneratedAt(dashboard.generatedAtIso)}</span>
          </div>

          <AdminNavigation active="dashboard" />
        </header>

        <section className={styles.dashboardSection} aria-labelledby="overview-heading">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Overview</p><h2 id="overview-heading">At a glance</h2></div>
            <span>The measures most useful for a quick admin check.</span>
          </div>
          <div className={`${styles.grid} ${styles.overviewGrid}`}>
            {overviewCards.map((card, index) => (
              <article key={card.id} className={`${styles.card} ${index === 0 ? styles.featuredCard : ""}`}>
                <div className={styles.cardHeader}>
                  <h2>{card.title}</h2>
                  {card.description ? <p>{card.description}</p> : null}
                </div>
                <dl className={styles.values}>
                  {card.values.map((item) => (
                    <div key={`${card.id}-${item.label}`} className={styles.valueRow}>
                      <dt>{item.label}</dt><dd><strong>{item.value}</strong>{item.detail ? <span>{item.detail}</span> : null}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </section>

        {accountCards.length ? (
          <section className={styles.dashboardSection} aria-labelledby="accounts-heading">
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>Accounts</p><h2 id="accounts-heading">Growth and engagement</h2></div>
              <span>How users are joining and returning to Aim4price.</span>
            </div>
            <div className={styles.grid}>
              {accountCards.map((card) => (
                <article key={card.id} className={styles.card}>
                  <div className={styles.cardHeader}><h2>{card.title}</h2>{card.description ? <p>{card.description}</p> : null}</div>
                  <dl className={styles.values}>{card.values.map((item) => (
                    <div key={`${card.id}-${item.label}`} className={styles.valueRow}><dt>{item.label}</dt><dd><strong>{item.value}</strong>{item.detail ? <span>{item.detail}</span> : null}</dd></div>
                  ))}</dl>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {productCards.length ? (
          <section className={styles.dashboardSection} aria-labelledby="product-heading">
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>Product</p><h2 id="product-heading">Asset workspace adoption</h2></div>
              <span>Saved values, marketplace advertising, asset registers and storage use.</span>
            </div>
            <div className={styles.grid}>
              {productCards.map((card) => (
                <article key={card.id} className={styles.card}>
                  <div className={styles.cardHeader}><h2>{card.title}</h2>{card.description ? <p>{card.description}</p> : null}</div>
                  <dl className={styles.values}>{card.values.map((item) => (
                    <div key={`${card.id}-${item.label}`} className={styles.valueRow}><dt>{item.label}</dt><dd><strong>{item.value}</strong>{item.detail ? <span>{item.detail}</span> : null}</dd></div>
                  ))}</dl>
                  {card.href ? (
                    <Link href={card.href} className={styles.cardLink}>
                      {card.linkLabel ?? "Open details"}
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {detailedCards.length ? (
          <details className={styles.detailsSection}>
            <summary><div><p className={styles.eyebrow}>Optional detail</p><strong>Detailed product activity</strong><span>{detailedCards.length} additional measures</span></div></summary>
            <p className={styles.summaryNote}><strong>First-party reporting.</strong> Historical event-based metrics begin from the tracking migration; no external analytics are used.</p>
            <div className={styles.grid}>
              {detailedCards.map((card) => (
                <article key={card.id} className={styles.card}>
                  <div className={styles.cardHeader}><h2>{card.title}</h2>{card.description ? <p>{card.description}</p> : null}</div>
                  <dl className={styles.values}>{card.values.map((item) => (
                    <div key={`${card.id}-${item.label}`} className={styles.valueRow}><dt>{item.label}</dt><dd><strong>{item.value}</strong>{item.detail ? <span>{item.detail}</span> : null}</dd></div>
                  ))}</dl>
                </article>
              ))}
            </div>
          </details>
        ) : null}

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
            <div className={styles.storageDivider} aria-hidden="true" />
            <div className={styles.storageRow}>
              <span>Accounts with tracked files</span>
              <strong>{dashboard.storage.customerUsage.accountCountLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Average tracked storage / account</span>
              <strong>{dashboard.storage.customerUsage.averageLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Median tracked storage / account</span>
              <strong>{dashboard.storage.customerUsage.medianLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Tracked-storage 90th percentile / account</span>
              <strong>{dashboard.storage.customerUsage.p90Label}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Tracked storage added in the last 30 days</span>
              <strong>{dashboard.storage.customerUsage.addedLast30DaysLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Bucket uploads still processing</span>
              <strong>{dashboard.storage.customerUsage.pendingBucketUploadsLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Bucket uploads needing attention</span>
              <strong>{dashboard.storage.customerUsage.failedBucketUploadsLabel}</strong>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
