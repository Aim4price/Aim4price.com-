'use client';
import ReportDownloadFlow from '../../components/ReportDownloadFlow';
import budgetModalStyles from '../../components/BudgetModal.module.css';
import ListPagination, { type ListPageSize } from '../../components/ListPagination';
import downloadStyles from '../../components/ReportDownload.module.css';
import Link from 'next/link';
import BudgetCostDetails from './BudgetCostDetails';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import FilterFlow, { FilterQuestion } from '../../components/FilterFlow';
import { budgetStatusLabel, filterTrackedBudgets, EMPTY_BUDGET_FILTERS, type TrackedBudget } from '../../lib/budget-tracking';
import { downloadCanonicalReportFile, openCanonicalReportUrl } from '../../lib/report-open';
import ledger from '../my-invoices/page.module.css';
import styles from './page.module.css';
const money = (value: number) => `R ${value.toLocaleString('en-US', { maximumFractionDigits: 2 }).replace(/,/g, ' ').replace('.', ',')}`;
function Icon({ kind }: { kind: string }) {
  if (kind === 'manage') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></svg>;
  if (kind === 'search') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={kind === 'add' ? 'M12 5v14M5 12h14' : kind === 'download' ? 'M12 3v12m-5-5 5 5 5-5M5 20h14' : kind === 'filter' ? 'M4 6h16M7 12h10M10 18h4' : kind === 'alerts' ? 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4' : kind === 'manage' ? 'M4 7h16M4 17h16M8 4v6M16 14v6' : 'M5 3h14v18H5zM9 7h6M9 12h6M9 17h6'} /></svg>;
}
function Dialog({ title, onClose, children, report = false }: { report?: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className={`${styles.overlay} ${report ? downloadStyles.backdrop : ''}`} data-website-overlay onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} tabIndex={-1} className={`${styles.dialog} ${report ? downloadStyles.dialog : budgetModalStyles.surface}`} data-download-dialog={report ? 'true' : undefined} role="dialog" aria-modal="true" aria-label={title} onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}><header className={report ? undefined : budgetModalStyles.header} data-download-header="true"><div className={budgetModalStyles.headerText}><h2>{title}</h2></div><button type="button" className={report ? undefined : budgetModalStyles.close} onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>{report ? '×' : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>}</button></header>{children}</div>
  </div>;
}
export default function BudgetTracking({ budgets, loading, error, onRetry, onAdd, onEdit, onDelete, scopeAssetId = '', reportAssets = [] }: {
  scopeAssetId?: string;
  reportAssets?: Array<{ id: string; title: string; serialNumber?: string; meta?: string }>;
  budgets: TrackedBudget[]; loading: boolean; error: string; onRetry: () => void;
  onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [pageSize, setPageSize] = useState<ListPageSize>(6);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState(EMPTY_BUDGET_FILTERS);
  const [draft, setDraft] = useState(EMPTY_BUDGET_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const visible = filterTrackedBudgets(budgets, query, filters);
  const pageLimit = pageSize === 'all' ? Math.max(1, visible.length) : pageSize;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageLimit));
  const safePage = Math.min(page, pageCount);
  const pagedBudgets = visible.slice((safePage - 1) * pageLimit, safePage * pageLimit);
  useEffect(() => { setPage(1); }, [query, filters]);
  useEffect(() => { setPage(current => Math.min(current, pageCount)); }, [pageCount]);
  const attention = budgets.filter(b => b.status !== 'on_track').length;
  const count = Object.values(filters).filter(v => v !== 'all').length;
  const selected = budgets.find(b => b.id === manageId);
  const ready = !loading && !error;

  return <div className={styles.page}>
    <section className={ledger.pageTitleBlock}><div><h1>BUDGET TRACKING SYSTEM</h1></div></section>
    <section className={ledger.costActionGrid} aria-label="Budget actions">
      <button className={`${ledger.secondaryButton} ${ledger.costActionButton} ${ledger.costActionAdd}`} data-budget-trigger="add" onClick={onAdd} disabled={!ready}><Icon kind="add" />Add Budget</button>
      <Link className={`${ledger.secondaryButton} ${ledger.costActionButton} ${ledger.costActionBudgets}`} href="/my-invoices"><Icon kind="ledger" />Cost Ledger</Link>
      <button className={`${ledger.secondaryButton} ${ledger.costActionButton} ${ledger.toolbarFilterButton} ${styles.alertButton}`} onClick={() => setFilters({ ...EMPTY_BUDGET_FILTERS, status: filters.status === 'attention' ? 'all' : 'attention' })} aria-pressed={filters.status === 'attention'} disabled={!ready}><Icon kind="alerts" />Alerts {attention ? `(${attention})` : ''}</button>
      <button className={`${ledger.primaryButton} ${ledger.costActionButton} ${ledger.costActionDownload}`} onClick={() => setDownloadOpen(true)} disabled={!ready || !budgets.length}><Icon kind="download" />Download</button>
    </section>
    <div className={`${ledger.invoiceToolbar} ${ledger.ownerInvoiceToolbar}`}>
      <label className={ledger.searchWrap}><Icon kind="search" /><input className={ledger.searchInput} type="search" placeholder="Search budgets by asset or period..." aria-label="Search budgets" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button className={`${ledger.secondaryButton} ${ledger.toolbarButton} ${ledger.toolbarFilterButton} ${ledger.searchFilterButton}`} onClick={() => { setDraft(filters); setFilterOpen(true); }}><Icon kind="filter" />Filter {count ? `(${count})` : ''}</button>
    </div>
    {count || query ? <div className={styles.results}><span>{visible.length} matching budgets{filters.status === 'attention' ? ' · Alerts' : ''}</span><button onClick={() => { setFilters(EMPTY_BUDGET_FILTERS); setQuery(''); }}>Clear filters</button></div> : null}
    {loading ? <p role="status">Loading budgets…</p> : error ? <div role="alert"><p>{error}</p><button onClick={onRetry}>Try again</button></div> : !visible.length ? <div className={ledger.emptyState}>{budgets.length ? 'No budgets match these filters.' : 'No budgets yet. Add a budget to start tracking spending.'}</div> : null}
    {ready ? pagedBudgets.map(budget => <article id={`cost-budget-${budget.id}`} key={budget.id} className={`${ledger.invoiceRow} ${styles.card}`} data-status={budget.status}>
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
    {ready && visible.length > 0 ? <ListPagination
      label="Budgets pagination"
      page={safePage}
      pageCount={pageCount}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={size => { setPageSize(size); setPage(1); }}
    /> : null}
    {filterOpen ? <FilterFlow title="Filter budgets" onClose={() => setFilterOpen(false)} onClear={() => setFilters(EMPTY_BUDGET_FILTERS)} onApply={() => { setFilters(draft); setFilterOpen(false); }}>
      <FilterQuestion label="Which asset?" searchable value={draft.asset} onChange={asset => setDraft({ ...draft, asset })} options={[{ value: 'all', label: 'All budget scopes' }, ...Array.from(new Map(budgets.map(b => [b.assetId || 'overall', { value: b.assetId || 'overall', label: b.assetTitle }])).values())]} />
      <FilterQuestion label="Which period?" value={draft.period} onChange={period => setDraft({ ...draft, period })} options={[{ value: 'all', label: 'Monthly and annual' }, { value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} />
      <FilterQuestion label="Which status?" value={draft.status} onChange={status => setDraft({ ...draft, status })} options={[{ value: 'all', label: 'All statuses' }, { value: 'on_track', label: 'Within budget' }, { value: 'warning', label: 'Approaching limit' }, { value: 'over_budget', label: 'Limit reached or exceeded' }, { value: 'attention', label: 'All alerts' }]} />
    </FilterFlow> : null}
    {selected ? <Dialog title="Manage budget" onClose={() => setManageId(null)}><div className={budgetModalStyles.context}><strong>{selected.assetTitle}</strong><span>{selected.periodLabel}</span></div><div className={`${styles.dialogActions} ${budgetModalStyles.actions}`}><button onClick={() => { setManageId(null); onEdit(selected.id); }}>Edit budget & alerts</button><button className={styles.deleteButton} onClick={() => { setManageId(null); onDelete(selected.id); }}>Delete budget</button></div></Dialog> : null}
    {downloadOpen ? <ReportDownloadFlow title="Budget reports" allLabel="All budgets" assets={Array.from(new Map(budgets.filter(b=>b.assetId).map(b=>[b.assetId!,{...reportAssets.find(asset=>asset.id === b.assetId),id:b.assetId!,title:b.assetTitle}])).values())} lockedAssetId={scopeAssetId || undefined} budgetPeriods
      fields={[{key:'period',label:'Budget period',initial:'all',options:[{value:'all',label:'Current month and year'},{value:'monthly',label:'Current monthly budgets'},{value:'annual',label:'Current annual budgets'}]},{key:'status',label:'Budget status',initial:'all',options:[{value:'all',label:'All statuses'},{value:'attention',label:'Needs attention'},{value:'on_track',label:'Within budget'}]}]}
      onClose={()=>setDownloadOpen(false)} onDownload={async selection=>{
        const params=new URLSearchParams({format:selection.format === 'pdf' ? 'html' : 'xlsx',asset:selection.assetId,period:selection.fields.period,status:selection.fields.status});
        const url='/api/my-invoices/budgets/report?'+params;
        if(selection.format === 'xlsx') await downloadCanonicalReportFile(url);
        else if(!openCanonicalReportUrl(url)) throw new Error('Allow pop-ups to open your report.');
      }} /> : null}
  </div>;
}
