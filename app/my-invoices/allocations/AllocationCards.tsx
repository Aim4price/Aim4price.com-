'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Allocation } from '../../../lib/accounting-allocations';
import { categorySummary, costCategories } from '../../../lib/cost-categories';
import LedgerDetailsCard from '../../../components/LedgerDetailsCard';
import CostDetailIcon from '../../../components/CostDetailIcon';
import detail from '../../../components/CostDetailIcon.module.css';
import panel from '../../../components/CaptureRequestStatusList.module.css';
import { IconBase } from '../LedgerIcons';
import local from './allocation.module.css';
import { useLedgerCardFocus } from '../../../lib/use-ledger-card-focus';
import focus from '../../../components/LedgerCardFocus.module.css';
import options from '../../asset-register/page.module.css';
import account from '../../account/page.module.css';
import manage from '../../../components/asset-register/AssetGroupManagerModal.module.css';
import type { AssetOption } from '../my-invoices-client';
import styles from '../page.module.css';
import { ChevronDownIcon, ManageCostIcon, LinkedAssetIcon, ReportFileIcon } from '../LedgerIcons';
import { allocateCost, saveCostDetails, deleteCostAllocation } from './actions';

type Step = 'manage' | 'allocate' | 'edit' | 'delete';
const titles = {manage:'Manage cost', allocate:'Allocate to asset', edit:'Edit cost', delete:'Delete cost'};
const choices = [
  {step:'allocate', label:'Allocate to asset', sub:'Choose the asset for this cost.', icon:'asset'},
  {step:'edit', label:'Edit', sub:'Update the cost details.', icon:'document'},
  {step:'delete', label:'Delete', sub:'Remove this imported cost.', icon:'other'},
] as const;

