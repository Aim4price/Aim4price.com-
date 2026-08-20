'use client';

import styles from './CaptureRequestStatusList.module.css';

export type CaptureRequestStatusItem = {
  id: string;
  referenceCode: string;
  requestType: 'invoice' | 'fuel_slip';
  status: string;
  targetLabel?: string | null;
  submittedAtIso: string;
  dueAtIso: string;
  outputRecordId?: string | null;
};

type CaptureRequestStatusListProps = {
  requests: CaptureRequestStatusItem[];
  title?: string;
  emptyLabel?: string;
  onReview?: (requestId: string) => void;
};

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Received',
  in_progress: 'With Aim4price',
  waiting_for_customer: 'Waiting for you',
  needs_information: 'Waiting for you',
  awaiting_owner_approval: 'Ready for approval',
  awaiting_owner: 'Ready for approval',
  completing: 'Being completed',
  completed: 'Completed',
  duplicate: 'Already saved',
  rejected: 'Could not process',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? 'Received';
}

function formatDueDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'within 24 hours';
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function isOverdue(request: CaptureRequestStatusItem): boolean {
  if (!request.dueAtIso || ['completed', 'duplicate', 'declined', 'rejected', 'cancelled'].includes(request.status)) return false;
  const dueAt = new Date(request.dueAtIso).getTime();
  return Number.isFinite(dueAt) && dueAt < Date.now();
}

export default function CaptureRequestStatusList({
  requests,
  title = 'Being captured',
  emptyLabel = '',
  onReview,
}: CaptureRequestStatusListProps) {
  if (!requests.length && !emptyLabel) return null;

  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Aim4price assisted capture</span>
          <h2>{title}</h2>
        </div>
        {requests.length ? <strong className={styles.count}>{requests.length}</strong> : null}
      </div>

      {requests.length ? (
        <div className={styles.list}>
          {requests.map((request) => {
            const overdue = isOverdue(request);
            return (
              <article className={styles.row} key={request.id}>
                <span className={styles.icon} aria-hidden="true">
                  {request.requestType === 'fuel_slip' ? 'F' : 'I'}
                </span>
                <div className={styles.details}>
                  <strong>{request.targetLabel || (request.requestType === 'fuel_slip' ? 'Fuel slip' : 'Invoice')}</strong>
                  <span>{request.referenceCode}</span>
                </div>
                <div className={styles.timing}>
                  <span className={`${styles.status} ${overdue ? styles.statusOverdue : ''}`}>
                    {overdue ? 'Overdue' : statusLabel(request.status)}
                  </span>
                  {!['completed', 'duplicate', 'declined', 'rejected', 'cancelled'].includes(request.status) ? (
                    <small>Expected by {formatDueDate(request.dueAtIso)}</small>
                  ) : null}
                </div>
                {request.status === 'awaiting_owner' && onReview ? (
                  <button type="button" className={styles.reviewButton} onClick={() => onReview(request.id)}>
                    Review
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : <p className={styles.empty}>{emptyLabel}</p>}
    </section>
  );
}
