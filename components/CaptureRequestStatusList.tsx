'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './CaptureRequestStatusList.module.css';

export type CaptureRequestStatusItem = {
  id: string;
  referenceCode: string;
  requestType: 'invoice' | 'fuel_slip';
  status: string;
  canRetract?: boolean;
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
  onRetract?: (requestId: string) => Promise<void>;
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
  onRetract,
}: CaptureRequestStatusListProps) {
  const [retractCandidate, setRetractCandidate] = useState<CaptureRequestStatusItem | null>(null);
  const [isRetracting, setIsRetracting] = useState(false);
  const [retractError, setRetractError] = useState('');
  const keepButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!retractCandidate) return undefined;
    keepButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || isRetracting) return;
      setRetractCandidate(null);
      setRetractError('');
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRetracting, retractCandidate]);

  function openRetractConfirmation(request: CaptureRequestStatusItem) {
    setRetractCandidate(request);
    setRetractError('');
  }

  function closeRetractConfirmation() {
    if (isRetracting) return;
    setRetractCandidate(null);
    setRetractError('');
  }

  async function confirmRetraction() {
    if (!retractCandidate || !onRetract) return;
    setIsRetracting(true);
    setRetractError('');
    try {
      await onRetract(retractCandidate.id);
      setRetractCandidate(null);
    } catch (error) {
      setRetractError(error instanceof Error ? error.message : 'This submission could not be retracted. Please try again.');
    } finally {
      setIsRetracting(false);
    }
  }

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
                {(request.status === 'awaiting_owner' && onReview) || (request.canRetract && onRetract) ? (
                  <div className={styles.actions}>
                    {request.status === 'awaiting_owner' && onReview ? (
                      <button type="button" className={styles.reviewButton} onClick={() => onReview(request.id)}>
                        Review
                      </button>
                    ) : null}
                    {request.canRetract && onRetract ? (
                      <button
                        type="button"
                        className={styles.retractButton}
                        onClick={() => openRetractConfirmation(request)}
                      >
                        Retract
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : <p className={styles.empty}>{emptyLabel}</p>}

      {retractCandidate ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeRetractConfirmation}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-retract-title"
            aria-describedby="capture-retract-description"
            aria-busy={isRetracting}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className={styles.modalEyebrow}>Aim4price assisted capture</span>
            <h3 id="capture-retract-title">Retract this submission?</h3>
            <p id="capture-retract-description">
              Aim4price will stop processing it and it won&apos;t be added to your ledger.
            </p>
            <div className={styles.modalReference}>
              <strong>{retractCandidate.targetLabel || (retractCandidate.requestType === 'fuel_slip' ? 'Fuel slip' : 'Invoice')}</strong>
              <span>{retractCandidate.referenceCode}</span>
            </div>
            {retractError ? <p className={styles.modalError} role="alert">{retractError}</p> : null}
            <div className={styles.modalActions}>
              <button
                ref={keepButtonRef}
                type="button"
                className={styles.keepButton}
                onClick={closeRetractConfirmation}
                disabled={isRetracting}
              >
                Keep submission
              </button>
              <button
                type="button"
                className={styles.confirmRetractButton}
                onClick={() => void confirmRetraction()}
                disabled={isRetracting}
              >
                {isRetracting ? 'Retracting…' : 'Retract submission'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
