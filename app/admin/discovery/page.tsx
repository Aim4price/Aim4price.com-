import AdminNavigation from "../../../components/AdminNavigation";
import { requireAdminPageAccess } from "../../../lib/account-access";
import { getAdminDiscoveryReport } from "../../../lib/admin-global-assets";
import type {
  AdminAssetInterestFilter,
  AdminAssetLocationFilter,
  AdminAssetParticipationFilter,
  AdminAssetSort,
} from "../../../lib/admin-global-assets-shared";
import AdminDiscoveryClient from "./admin-discovery-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default async function AdminDiscoveryPage({
  searchParams = {},
}: {
  searchParams?: PageSearchParams;
}) {
  await requireAdminPageAccess();
  const report = await getAdminDiscoveryReport({
    search: first(searchParams.search),
    ownerUserId: first(searchParams.owner),
    province: first(searchParams.province),
    sector: first(searchParams.sector),
    participation: first(searchParams.participation) as AdminAssetParticipationFilter,
    location: first(searchParams.location) as AdminAssetLocationFilter,
    interest: first(searchParams.interest) as AdminAssetInterestFilter,
    lifecycleState: first(searchParams.lifecycle),
    sort: first(searchParams.sort) as AdminAssetSort,
    page: Number(first(searchParams.page) || 1),
    pageSize: Number(first(searchParams.pageSize) || 50),
    focusAssetId: first(searchParams.assetId),
  });

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p>Aim4price admin</p>
            <h1>Admin Discovery</h1>
            <span>
              Complete asset and owner directory · Updated {formatGeneratedAt(report.generatedAtIso)}
            </span>
          </div>
          <AdminNavigation active="discovery" />
        </header>

        <AdminDiscoveryClient initialReport={report} />
      </section>
    </main>
  );
}
