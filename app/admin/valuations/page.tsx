import AdminNavigation from '../../../components/AdminNavigation';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { getAdminValuationReport } from '../../../lib/admin-valuations';
import type {
  AdminValuationAccountFilter,
  AdminValuationModeFilter,
  AdminValuationRecordFilter,
  AdminValuationSort,
} from '../../../lib/admin-valuations-shared';
import AdminValuationsClient from './admin-valuations-client';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export default async function AdminValuationsPage({
  searchParams = {},
}: {
  searchParams?: PageSearchParams;
}) {
  await requireAdminPageAccess();
  const report = await getAdminValuationReport({
    search: first(searchParams.search),
    recordType: first(searchParams.type) as AdminValuationRecordFilter,
    valuationMode: first(searchParams.mode) as AdminValuationModeFilter,
    account: first(searchParams.account) as AdminValuationAccountFilter,
    sector: first(searchParams.sector),
    period: first(searchParams.period),
    sort: first(searchParams.sort) as AdminValuationSort,
    page: Number(first(searchParams.page) || 1),
    pageSize: Number(first(searchParams.pageSize) || 50),
  });

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p>Aim4price admin</p>
            <h1>Valuations</h1>
            <span>
              Every completed estimate and saved valuation · Updated{' '}
              {formatGeneratedAt(report.generatedAtIso)}
            </span>
          </div>
          <AdminNavigation active="valuations" />
        </header>

        <AdminValuationsClient initialReport={report} />
      </section>
    </main>
  );
}

