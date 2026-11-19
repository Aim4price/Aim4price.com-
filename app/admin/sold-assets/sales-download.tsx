'use client';

import { useMemo, useState } from 'react';
import AdminSelect from '../../../components/AdminSelect';
import { saleMoney, saleTotals, type SaleRow } from '../../../lib/outcome-sales-report';
import styles from './page.module.css';

export function useOutcomeSelection() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  return {ids, toggle, clear: () => setIds(new Set()), select: (ids: string[]) => setIds(new Set(ids))};
}

export function SalesDownload({rows, selected, owners, owner, changeOwner, source}: {
  rows: SaleRow[]; selected: Set<string>; owners: Map<string,string>; owner: string;
  changeOwner: (id: string) => void; source: 'marketplace'|'assets';
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scope = useMemo(()=>selected.size ? rows.filter(row=>selected.has(row.id)) : rows,[rows,selected]);
  const totals = saleTotals(scope);

  async function download(format: 'pdf'|'xlsx') {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/outcome-report',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({source,format,ids:scope.map(row=>row.id)})});
      if (!response.ok) throw Error((await response.json().catch(()=>null))?.error || 'Download failed. Please retry.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      const ownerName = (owners.get(owner) || 'all-owners').replace(/[^\p{L}\p{N} -]/gu,'').slice(0,80);
      link.download = `Aim4price-${source}-${ownerName}.${format}`;
      link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Download failed. Please retry.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.salesReport} aria-label="Sales report">
    <div className={styles.reportHead}><div><h2>Sales report</h2>
      <p aria-live="polite">{scope.length} {selected.size ? 'selected' : 'matching'} outcomes · Values exclude VAT</p></div>
      <div className={styles.downloadActions}>
        <button disabled={busy || !scope.length} onClick={()=>download('pdf')}>Download PDF</button>
        <button disabled={busy || !scope.length} onClick={()=>download('xlsx')}>Download Excel</button>
      </div></div>
    <div className={styles.salesFigures}>
      <label>Asset owner<AdminSelect aria-label="Asset owner" value={owner} onChange={e=>changeOwner(e.target.value)}>
        <option value="">All owners</option>
        {[...owners].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=><option key={id} value={id}>{name}</option>)}
      </AdminSelect></label>
      <div><span>Total sold excl. VAT</span><strong>{saleMoney(totals.soldValue)}</strong></div>
      <div><span>Aim4price-assisted sales excl. VAT</span><strong>{saleMoney(totals.assistedValue)}</strong></div>
    </div>
    {totals.missing>0 && <p>{totals.missing} sold {totals.missing===1?'asset has':'assets have'} no recorded sale price.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
