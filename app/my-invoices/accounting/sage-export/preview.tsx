'use client';
import { categoryForLine } from '../../../../lib/accounting-serial';
import { useState } from 'react';
import { parseExport } from '../../../../lib/accounting-export';
import { assetForLine } from '../../../../lib/accounting-serial';
const labels=['Invoice number','Line description','Line amount','Asset serial (optional)'];
export default function ExportPreview({assets}:{assets:{title:string;serialNumber:string}[]}) {
  const [file,setFile]=useState<File|null>(null);
  const [delimiter,setDelimiter]=useState(',');
  const [rows,setRows]=useState<string[][]>([]);
  const [cols,setCols]=useState([-1,-1,-1,-1]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [page,setPage]=useState(-1);
  function reset(){setRows([]);setPage(-1);setCols([-1,-1,-1,-1]);setError('');}
  async function open(){
    reset();
    if(!file || file.size>2_000_000) {setError('Choose a CSV or TSV file up to 2 MB.');return;}
    setBusy(true);
    try {setRows(parseExport(await file.text(),delimiter));}
    catch(e){setError(e instanceof Error?e.message:'Could not read file.');}
    finally{setBusy(false);}
  }
  function match(row:string[]){
    const serial=cols[3]>=0?row[cols[3]].trim():'';
    return assetForLine(row[cols[1]]+(serial?' S/N '+serial:''),assets)||'Asset unassigned';
  }
  return <>
    <p>Export one row per supplier bill line from Pastel Partner, Xpress, Sage 200 Evolution or another Sage edition. Include the invoice number, description and amount. Keep serial numbers as text.</p>
    <label>Supplier bill export <input disabled={busy} type="file" accept=".csv,.tsv,.txt" onChange={e=>{reset();setFile(e.target.files?.[0]||null);}}/></label>
    <p><label>Delimiter <select disabled={busy} value={delimiter} onChange={e=>{reset();setDelimiter(e.target.value);}}>
      <option value=",">Comma</option><option value=";">Semicolon</option><option value={'\t'}>Tab</option></select></label></p>
    <button disabled={busy||!file} onClick={open}>Read columns</button>
    {error && <p role="alert">{error}</p>}
    {!!rows.length && <><h2>Match your columns</h2>{labels.map((name,i)=><p key={name}><label>{name} <select value={cols[i]} onChange={e=>{setCols(cols.map((c,n)=>n===i?Number(e.target.value):c));setPage(-1);}}>
      <option value={-1}>{i===3?'Use description':'Choose column'}</option>{rows[0].map((s,k)=><option key={k} value={k}>{s||'Column '+(k+1)}</option>)}</select></label></p>)}
      <button disabled={cols.slice(0,3).includes(-1)||new Set(cols.filter(c=>c>=0)).size!==cols.filter(c=>c>=0).length} onClick={()=>setPage(0)}>Preview allocations</button></>}
    {page>=0 && <section><h2>Allocation preview</h2><p>{rows.length-1} lines · Amounts as exported · Preview only</p>
      <ul>{rows.slice(1+page*50,51+page*50).map((row,i)=><li key={i}><strong>{match(row)}</strong> · {categoryForLine(row[cols[1]]) ?? 'Uncategorised'}<br/>{row[cols[0]]} · {row[cols[1]]} · {row[cols[2]]}</li>)}</ul>
      {page>0 && <button onClick={()=>setPage(page-1)}>Previous</button>}{(page+1)*50<rows.length-1 && <button onClick={()=>setPage(page+1)}>Next</button>}</section>}
  </>;
}
