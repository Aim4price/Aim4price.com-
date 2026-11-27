'use client';

import { useState } from 'react';
import type { BillLine } from '../../../lib/accounting-cloud';

export default function ImportLine({line,submitLine}:{line:BillLine;submitLine:(form:FormData)=>Promise<string>}) {
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [open,setOpen]=useState(false);
  if (line.amount != null && line.amount <= 0) return <small>Preview only · This line is not a positive cost</small>;
  if (!line.billKey || !line.lineKey) return <small>Preview only · Missing provider line reference</small>;
  async function submit(form:FormData) {
    setBusy(true);
    try { setMessage(await submitLine(form)); setOpen(false); }
    catch { setMessage('Could not import this line. Check the details and try again.'); }
    finally { setBusy(false); }
  }
  return <div>
    {!open && <button type="button" onClick={()=>{setOpen(true);setMessage('');}}>Import line</button>}
    {open && <form action={submit}>
      <label>Supplier<input name="supplier" required maxLength={180} defaultValue={line.supplier}/></label>
      <label>Invoice date<input name="date" type="date" required defaultValue={line.date}/></label>
      <label>Line total incl. VAT (ZAR)<input name="total" type="number" step="0.01" min="0.01" required defaultValue={line.grossZar}/></label>
      <label>VAT included (ZAR, if known)<input name="vat" type="number" step="0.01" min="0" defaultValue={line.vatZar}/></label>
      <button disabled={busy}>{busy?'Importing…':'Import'}</button>
      <button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </div>;
}
