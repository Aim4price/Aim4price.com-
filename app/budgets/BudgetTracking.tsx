'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import FilterFlow, { FilterQuestion } from '../../components/FilterFlow';
import { budgetStatusLabel, filterTrackedBudgets, EMPTY_BUDGET_FILTERS, type TrackedBudget } from '../../lib/budget-tracking';
import { downloadCanonicalReportFile } from '../../lib/report-open';
import ledger from '../my-invoices/page.module.css';
import styles from './page.module.css';
const money = (value: number) => `R ${value.toLocaleString('en-US', { maximumFractionDigits: 2 }).replace(/,/g, ' ').replace('.', ',')}`;
function Icon({ kind }: { kind: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={kind === 'add' ? 'M12 5v14M5 12h14' : kind === 'download' ? 'M12 3v12m-5-5 5 5 5-5M5 20h14' : kind === 'filter' ? 'M4 6h16M7 12h10M10 18h4' : kind === 'alerts' ? 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4' : kind === 'manage' ? 'M4 7h16M4 17h16M8 4v6M16 14v6' : 'M5 3h14v18H5zM9 7h6M9 12h6M9 17h6'} /></svg>;
}
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className={styles.overlay} data-website-overlay onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} tabIndex={-1} className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header>{children}</div>
  </div>;
}
export default function BudgetTracking({ budgets, loading, error, onRetry, onAdd, onEdit, onDelete }: {
  budgets: TrackedBudget[]; loading: boolean; error: string; onRetry: () => void;
  onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_BUDGET_FILTERS);
  const [draft, setDraft] = useState(EMPTY_BUDGET_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const visible = filterTrackedBudgets(budgets, query, filters);
  const attention = budgets.filter(b => b.status !== 'on_track').length;
  const count = Object.values(filters).filter(v => v !== 'all').length;
  const selected = budgets.find(b => b.id === manageId);
  const ready = !loading && !error;
  async function download(format: 'pdf' | 'xlsx') {
    const params = new URLSearchParams({ format, q: query, ...filters });
    const url = `/api/my-invoices/budgets/report?${params}`;
    setDownloadError('');
    const reportWindow = format === 'pdf' ? window.open('', '_blank') : null;
    if (format === 'pdf' && !reportWindow) {
      setDownloadError('Allow pop-ups to open your budget report.');
      return;
    }
    if (reportWindow) {
      reportWindow.opener = null;
      reportWindow.document.title = 'Preparing budget report';
      reportWindow.document.body.textContent = 'Preparing your budget report…';
    }
    setDownloading(true);
    try {
      if (format === 'xlsx') {
        await downloadCanonicalReportFile(url);
      } else {
        const response = await fetch(url, { credentials: 'same-origin', headers: { 'x-aim4price-client-realm': 'website' } });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('Unable to prepare the budget PDF. Please try again.');
        const objectUrl = URL.createObjectURL(await response.blob());
        if (reportWindow && !reportWindow.closed) reportWindow.location.replace(objectUrl);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      }
      setDownloadOpen(false);
    } catch (e) {
      reportWindow?.close();
      setDownloadError(e instanceof Error ? e.message : 'Download failed.');
    }
    finally { setDownloading(false); }
  }
  return <div className={styles.page}>
    <section className={ledger.pageTitleBlock}><div><h1>BUDGET TRACKING SYSTEM</h1></div></section>
    <section className={ledger.costActionGrid} aria-label="Budget actions">
      <button className={`${ledger.secondaryButton} ${ledger.costActionButton} ${ledger.costActionAdd}`} data-budget-trigger="add" onClick={onAdd} disabled={!ready}><Icon kind="add" />Add Budget</button>
      <button className={`${ledger.secondaryButton} ${ledger.costActionButton} ${styles.alertButton}`} onClick={() => setFilters({ ...EMPTY_BUDGET_FILTERS, status: filters.status === 'attention' ? 'all' : 'attention' })} aria-pressed={filters.status === 'attention'} disabled={!ready}><Icon kind="alerts" />Alerts {attention ? `(${attention})` : ''}</button>
      <Link className={`${ledger.secondaryButton} ${ledger.costActionButton} ${ledger.costActionBudgets}`} href="/my-invoices"><Icon kind="ledger" />Cost Ledger</Link>
      <button className={`${ledger.primaryButton} ${ledger.costActionButton} ${ledger.costActionDownload}`} onClick={() => setDownloadOpen(true)} disabled={!ready || !visible.length}><Icon kind="download" />Download</button>
    </section>
    <div className={styles.searchRow}>
      <input type="search" placeholder="Search budgets by asset or period..." aria-label="Search budgets" value={query} onChange={e => setQuery(e.target.value)} />
      <button className={styles.filterButton} onClick={() => { setDraft(filters); setFilterOpen(true); }}><Icon kind="filter" />Filter {count ? `(${count})` : ''}</button>
    </div>
    {count || query ? <div className={styles.results}><span>{visible.length} matching budgets{filters.status === 'attention' ? ' · Alerts' : ''}</span><button onClick={() => { setFilters(EMPTY_BUDGET_FILTERS); setQuery(''); }}>Clear filters</button></div> : null}
    {loading ? <p role="status">Loading budgets…</p> : error ? <div role="alert"><p>{error}</p><button onClick={onRetry}>Try again</button></div> : !visible.length ? <div className={ledger.emptyState}>{budgets.length ? 'No budgets match these filters.' : 'No budgets yet. Add a budget to start tracking spending.'}</div> : null}
    {ready ? visible.map(budget => <article id={`cost-budget-${budget.id}`} key={budget.id} className={styles.card} data-status={budget.status}>
      <div className={styles.cardHeading}><div><h2>{budget.assetTitle}</h2><p>{budget.period === 'monthly' ? 'Monthly' : 'Annual'} · {budget.periodLabel}</p></div><span className={styles.status}>{budgetStatusLabel(budget)}</span></div>
      <div className={styles.cardBody}><div>
        <dl className={styles.metrics}><div><dt>Spent</dt><dd>{money(budget.spent)}</dd></div><div><dt>Budget</dt><dd>{money(budget.amount)}</dd></div><div><dt>{budget.overBy > 0 ? 'Over budget' : 'Remaining'}</dt><dd>{money(budget.overBy > 0 ? budget.overBy : budget.remaining)}</dd></div></dl>
        <div className={styles.track} role="progressbar" aria-label={`${budget.assetTitle} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, budget.percentUsed))} aria-valuetext={`${budget.percentUsed}% used${budget.overBy > 0 ? `, ${money(budget.overBy)} over budget` : ''}`}><span style={{ width: `${Math.min(100, Math.max(0, budget.percentUsed))}%` }} /><i style={{ left: `${budget.warningPercent}%` }} aria-hidden="true" /></div>
        <div className={styles.progressLabels}><span>{budget.overBy > 0 ? `${money(budget.overBy)} over budget` : `Alert at ${budget.warningPercent}%`}</span><strong>{budget.percentUsed.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}% used</strong></div>
      </div><div className={styles.cardActions}><Link href={`/my-invoices?budgetId=${encodeURIComponent(budget.id)}&view=costs`}><Icon kind="ledger" />View costs</Link><button data-budget-trigger={budget.id} onClick={() => setManageId(budget.id)}><Icon kind="manage" />Manage</button></div></div>
      <div className={styles.meta}><span>Fuel {budget.includeFuelSlipCosts ? 'included' : 'excluded'}</span><span>Amounts incl. VAT</span></div>
    </article>) : null}
    {filterOpen ? <FilterFlow title="Filter budgets" onClose={() => setFilterOpen(false)} onClear={() => setFilters(EMPTY_BUDGET_FILTERS)} onApply={() => { setFilters(draft); setFilterOpen(false); }}>
      <FilterQuestion label="Which asset?" searchable value={draft.asset} onChange={asset => setDraft({ ...draft, asset })} options={[{ value: 'all', label: 'All budget scopes' }, ...Array.from(new Map(budgets.map(b => [b.assetId || 'overall', { value: b.assetId || 'overall', label: b.assetTitle }])).values())]} />
      <FilterQuestion label="Which period?" value={draft.period} onChange={period => setDraft({ ...draft, period })} options={[{ value: 'all', label: 'Monthly and annual' }, { value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} />
      <FilterQuestion label="Which status?" value={draft.status} onChange={status => setDraft({ ...draft, status })} options={[{ value: 'all', label: 'All statuses' }, { value: 'on_track', label: 'Within budget' }, { value: 'warning', label: 'Approaching limit' }, { value: 'over_budget', label: 'Limit reached or exceeded' }, { value: 'attention', label: 'All alerts' }]} />
    </FilterFlow> : null}
    {selected ? <Dialog title="Manage budget" onClose={() => setManageId(null)}><p>{selected.assetTitle} · {selected.periodLabel}</p><div className={styles.dialogActions}><button onClick={() => { setManageId(null); onEdit(selected.id); }}>Edit budget & alerts</button><button className={styles.deleteButton} onClick={() => { setManageId(null); onDelete(selected.id); }}>Delete budget</button></div></Dialog> : null}
    {downloadOpen ? <Dialog title="Download budgets" onClose={() => { if (!downloading) setDownloadOpen(false); }}><p>{visible.length} matching budgets · Amounts incl. VAT</p><div className={styles.dialogActions}><button disabled={downloading} onClick={() => void download('pdf')}>PDF report</button><button disabled={downloading} onClick={() => void download('xlsx')}>{downloading ? 'Preparing…' : 'Excel workbook'}</button></div>{downloadError ? <p role="alert">{downloadError}</p> : null}</Dialog> : null}
  </div>;
}
