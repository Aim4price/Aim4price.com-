'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  DealerOverviewData,
  DealerOverviewItem,
  DealerProblemPriority,
  DealerProblemWorkflowStatus,
} from '../../../lib/dealer-overview';
import overviewStyles from '../../field-manager/page.module.css';
import OverviewClearConfirmation, {
  type OverviewClearOutcome,
} from '../../field-manager/overview-clear-confirmation';
import dealerStyles from './dealer-overview.module.css';

type OverviewResponse = {
  ok: boolean;
  overview?: DealerOverviewData;
  error?: string;
};

type AssignmentDraft = {
  assignedStaffId: string;
  priority: DealerProblemPriority;
  workflowStatus: DealerProblemWorkflowStatus;
  dueDate: string;
};

const TYPE_LABELS: Record<DealerOverviewItem['type'], string> = {
  problem: 'Problem',
  service: 'Service',
  checkup: 'Checkup',
};

const defaultDraft: AssignmentDraft = {
  assignedStaffId: '',
  priority: 'normal',
  workflowStatus: 'new',
  dueDate: '',
};

function cardClassName(item: DealerOverviewItem): string {
  const attentionClass = item.section === 'needs_attention'
    ? overviewStyles.overviewCardNeedsAttention
    : item.status === 'due_soon'
      ? overviewStyles.overviewCardDueSoon
      : '';

  return [overviewStyles.overviewCard, attentionClass].filter(Boolean).join(' ');
}

function errorText(payload: OverviewResponse | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
}

