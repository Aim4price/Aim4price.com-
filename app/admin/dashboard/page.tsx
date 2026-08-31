import Link from "next/link";
import AdminNavigation from "../../../components/AdminNavigation";
import { requireAdminPageAccess } from "../../../lib/account-access";
import { getAdminDashboardStats } from "../../../lib/admin-dashboard";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_TITLES: Record<string, string> = {
  "free-estimates": "Free estimates",
  "paid-estimates": "Saved valuations",
  "total-assets-saved": "Assets saved",
  "total-accounts-created": "Accounts created",
  "free-estimate-users": "Free-estimate users",
  "owner-accounts-created": "Owner accounts",
  "dealer-accounts-created": "Dealer accounts",
  "finance-accounts-created": "Finance accounts",
  "insurer-accounts-created": "Insurer accounts",
  "average-user-time": "Weekly user time",
  "aim4price-assets-saved": "Aim4price assets",
  "marketplace-advertised": "Marketplace listings",
  "asset-registers-created": "Asset registers",
};

function cardTitle(id: string, fallback: string): string {
  return CARD_TITLES[id] ?? fallback;
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
  ]);
  const overviewCards = dashboard.cards.filter((card) => overviewIds.has(card.id));
  const accountCards = dashboard.cards.filter((card) => accountIds.has(card.id));
  const productCards = dashboard.cards.filter((card) => productIds.has(card.id));
  const detailedCards = dashboard.cards.filter(
    (card) => card.id !== "storage" && !overviewIds.has(card.id) && !accountIds.has(card.id) && !productIds.has(card.id),
  );

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <h1>Dashboard</h1>
          </div>

          <AdminNavigation active="dashboard" />
        </header>

        <section className={styles.dashboardSection} aria-labelledby="overview-heading">
          <div className={styles.sectionHeading}>
            <h2 id="overview-heading">Overview</h2>
          </div>
          <div className={`${styles.grid} ${styles.overviewGrid}`}>
            {overviewCards.map((card) => (
              <article key={card.id} className={`${styles.card} ${card.id === "free-estimates" ? styles.featuredCard : ""}`}>
                <div className={styles.cardHeader}>
                  <h2>{cardTitle(card.id, card.title)}</h2>
                </div>
                <dl className={styles.values}>
                  {card.values.map((item) => (
                    <div key={`${card.id}-${item.label}`} className={styles.valueRow}>
                      <dt>{item.label}</dt><dd><strong>{item.value}</strong></dd>
                    </div>
                  ))}
                </dl>
                {card.href ? (
                  <Link href={card.href} className={styles.cardLink}>
                    {card.linkLabel ?? "Open details"}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {accountCards.length ? (
          <section className={styles.dashboardSection} aria-labelledby="accounts-heading">
            <div className={styles.sectionHeading}>
              <h2 id="accounts-heading">Accounts</h2>
            </div>
            <div className={styles.grid}>
              {accountCards.map((card) => (
                <article key={card.id} className={styles.card}>
                  <div className={styles.cardHeader}><h2>{cardTitle(card.id, card.title)}</h2></div>
                  <dl className={styles.values}>{card.values.map((item) => (
                    <div key={`${card.id}-${item.label}`} className={styles.valueRow}><dt>{item.label}</dt><dd><strong>{item.value}</strong></dd></div>
                  ))}</dl>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {productCards.length ? (
          <section className={styles.dashboardSection} aria-labelledby="product-heading">
            <div className={styles.sectionHeading}>
              <h2 id="product-heading">Product</h2>
            </div>
            <div className={styles.grid}>
              {productCards.map((card) => (
                <article key={card.id} className={styles.card}>
                  <div className={styles.cardHeader}><h2>{cardTitle(card.id, card.title)}</h2></div>
                  <dl className={styles.values}>{card.values.map((item) => (
                    <div key={`${card.id}-${item.label}`} className={styles.valueRow}><dt>{item.label}</dt><dd><strong>{item.value}</strong></dd></div>
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
            <summary><div><strong>More activity ({detailedCards.length})</strong></div></summary>
            <div className={styles.grid}>
              {detailedCards.map((card) => (
                <article key={card.id} className={styles.card}>
                  <div className={styles.cardHeader}><h2>{cardTitle(card.id, card.title)}</h2></div>
                  <dl className={styles.values}>{card.values.map((item) => (
                    <div key={`${card.id}-${item.label}`} className={styles.valueRow}><dt>{item.label}</dt><dd><strong>{item.value}</strong></dd></div>
                  ))}</dl>
                </article>
              ))}
            </div>
          </details>
        ) : null}

        <section className={styles.storageCard} aria-label="Storage source breakdown">
          <div>
            <h2>Storage</h2>
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
              <span>Accounts with files</span>
              <strong>{dashboard.storage.customerUsage.accountCountLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Average per account</span>
              <strong>{dashboard.storage.customerUsage.averageLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Median per account</span>
              <strong>{dashboard.storage.customerUsage.medianLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>90th percentile</span>
              <strong>{dashboard.storage.customerUsage.p90Label}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Added in 30 days</span>
              <strong>{dashboard.storage.customerUsage.addedLast30DaysLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Uploads processing</span>
              <strong>{dashboard.storage.customerUsage.pendingBucketUploadsLabel}</strong>
            </div>
            <div className={styles.storageRow}>
              <span>Uploads needing attention</span>
              <strong>{dashboard.storage.customerUsage.failedBucketUploadsLabel}</strong>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
