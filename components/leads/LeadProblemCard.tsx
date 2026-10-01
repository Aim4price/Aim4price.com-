'use client';
import type { DealerMaintenanceTrackedAsset } from '../../lib/dealer-maintenance-tracker';
import styles from '../DealerMaintenanceTrackerClient.module.css';
function formatDate(value: string | null, includeTime = false): string {
  if (!value) return 'Not set';
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: value.includes('T') ? 'Africa/Johannesburg' : 'UTC',
  }).format(parsed);
}
export default function ProblemCard({
  problem,
  historical = false,
}: {
  problem: DealerMaintenanceTrackedAsset['loggedProblems'][number];
  historical?: boolean;
}) {
  const resolved = Boolean(problem.notedAtIso);
  return (
    <article className={`${styles.problemCard} ${resolved ? styles.problemCardResolved : ''}`}>
      <header>
        <div>
          <span>{historical ? 'Problem or note' : 'Active problem or note'}</span>
          <h4>{problem.summary || 'Logged problem or note'}</h4>
        </div>
        <strong className={resolved ? styles.problemResolved : styles.problemOpen}>
          {resolved ? 'Noted / resolved' : 'Open'}
        </strong>
      </header>
      <p>{problem.note}</p>
      <div className={styles.problemMetaGrid}>
        <div><span>Logged</span><strong>{formatDate(problem.createdAtIso, true)}</strong></div>
        <div><span>Logged by</span><strong>{problem.operatorName || 'Not recorded'}</strong></div>
        <div><span>Status</span><strong>{resolved ? 'Noted / resolved' : 'Open'}</strong></div>
        <div><span>Resolution</span><strong>{problem.notedAtIso ? formatDate(problem.notedAtIso, true) : 'Not resolved yet'}</strong></div>
      </div>
    </article>
  );
}