export default function AllocationCards({rows, assets, status, money, dateLabel, onChanged}: {
  rows: Allocation[]; assets: AssetOption[]; status: string; money: (n:number)=>string; dateLabel:(date:string)=>string;
  onChanged:(message:string)=>Promise<void>;
}) {
  const [expanded,setExpanded] = useLedgerCardFocus('accounting-allocation');
  const [item,setItem] = useState<Allocation|null>(null);
  const [step,setStep] = useState<Step>('manage');
  const [search,setSearch] = useState('');
  const [asset,setAsset] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (item && !dialog.current?.open) dialog.current?.showModal();
  },[item]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!item || busy) return;
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      if (step === 'allocate') await allocateCost(item.id,item.version,asset,String(form.get('category') ?? ''));
      if (step === 'delete') await deleteCostAllocation(item.id,item.version);
      if (step === 'edit') await saveCostDetails(item.id,item.version,{
        supplier:String(form.get('supplier')), invoice:String(form.get('invoice')), date:String(form.get('date')),
        description:String(form.get('description')), category:String(form.get('category')), total:Number(form.get('total')),vat:form.get('vat') ? Number(form.get('vat')) : null,
      });
      setItem(null);
      await onChanged(step === 'allocate' ? 'Cost allocated to the asset.' : step === 'delete' ? 'Imported cost deleted.' : 'Cost details saved.');
    } catch {
      setError('Could not save this change. Refresh the list and try again.');
    } finally {
      setBusy(false);
    }
  }
  const matchingAssets = assets.filter(a => [a.title,a.serialNumber,a.meta].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  return <section className={styles.invoicePanel} aria-label="Needs approval">
    <div className={styles.invoiceList}>
      {status || !rows.length ? <section className={`${panel.panel} ${panel.approvals}`}><div className={panel.header}><h2>Needs approval</h2></div><p className={panel.empty}>{status || 'No costs need allocation.'}</p></section> : null}
      {rows.map(row => {
        const open=expanded === row.id;
        const toggle=()=>setExpanded(open ? null : row.id);
        return <LedgerDetailsCard key={row.id} data-ledger-card={`accounting-allocation:${row.id}`} expanded={open} onToggle={toggle}
          className={`${styles.invoiceRow} ${focus.card} ${expanded && !open ? focus.muted : ''}`}>
          <div className={styles.invoiceHeader}>
            <div className={styles.invoiceTitleBlock}>
              <h2 className={styles.invoiceTitle}>{row.supplier}</h2>
              <p className={styles.invoiceReference}><span>{row.needsCategory ? 'Choose category' : categorySummary([row.category])}</span><span>Invoice {row.invoice}</span><span>{dateLabel(row.date)}</span></p>
              <div className={styles.invoiceBadges}><span className={styles.invoiceAssetPill}><LinkedAssetIcon/>{assets.find(a=>a.id===row.suggestedAsset)?.title || 'Choose asset'}</span><span className={styles.invoiceSourceBadge}><ReportFileIcon/>{row.provider}</span></div>
            </div>
            <div className={styles.invoiceHeaderAside}>
              <div className={styles.invoiceValueBlock}><strong className={styles.invoicePrice}>{money(row.total)}</strong><span className={styles.invoiceVatLabel}>Incl. VAT</span></div>
              <div className={styles.rowActions}>
                <button className={`${styles.secondaryButtonSmall} ${styles.invoiceEditButton}`} aria-controls={`allocation-${row.id}`} aria-expanded={open} onClick={toggle}><ChevronDownIcon className={styles.invoiceDetailsChevron}/>{open?'Close':'Open'}</button>
                <button className={`${styles.secondaryButtonSmall} ${styles.invoiceManageButton}`} aria-haspopup="dialog" onClick={()=>{setStep('manage');setItem(row);setSearch('');setAsset(assets.find(a=>a.id===row.suggestedAsset)?.id ?? '');setError('');}}><ManageCostIcon className={styles.buttonIcon}/>Manage</button>
              </div>
            </div>
          </div>
          <div className={styles.invoiceDetails} hidden={!open} id={`allocation-${row.id}`}><h3>Cost details</h3>
            <div className={`${styles.invoiceDetailsGrid} ${detail.detailsGrid}`}>
              <dl className={detail.detailGroup}><div><dt><CostDetailIcon kind="asset"/>Asset</dt><dd>{assets.find(a=>a.id===row.suggestedAsset)?.title || 'Unallocated'}</dd></div><div><dt><CostDetailIcon kind="document"/>Source</dt><dd>{row.provider}</dd></div></dl>
              <dl className={detail.detailGroup}><div><dt><CostDetailIcon kind="calendar"/>Invoice date</dt><dd>{dateLabel(row.date)}</dd></div></dl>
              <dl className={detail.detailGroup}><div><dt><CostDetailIcon kind="money"/>Excl. VAT</dt><dd>{row.vat == null ? 'Not recorded' : money(row.total-row.vat)}</dd></div><div><dt><CostDetailIcon kind="percent"/>VAT</dt><dd>{row.vat == null ? 'Not recorded' : money(row.vat)}</dd></div></dl>
            </div>
            {row.description && <p className={`${styles.invoiceNotes} ${detail.descriptionNote}`}><strong className={detail.sectionHeading}><CostDetailIcon kind="document"/>Description</strong>{row.description}</p>}</div>
        </LedgerDetailsCard>;
      })}
    </div>
    {item && <dialog ref={dialog} data-website-overlay className={`${local.dialog} ${manage.accountModal} ${account.modalTheme} ${options.umbrellaAccountModal} ${options.optionsModal} ${manage.manageModal}`}
      aria-labelledby="allocation-title" onCancel={e=>{if(busy)e.preventDefault();}} onClose={()=>setItem(null)}
      onClick={e=>{if(!busy && e.target===dialog.current){const rect=dialog.current.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)setItem(null);}}}>
      <header className={`${options.modalHeader} ${options.optionsModalHeader} ${manage.manageHeader}`}>
        <div className={options.modalHeaderText}><h2 id="allocation-title">{titles[step]}</h2><p>{item.supplier} · {money(item.total)}</p></div>
        <button className={`${account.modalCloseButton} ${account.passwordModalCloseButton}`} data-modal-close="true" disabled={busy} onClick={()=>setItem(null)} aria-label="Close">×</button>
      </header>
      <div className={`${options.modalScrollBody} ${options.optionsScrollBody} ${manage.manageMenuBody}`}>
        {step==='manage' ? <div className={`${options.optionsContent} ${manage.manageMenuContent}`}><div className={`${options.optionsGrid} ${options.assetOptionsGrid} ${manage.manageMenuGrid}`}>
          {choices.map(c=><button key={c.step} className={`${options.optionActionButton} ${c.step==='delete'?options.optionDangerButton:options.optionFeaturedButton} ${manage.manageMenuAction}`} onClick={()=>setStep(c.step)}>
            <i className={`${manage.manageMenuIconTile} ${c.step==='delete'?manage.manageMenuRemoveIcon:manage.manageMenuEditIcon}`}><IconBase className={manage.manageMenuIconGlyph}>{c.step==='allocate' ? <path d="M3 7h6l2 2h10v12H3z M13 4h8m-3-3 3 3-3 3"/> : c.step==='edit' ? <path d="m16 3 5 5M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/> : <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>}</IconBase></i><span><strong>{c.label}</strong><small className={manage.menuOptionSubtitle}>{c.sub}</small></span>
          </button>)}
        </div></div> : <form onSubmit={submit} className={styles.invoiceFormCard}>
          {step==='allocate' && <><label className={styles.pickerToolbar}>Search assets<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Asset name or serial number"/></label>
            <div className={styles.assetList}>{matchingAssets.map(a=><button type="button" className={styles.assetRow} aria-pressed={asset===a.id} key={a.id} onClick={()=>setAsset(a.id)}><span className={styles.assetInfo}><strong>{a.title}</strong><small>{[a.serialNumber,a.meta].filter(Boolean).join(' · ')}</small></span>{asset===a.id?'✓':''}</button>)}
              {!matchingAssets.length && <p>No matching assets.</p>}</div>
            {item.needsCategory && <div className={styles.formGrid}><label>Cost category<select name="category" defaultValue="" required><option value="" disabled>Choose category</option>{costCategories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label></div>}</>}
          {step==='edit' && <div className={styles.formGrid}>
            <label className={styles.field}>Supplier<input name="supplier" defaultValue={item.supplier} required maxLength={180}/></label>
            <label className={styles.field}>Invoice number<input name="invoice" defaultValue={item.invoice} required maxLength={120}/></label>
            <label className={styles.field}>Invoice date<input type="date" name="date" required defaultValue={item.date}/></label>
            <label className={styles.field}>Total incl. VAT (R)<input type="number" step="0.01" min="0.01" name="total" required defaultValue={item.total}/></label>
            <label className={styles.field}>VAT included (R)<input type="number" step="0.01" min="0" name="vat" defaultValue={item.vat ?? ''}/></label>
            <label className={styles.field}>Category<select name="category" defaultValue={item.category}>{costCategories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
            <label className={styles.field}>Description<textarea name="description" maxLength={5000} defaultValue={item.description}/></label>
          </div>}
          {step==='delete' && <p>Remove invoice {item.invoice} from Needs approval? Importing the same line again will keep it removed.</p>}
          {error && <p role="alert">{error}</p>}
          <footer className={styles.modalFooter}><button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>{setStep('manage');setError('');}}>Back</button>
            <button className={step==='delete'?styles.dangerButtonSmall:styles.primaryButton} disabled={busy||(step==='allocate'&&!asset)}>{busy?'Saving…':step==='delete'?'Delete':step==='edit'?'Save changes':'Allocate to asset'}</button></footer>
        </form>}
      </div>
    </dialog>}
  </section>;
}
