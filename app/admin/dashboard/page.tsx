import Link from "next/link";
import AdminNavigation from "../../../components/AdminNavigation";
import { requireAdminPageAccess } from "../../../lib/account-access";
import { getAdminDashboardStats, type DashboardStatCard } from "../../../lib/admin-dashboard";
import { getAdminAttention } from "../../../lib/admin-attention";
import DashboardRefreshButton from "./refresh-button";
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
  "business-accounts-created": "Business accounts",
  "middleman-accounts-created": "Middleman accounts",
  "average-user-time": "Estimated weekly user time",
  "aim4price-assets-saved": "Aim4price assets",
  "marketplace-advertised": "Marketplace listings",
  "asset-registers-created": "Asset registers",
};

function cardTitle(id: string, fallback: string): string {
  return CARD_TITLES[id] ?? fallback;
}

function MetricCard({ card }: { card: DashboardStatCard }) {
  return (
    <article className={styles.card}>
      <h3>{cardTitle(card.id, card.title)}</h3>
      <dl className={styles.values}>
        {card.values.map((item) => (
          <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
        ))}
      </dl>
      {card.href && <Link className={styles.cardLink} href={card.href}>{card.linkLabel ?? "View details"}</Link>}
    </article>
  );
}

function PeriodTable({ cards, label }: { cards: DashboardStatCard[]; label: string }) {
  const periods = Array.from(new Set(cards.flatMap(card => card.values.map(item => item.label))));
  return (
    <div className={styles.tableWrap}>
      <table aria-label={label}>
        <thead><tr><th scope="col">{label}</th>{periods.map(period => <th key={period} scope="col">{period}</th>)}</tr></thead>
        <tbody>{cards.map(card => (
          <tr key={card.id}>
            <th scope="row">{card.href ? <Link className={styles.cardLink} href={card.href}>{cardTitle(card.id, card.title)}</Link> : cardTitle(card.id, card.title)}</th>
            {periods.map(period => <td key={period}>{card.values.find(item => item.label === period)?.value ?? "—"}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function DisclosureLabel() {
  return <span className={styles.disclosureLabel}><span className={styles.show}>Show details</span><span className={styles.hide}>Hide details</span></span>;
}

export default async function AdminDashboardPage() {
  await requireAdminPageAccess();
  const [dashboard, attention] = await Promise.all([getAdminDashboardStats(), getAdminAttention()]);
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
    "business-accounts-created",
    "middleman-accounts-created",
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

  const weeklyUsage = accountCards.find(card => card.id === "average-user-time");
  const marketplace = productCards.find(card => card.id === "marketplace-advertised");
  const productCounts = productCards.filter(card => card !== marketplace);
  const usage = dashboard.storage.customerUsage;
  const allClear = attention.length > 0 && attention.every(item => item.count === 0);
  const storageMetrics = [
    ["Accounts with files", usage.accountCountLabel],
    ["Added in 30 days", usage.addedLast30DaysLabel],
    ["Uploads processing", usage.pendingBucketUploadsLabel],
    ["Uploads needing attention", usage.failedBucketUploadsLabel],
  ];

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <h1>Dashboard</h1>
          <AdminNavigation active="dashboard" />
        </header>

        <section className={styles.attention} aria-labelledby="attention-heading">
          <div className={styles.sectionHeading}>
            <h2 id="attention-heading">Needs attention</h2>
            <DashboardRefreshButton />
          </div>
          <p>{allClear ? "No items need attention." : "A capture request can appear in more than one queue."}</p>
          <div className={styles.attentionGrid}>
            {attention.map(item => (
              <Link key={item.href} href={item.href} title={item.description} className={styles.queueLink}
                data-state={item.count === null ? "unknown" : item.count === 0 ? "clear" : item.urgent ? "urgent" : "open"}>
                <span>{item.label}</span>
                <strong>{item.count === null ? "Unavailable" : item.count.toLocaleString("en-ZA")}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="overview-heading">
          <h2 id="overview-heading">Overview</h2>
          <div className={styles.overviewGrid}>{overviewCards.map(card => <MetricCard key={card.id} card={card} />)}</div>
        </section>

        {accountCards.length > 0 && (
          <section className={styles.section} aria-labelledby="accounts-heading">
            <h2 id="accounts-heading">Accounts</h2>
            <div className={styles.panel}>
              <PeriodTable cards={accountCards.filter(card => card !== weeklyUsage)} label="Account type" />
              {weeklyUsage && <div className={styles.usage}>
                <strong>{cardTitle(weeklyUsage.id, weeklyUsage.title)}</strong>
                {weeklyUsage.values.map(item => <span key={item.label}>{item.label} <b>{item.value}</b></span>)}
              </div>}
            </div>
          </section>
        )}

        {productCards.length > 0 && (
          <section className={styles.section} aria-labelledby="product-heading">
            <h2 id="product-heading">Product</h2>
            <div className={styles.productGrid}>
              {productCounts.length > 0 && <div className={styles.panel}><PeriodTable cards={productCounts} label="Asset activity" /></div>}
              {marketplace && <MetricCard card={marketplace} />}
            </div>
          </section>
        )}

        {detailedCards.length > 0 && (
          <details className={styles.detailsSection}>
            <summary><strong>More activity ({detailedCards.length})</strong><DisclosureLabel /></summary>
            <PeriodTable cards={detailedCards} label="Activity" />
          </details>
        )}

        <section className={styles.section} aria-label="Storage source breakdown">
          <h2>Storage</h2>
          <div className={styles.panel}>
            <dl className={styles.storageSummary}>
              {storageMetrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <details className={styles.detailsSection}>
              <summary><strong>Storage breakdown</strong><DisclosureLabel /></summary>
              <div className={styles.storageGrid}>
                <div><h3>File sources</h3><dl className={styles.values}>
                  {dashboard.storage.sources.map(source => <div key={source.label}><dt>{source.label}</dt><dd>{source.value}</dd></div>)}
                </dl></div>
                <div><h3>Usage per account</h3><dl className={styles.values}>
                  <div><dt>Average per account</dt><dd>{usage.averageLabel}</dd></div>
                  <div><dt>Median per account</dt><dd>{usage.medianLabel}</dd></div>
                  <div><dt>90th percentile</dt><dd>{usage.p90Label}</dd></div>
                </dl></div>
              </div>
            </details>
          </div>
        </section>
      </section>
    </main>
  );
}
