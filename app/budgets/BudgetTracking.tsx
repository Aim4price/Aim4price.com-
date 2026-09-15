'use client';
import Link from 'next/link';
import BudgetCostDetails from './BudgetCostDetails';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import FilterFlow, { FilterQuestion } from '../../components/FilterFlow';
import { budgetStatusLabel, filterTrackedBudgets, EMPTY_BUDGET_FILTERS, type TrackedBudget } from '../../lib/budget-tracking';
import { downloadCanonicalReportFile } from '../../lib/report-open';
import ledger from '../my-invoices/page.module.css';
import styles from './page.module.css';
const money = (value: number) => `R ${value.toLocaleString('en-US', { maximumFractionDigits: 2 }).replace(/,/g, ' ').replace('.', ',')}`;
function Icon({ kind }: { kind: string }) {
  if (kind === 'manage') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></svg>;
  if (kind === 'search') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    <div className={`${ledger.invoiceToolbar} ${ledger.ownerInvoiceToolbar}`}>
      <label className={ledger.searchWrap}><Icon kind="search" /><input className={ledger.searchInput} type="search" placeholder="Search budgets by asset or period..." aria-label="Search budgets" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button className={`${ledger.secondaryButton} ${ledger.toolbarButton} ${ledger.toolbarFilterButton} ${ledger.searchFilterButton}`} onClick={() => { setDraft(filters); setFilterOpen(true); }}><Icon kind="filter" />Filter {count ? `(${count})` : ''}</button>
    </div>
    {count || query ? <div className={styles.results}><span>{visible.length} matching budgets{filters.status === 'attention' ? ' · Alerts' : ''}</span><button onClick={() => { setFilters(EMPTY_BUDGET_FILTERS); setQuery(''); }}>Clear filters</button></div> : null}
    {loading ? <p role="status">Loading budgets…</p> : error ? <div role="alert"><p>{error}</p><button onClick={onRetry}>Try again</button></div> : !visible.length ? <div className={ledger.emptyState}>{budgets.length ? 'No budgets match these filters.' : 'No budgets yet. Add a budget to start tracking spending.'}</div> : null}
    {ready ? visible.map(budget => <article id={`cost-budget-${budget.id}`} key={budget.id} className={`${ledger.invoiceRow} ${styles.card}`} data-status={budget.status}>
      <div className={styles.cardHeading}>
        <div><h2 className={ledger.invoiceTitle}>{budget.assetTitle}</h2><p className={ledger.invoiceReference}>{budget.period === 'monthly' ? 'Monthly' : 'Annual'} · {budget.periodLabel}</p></div>
        <div className={styles.spentBlock}><strong className={ledger.invoicePrice}>{money(budget.spent)}</strong><span className={ledger.invoiceVatLabel}>Spent incl. VAT</span></div>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.progressBlock}>
          <div className={styles.track} role="progressbar" aria-label={`${budget.assetTitle} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, budget.percentUsed))} aria-valuetext={`${budget.percentUsed}% used${budget.overBy > 0 ? `, ${money(budget.overBy)} over budget` : ''}`}><span style={{ width: `${Math.min(100, Math.max(0, budget.percentUsed))}%` }} /><i style={{ left: `${budget.warningPercent}%` }} aria-hidden="true" /></div>
          <div className={styles.progressLabels}><span>{budgetStatusLabel(budget)} · {money(budget.amount)} budget</span><strong>{budget.percentUsed.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}% used</strong></div>
        </div>
        <div className={styles.cardActions}>
          <button type="button" className={`${ledger.secondaryButtonSmall} ${styles.viewCosts}`} aria-expanded={expandedId === budget.id} aria-controls={`budget-details-${budget.id}`} onClick={() => setExpandedId(expandedId === budget.id ? null : budget.id)}>
            <svg className={ledger.invoiceDetailsChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            {expandedId === budget.id ? 'Hide details' : 'View details'}
          </button>
          <button className={`${ledger.secondaryButtonSmall} ${ledger.invoiceManageButton}`} data-budget-trigger={budget.id} onClick={() => setManageId(budget.id)}><Icon kind="manage" />Manage</button>
        </div>
      </div>
      {expandedId === budget.id ? <section id={`budget-details-${budget.id}`} className={ledger.invoiceDetails} aria-label={`Costs allocated to ${budget.assetTitle}`}>
        <h3>Allocated costs</h3><BudgetCostDetails budget={budget} />
      </section> : null}
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