export default function DealerOverviewClient({ initialOverview }: { initialOverview: DealerOverviewData }) {
  const [overview, setOverview] = useState(initialOverview);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState('');
  const [assignmentItem, setAssignmentItem] = useState<DealerOverviewItem | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>(defaultDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [clearCandidate, setClearCandidate] = useState<DealerOverviewItem | null>(null);
  const [clearingItemId, setClearingItemId] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return overview.items;
    return overview.items.filter((item) => [
      item.assetTitle,
      item.headline,
      item.detail,
      item.notes,
      item.assignedStaffName,
      TYPE_LABELS[item.type],
      item.statusLabel,
    ].join(' ').toLocaleLowerCase().includes(query));
  }, [overview.items, searchQuery]);
  const needsAttentionItems = visibleItems.filter((item) => item.section === 'needs_attention');
  const comingUpItems = visibleItems.filter((item) => item.section === 'coming_up');
  const hasSearchQuery = searchQuery.trim().length > 0;

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch('/api/dealer/overview', {
          credentials: 'include',
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null) as OverviewResponse | null;
        if (!cancelled && response.ok && payload?.ok && payload.overview) {
          setOverview(payload.overview);
          setLoadError('');
        }
      } catch {
        // Keep the last successful overview during temporary connection failures.
      }
    }
    const interval = window.setInterval(() => void refresh(), 30_000);
    const handleFocus = () => void refresh();
    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  function openAssignment(item: DealerOverviewItem) {
    setAssignmentItem(item);
    setAssignmentDraft({
      assignedStaffId: item.assignedStaffId ?? '',
      priority: item.priority,
      workflowStatus: item.workflowStatus,
      dueDate: item.dueDate ?? '',
    });
    setLoadError('');
  }

  async function saveAssignment() {
    if (!assignmentItem || isSaving) return;
    setIsSaving(true);
    setLoadError('');
    try {
      const response = await fetch(
        `/api/dealer/overview/problems/${encodeURIComponent(assignmentItem.sourceId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assignmentDraft),
        },
      );
      const payload = await response.json().catch(() => null) as OverviewResponse | null;
      if (!response.ok || !payload?.ok || !payload.overview) {
        throw new Error(errorText(payload, 'The problem assignment could not be saved.'));
      }
      setOverview(payload.overview);
      setAssignmentItem(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The problem assignment could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  async function clearOverviewItem(item: DealerOverviewItem, outcome: OverviewClearOutcome) {
    if (clearingItemId) return;
    setClearingItemId(item.id);
    setLoadError('');
    try {
      const response = await fetch('/api/dealer/overview/clear', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          sourceId: item.sourceId,
          outcome,
        }),
      });
      const payload = await response.json().catch(() => null) as OverviewResponse | null;
      if (!response.ok || !payload?.ok || !payload.overview) {
        throw new Error(errorText(payload, 'The Overview item could not be cleared.'));
      }
      setOverview(payload.overview);
      setClearCandidate(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The Overview item could not be cleared.');
      setClearCandidate(null);
    } finally {
      setClearingItemId(null);
    }
  }

  function renderOverviewCard(item: DealerOverviewItem) {
    const canManage = overview.canManageAssignments && item.sourceKind === 'problem';
    const isClearing = clearingItemId === item.id;
    const hasPendingAction = Boolean(clearingItemId) || isSaving;
    return (
      <article key={`${item.id}:${item.sourceId}`} className={cardClassName(item)}>
        <h3>{item.assetTitle}</h3>
        <p className={overviewStyles.overviewHeadline}>{item.headline}</p>
        {item.detail.trim() ? <p className={overviewStyles.overviewDetail}>{item.detail}</p> : null}
        {item.notes.trim() ? <p className={overviewStyles.overviewNotes}>{item.notes}</p> : null}
        <div className={`${overviewStyles.overviewCardActions} ${canManage ? dealerStyles.dealerOverviewActionsThree : ''}`}>
          <button
            type="button"
            className={overviewStyles.overviewClearButton}
            onClick={() => setClearCandidate(item)}
            disabled={hasPendingAction}
            aria-busy={isClearing}
          >
            {isClearing ? 'Clearing…' : 'Clear'}
          </button>
          {canManage ? (
            <button
              type="button"
              className={overviewStyles.overviewClearButton}
              onClick={() => openAssignment(item)}
              disabled={hasPendingAction}
            >
              Assign
            </button>
          ) : null}
          <button
            type="button"
            className={`${overviewStyles.mobilePrimaryButton} ${overviewStyles.overviewOpenButton}`}
            onClick={() => window.location.assign(item.href)}
            disabled={hasPendingAction}
          >
            Open
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className={`${overviewStyles.mobilePage} ${overviewStyles.overviewPage} ${dealerStyles.dealerOverviewPage}`}>
      <section className={`${overviewStyles.assetsShell} ${overviewStyles.overviewShell}`}>
        <div className={overviewStyles.overviewIntro}>
          <h1>Overview</h1>
          <p>Needs attention and upcoming maintenance.</p>
        </div>

        <label className={overviewStyles.overviewSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search assets or maintenance"
            aria-label="Search overview"
          />
        </label>

        <p className={dealerStyles.dealerOverviewRole}>{overview.roleLabel} · Shared dealer view</p>

        {loadError ? <div className={overviewStyles.errorNotice} role="alert">{loadError}</div> : null}

        <div className={overviewStyles.overviewSections} aria-live="polite">
          <section className={overviewStyles.overviewSection} aria-labelledby="dealer-needs-attention-title">
            <div className={overviewStyles.overviewSectionHeading}>
              <h2 id="dealer-needs-attention-title">Needs attention</h2>
              <span aria-label={`${needsAttentionItems.length} items`}>{needsAttentionItems.length}</span>
            </div>
            {needsAttentionItems.length ? (
              <div className={overviewStyles.overviewList}>{needsAttentionItems.map(renderOverviewCard)}</div>
            ) : (
              <p className={overviewStyles.overviewEmpty}>
                {hasSearchQuery ? 'No matching items need attention.' : 'Nothing needs attention.'}
              </p>
            )}
          </section>

          <section className={overviewStyles.overviewSection} aria-labelledby="dealer-upcoming-title">
            <div className={overviewStyles.overviewSectionHeading}>
              <h2 id="dealer-upcoming-title">Upcoming</h2>
              <span aria-label={`${comingUpItems.length} items`}>{comingUpItems.length}</span>
            </div>
            {comingUpItems.length ? (
              <div className={overviewStyles.overviewList}>{comingUpItems.map(renderOverviewCard)}</div>
            ) : (
              <p className={overviewStyles.overviewEmpty}>
                {hasSearchQuery ? 'No matching upcoming items.' : 'Nothing upcoming.'}
              </p>
            )}
          </section>
        </div>
      </section>

      {clearCandidate ? (
        <OverviewClearConfirmation
          assetTitle={clearCandidate.assetTitle}
          itemLabel={TYPE_LABELS[clearCandidate.type]}
          itemType={clearCandidate.type}
          isClearing={clearingItemId === clearCandidate.id}
          onCancel={() => setClearCandidate(null)}
          onConfirm={({ outcome }) => void clearOverviewItem(clearCandidate, outcome)}
        />
      ) : null}

      {assignmentItem ? (
        <div className={dealerStyles.dealerAssignmentOverlay}>
          <button
            type="button"
            className={dealerStyles.dealerAssignmentBackdrop}
            onClick={() => setAssignmentItem(null)}
            aria-label="Close assignment"
          />
          <section
            className={dealerStyles.dealerAssignmentModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dealer-assignment-title"
          >
            <header>
              <div>
                <span>Problem assignment</span>
                <h2 id="dealer-assignment-title">{assignmentItem.assetTitle}</h2>
                <p>{assignmentItem.headline}</p>
              </div>
              <button type="button" onClick={() => setAssignmentItem(null)} aria-label="Close assignment">×</button>
            </header>

            <div className={dealerStyles.dealerAssignmentFields}>
              <label>
                <span>Assign to</span>
                <select
                  value={assignmentDraft.assignedStaffId}
                  onChange={(event) => setAssignmentDraft((current) => ({
                    ...current,
                    assignedStaffId: event.target.value,
                    workflowStatus: event.target.value && current.workflowStatus === 'new' ? 'assigned' : current.workflowStatus,
                  }))}
                >
                  <option value="">Unassigned</option>
                  {overview.staff.map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.displayName} · {staff.roleLabel}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Priority</span>
                <select
                  value={assignmentDraft.priority}
                  onChange={(event) => setAssignmentDraft((current) => ({
                    ...current,
                    priority: event.target.value as DealerProblemPriority,
                  }))}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  value={assignmentDraft.workflowStatus}
                  onChange={(event) => setAssignmentDraft((current) => ({
                    ...current,
                    workflowStatus: event.target.value as DealerProblemWorkflowStatus,
                  }))}
                >
                  <option value="new">New</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In progress</option>
                  <option value="waiting">Waiting</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>

              <label>
                <span>Due date</span>
                <input
                  type="date"
                  value={assignmentDraft.dueDate}
                  onChange={(event) => setAssignmentDraft((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </label>
            </div>

            <footer>
              <button type="button" onClick={() => setAssignmentItem(null)} disabled={isSaving}>Cancel</button>
              <button type="button" onClick={() => void saveAssignment()} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save assignment'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
