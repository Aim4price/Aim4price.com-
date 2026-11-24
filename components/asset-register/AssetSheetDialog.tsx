'use client';
import { useState, type ClipboardEvent } from 'react';
import Link from 'next/link';
import { useLeadDialog } from '../leads/useLeadDialog';
import registerStyles from '../../app/asset-register/page.module.css';
import Select from '../AssetModalSelect';
import ShareModalCloseButton from './ShareModalCloseButton';
import { readPartsCsv } from '../../lib/parts-network-csv';
import { readPartsExcel } from '../../lib/parts-network-excel';
import { assetColumns, assetTitle, blankAsset, columns, mapAssetRow, mapHeading, maxAssets, rowErrors, usageUnit, targetColumn, type AssetRow, type Basis, type Column, type Mapping } from '../../lib/asset-sheet';
import parts from '../../app/dealer/parts/parts.module.css';
import css from './AssetSheetDialog.module.css';
type Stage = 'choose' | 'one' | 'file' | 'map' | 'edit' | 'review';
type Sheet = {
  name: string;
  rows: string[][];
};
const choices = [
  ['one', 'Add one asset', 'Get an estimate or enter your own value', 'blue', 'M12 5v14M5 12h14'],
  ['edit', 'Add in a sheet', 'Type or paste multiple assets', 'green', 'M3 3h18v18H3z M3 9h18M3 15h18M9 3v18'],
  ['file', 'Import file', 'Upload CSV or Excel', 'amber', 'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7'],
] as const;
const startColumns: Column[] = ['title', 'year', 'serial'];
const mappingChoices = [
  { value: '', label: 'Skip column' }, ...columns.map(value => ({ value, label: assetColumns[value] })),
  { value: 'hours', label: 'Usage in hours' }, { value: 'km', label: 'Usage in km' }, { value: 'percentage', label: 'Usage in %' },
];
export default function AssetSheetDialog({ registerId, registerName, valuationHref, onManual, onBack, onClose, onSaved, request }: {
  registerId: string;
  registerName: string;
  valuationHref: string;
  onManual: () => void;
  onBack: () => void;
  onClose: () => void;
  onSaved: (added: number, skipped: number) => void;
  request: typeof fetch;
}) {
  const [stage, setStage] = useState<Stage>('choose');
  const [rows, setRows] = useState<AssetRow[]>([blankAsset()]);
  const [visible, setVisible] = useState<Column[]>(startColumns);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [header, setHeader] = useState(true);
  const [basis, setBasis] = useState<Basis>('');
  const [example, setExample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [validate, setValidate] = useState(false);
  const [checks, setChecks] = useState<{
    skip: string;
  }[]>([]);
  const [token, setToken] = useState('');
  const [hosting, setHosting] = useState('');
  const [metered, setMetered] = useState(false);
  const [page, setPage] = useState(0);
  const [details, setDetails] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const filled = rows.filter(row => columns.some(key => row[key].trim()));
  const ready = checks.filter(c => !c.skip).length;
  const sheet = sheets[sheetIndex];
  const size = 20;
  const pages = Math.max(1, Math.ceil((stage === 'review' ? filled : rows).length / size));
  const currentPage = Math.min(page, pages - 1);
  const dialog = useLeadDialog(onClose, busy);
  function change(stage: Stage) { setStage(stage); setError(''); setPage(0); }
  function selectSheet(list: Sheet[], index: number, hasHeader: boolean) {
    const table = list[index].rows;
    if (!table.length)
      throw Error('The sheet has no asset rows.');
    if (table.length - (hasHeader ? 1 : 0) > maxAssets)
      throw Error('Import up to ' + maxAssets + ' assets at a time.');
    setSheets(list);
    setSheetIndex(index);
    setHeader(hasHeader);
    const width = Math.max(...table.map(r => r.length));
    setMapping(Array.from({ length: width }, (_, i) => hasHeader ? mapHeading(table[0][i] || '') : ''));
    change('map');
  }
  async function load(file: File) {
    setBusy(true);
    setError('');
    try {
      if (file.size > 5000000)
        throw Error('Choose a file smaller than 5 MB.');
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext !== 'xlsx' && ext !== 'csv')
        throw Error('Choose a CSV or .xlsx file.');
      const list = ext === 'xlsx' ? await readPartsExcel(await file.arrayBuffer(), 'assets') : [{ name: file.name, rows: readPartsCsv(await file.text()) }];
      if (!list[0]?.rows.length)
        throw Error('This file has no populated rows.');
      selectSheet(list, 0, true);
    }
    catch (e) {
      setError((e as Error).message);
    }
    finally {
      setBusy(false);
    }
  }
  function mapTable() {
    const used = mapping.filter(Boolean).map(targetColumn);
    if (!used.includes('title') && !(used.includes('make') && used.includes('model')))
      return setError('Match Asset name, or match both Make and Model.');
    const explicit = mapping.filter(Boolean);
    if (new Set(explicit).size !== explicit.length)
      return setError('Match each asset field only once.');
    const readings = mapping.map((key, i) => targetColumn(key) === 'usage' ? i : -1).filter(i => i >= 0);
    for (const cells of sheet.rows.slice(header ? 1 : 0)) {
      const populated = readings.filter(i => cells[i]?.trim());
      if (populated.length > 1)
        return setError('An asset has two usage readings. Match the column you want to keep.');
      const suppliedUnit = cells[mapping.indexOf('unit')];
      if (populated.length && suppliedUnit && mapping[populated[0]] !== 'usage' && usageUnit(suppliedUnit) !== mapping[populated[0]])
        return setError('The usage column and its unit disagree. Check the column matches.');
    }
    const mapped = sheet.rows.slice(header ? 1 : 0).map(r => mapAssetRow(r, mapping));
    if (!mapped.length)
      return setError('The sheet has no asset rows.');
    if (mapped.some(r => !columns.some(k => r[k])))
      return setError('Some rows have no mapped details. Check the column matches or remove empty asset rows from the source.');
    setRows(mapped);
    setVisible(columns.filter(k => k === 'title' || used.includes(k) || mapped.some(r => r[k])));
    setValidate(false);
    change('edit');
  }
  function edit(i: number, k: Column, value: string) { setRows(rows.map((r, j) => i === j ? { ...r, [k]: value } : r)); }
  function paste(e: ClipboardEvent<HTMLInputElement>, index: number, key: Column) {
    const text = e.clipboardData.getData('text/plain');
    if (!/[\n\t]/.test(text))
      return;
    e.preventDefault();
    try {
      const table = readPartsCsv(text, { delimiter: '\t' });
      if (!table.length)
        return;
      if (rows.length === 1 && !filled.length && index === 0 && key === 'title' && table[0].some(c => mapHeading(c))) {
        selectSheet([{ name: 'Pasted cells', rows: table }], 0, true);
        return;
      }
      const offset = visible.indexOf(key);
      if (table.some(r => r.length + offset > visible.length))
        throw Error('Add the missing columns first, or use Import file to paste a table with headings.');
      if (index + table.length > maxAssets)
        throw Error('Import up to ' + maxAssets + ' assets at a time.');
      const next = rows.map(r => ({ ...r }));
      table.forEach((cells, i) => { const r = next[index + i] ||= blankAsset(); cells.forEach((v, j) => r[visible[offset + j]] = v); });
      setRows(next);
      setError('');
    }
    catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit(save = false) {
    setValidate(true);
    setError('');
    const invalid = rows.findIndex(r => columns.some(k => r[k]) && Object.keys(rowErrors(r, basis)).length);
    if (invalid >= 0) {
      setPage(Math.floor(invalid / size));
      return setError('Check the highlighted cells in row ' + (invalid + 1) + '.');
    }
    if (!filled.length)
      return setError('Add at least one asset.');
    setBusy(true);
    try {
      const result = await request('/api/asset-register/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: save ? 'save' : 'preview', registerId, rows: filled, basis, token }) });
      const data = await result.json();
      if (!result.ok)
        throw Error(data.error || 'Could not review these assets.');
      if (save) {
        onSaved(data.added, data.skipped);
        return;
      }
      setToken(data.token);
      setHosting(data.hosting);
      setChecks(data.checks);
      setMetered(data.metered);
      change('review');
    }
    catch (e) {
      setError((e as Error).message);
    }
    finally {
      setBusy(false);
    }
  }
  async function template() {
    setBusy(true);
    try {
      const { Workbook } = await import('exceljs');
      const wb = new Workbook();
      const ws = wb.addWorksheet('Assets');
      ws.addRow(columns.map(k => assetColumns[k]));
      ws.columns.forEach(c => { c.width = 22; });
      ws.getColumn(columns.indexOf('serial') + 1).numFmt = '@';
      const url = URL.createObjectURL(new Blob([await wb.xlsx.writeBuffer()]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Aim4price-asset-template.xlsx';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    catch {
      setError('Could not download the template.');
    }
    finally {
      setBusy(false);
    }
  }
  return <div className={`${registerStyles.modalOverlay} ${registerStyles.assetEntryOverlay} ${css.overlay}`} data-website-overlay>
    <div className={registerStyles.modalBackdrop} data-website-overlay onClick={() => {
      if (!busy)
        onClose();
    }} />
    <section ref={dialog} tabIndex={-1} data-dialog-initial-focus className={`${parts.modal} ${parts.entryModal} ${css.dialog}`} aria-labelledby="add-asset-choice-title" role="dialog" aria-modal="true">
      <div className={parts.closeWrap}>
        <ShareModalCloseButton aria-label="Close add asset options" disabled={busy} onClick={onClose} />
      </div>
      <header className={parts.dialogHeader}>
        <h2 id="add-asset-choice-title">{{ choose: 'Add assets', one: 'Choose how to add an asset', file: 'Import assets', map: 'Match columns', edit: 'Edit asset sheet', review: 'Review assets' }[stage]}</h2>
        <p>{registerName}</p>
        <div className={parts.partsProgress} aria-hidden="true">
          <span style={{ width: ({ choose: 40, one: 70, file: 50, map: 65, edit: 80, review: 100 }[stage]) + '%' }} />
        </div>
      </header>
      <fieldset disabled={busy} className={css.body}>
        {stage === 'choose' && <>
          <div className={`${parts.shareChoices} ${parts.entryMethods}`}>{choices.map(([next, label, hint, tone, path]) => <button key={next} data-tone={tone} onClick={() => change(next)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d={path} />
            </svg>
            <span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
          </button>)}</div>
          <div className={parts.entryExample}>
            <button aria-expanded={example} onClick={() => setExample(!example)}>See an example</button>
          </div>
          {example && <div>
            <p>Enter an asset name, or use both make and model.</p>
            <table>
              <thead>
                <tr>
                  <th>Asset name</th>
                  <th>Year</th>
                  <th>Usage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Workshop compressor</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>Massey Ferguson 4708</td>
                  <td>2018</td>
                  <td>3 200 hours</td>
                </tr>
              </tbody>
            </table>
          </div>}</>}
        {stage === 'one' && <div className={parts.actions}>
          <Link className={css.link} href={valuationHref}>Aim4price Value</Link>
          <button onClick={onManual}>Manual Entry</button>
        </div>}
        {stage === 'file' && <>
          <label>Choose a CSV or Excel file<input aria-label="Upload asset file" type="file" accept=".xlsx,.csv" onChange={e => {
            const f = e.target.files?.[0]; if (f)
              void load(f);
          }} />
          </label>
          <details>
            <summary>Paste a table with headings</summary>
            <textarea aria-label="Paste spreadsheet" value={pasteText} onChange={e => setPasteText(e.target.value)} />
            <button disabled={!pasteText.trim()} onClick={() => {
              try {
                selectSheet([{ name: 'Pasted cells', rows: readPartsCsv(pasteText) }], 0, true);
              }
              catch (e) {
                setError((e as Error).message);
              }
            }}>Match columns</button>
          </details>
          <button onClick={() => void template()}>Download blank Excel template</button>
        </>}
        {stage === 'map' && sheet && <>
          <p>Match your headings to asset fields. Skip columns you do not need.</p>
          {sheets.length > 1 && <Select label="Worksheet" usePortal value={String(sheetIndex)} options={sheets.map((s, i) => ({ value: String(i), label: s.name }))} onChange={v => {
            try {
              selectSheet(sheets, Number(v), true);
            }
            catch (e) {
              setError((e as Error).message);
            }
          }} />}
          <label className={css.check}>
            <input type="checkbox" checked={header} onChange={e => {
              try {
                selectSheet(sheets, sheetIndex, e.target.checked);
              }
              catch (err) {
                setError((err as Error).message);
              }
            }} />First row contains headings</label>
          <div className={css.mapping}>{mapping.map((v, i) => <div key={i}>
            <b>{header ? sheet.rows[0][i] || 'Unnamed column' : 'Column ' + (i + 1)}</b>
            <small>{sheet.rows[header ? 1 : 0]?.[i]}</small>
            <Select label={'Match column ' + (i + 1)} usePortal value={v} options={mappingChoices} onChange={next => setMapping(mapping.map((m, j) => j === i ? next as Mapping : m))} />
          </div>)}</div>
        </>}
        {stage === 'edit' && <>
          <p>Add one asset per row. Enter an asset name, or use both make and model.</p>
          <div className={parts.actions}>
            <button onClick={() => setDetails(!details)} aria-expanded={details}>Add columns</button>
          </div>
          {details && <div className={parts.actions}>{columns.filter(k => !visible.includes(k)).map(k => <button key={k} onClick={() => setVisible([...visible, k])}>{assetColumns[k]}</button>)}</div>}
          {visible.includes('value') && <Select usePortal label="Current values in rand" placeholder="Choose VAT basis" value={basis} options={[{ value: 'excluded', label: 'Current values exclude VAT' }, { value: 'included', label: 'Current values include VAT' }]} onChange={v => setBasis(v as Basis)} />}
          <div className={css.scroll}>
            <table>
              <thead>
                <tr>
                  <th>#</th>{visible.map(k => <th key={k}>{assetColumns[k]}{k === 'title' ? ' (required)' : ''}</th>)}<th />
                </tr>
              </thead>
              <tbody>{rows.slice(currentPage * size, (currentPage + 1) * size).map((r, j) => {
                const i = currentPage * size + j, errors = validate && columns.some(k => r[k]) ? rowErrors(r, basis) : {};
                return <tr key={i}>
                  <th>{i + 1}</th>{visible.map(k => <td key={k}>
                    <input aria-label={assetColumns[k] + ' row ' + (i + 1)} value={r[k]} placeholder={k === 'unit' ? 'hours, km or %' : undefined} aria-invalid={!!errors[k]} onPaste={e => paste(e, i, k)} onChange={e => edit(i, k, e.target.value)} />{errors[k] && <small>{errors[k]}</small>}</td>)}<td>
                    <button aria-label={'Remove row ' + (i + 1)} onClick={() => setRows(rows.length === 1 ? [blankAsset()] : rows.filter((_, n) => n !== i))}>×</button>
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <button disabled={rows.length >= maxAssets} onClick={() => { setRows([...rows, blankAsset()]); setPage(Math.floor(rows.length / size)); }}>Add row</button>
        </>}
        {stage === 'review' && <>
          <p>
            <strong>{ready} ready to add</strong> · {checks.length - ready} skipped{metered ? ' · ' + ready + ' Business credits' : ''}</p>
          {hosting && <p>{hosting}</p>}
          <div className={css.scroll}>
            <table>
              <thead>
                <tr>
                  <th>Asset name</th>
                  <th>Serial / VIN</th>
                  <th>Current value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>{filled.slice(currentPage * size, (currentPage + 1) * size).map((r, j) => <tr key={j}>
                <td>{assetTitle(r)}</td>
                <td>{r.serial || '—'}</td>
                <td>{r.value ? 'R ' + r.value + (basis === 'included' ? ' incl. VAT' : ' excl. VAT') : 'Awaiting valuation'}</td>
                <td>{checks[currentPage * size + j]?.skip || 'Ready'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
        {(stage === 'review' || stage === 'edit') && pages > 1 && <div className={parts.actions}>
          <button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button>Page {currentPage + 1} of {pages}<button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>}
      </fieldset>
      {error && <p role="alert" className={parts.error}>{error}</p>}
      <footer className={parts.entryFooter}>
        <button disabled={busy} onClick={() => stage === 'choose' ? onBack() : change(stage === 'review' ? 'edit' : stage === 'map' ? 'file' : 'choose')}>Back</button>
        {stage === 'map' && <button className={parts.primary} disabled={busy} onClick={mapTable}>Edit sheet</button>}
        {stage === 'edit' && <button className={parts.primary} disabled={busy} onClick={() => void submit()}>Review assets</button>}
        {stage === 'review' && <button className={parts.primary} disabled={busy || !ready} onClick={() => void submit(true)}>{busy ? 'Adding assets…' : 'Add ' + ready + ' asset' + (ready === 1 ? '' : 's')}</button>}</footer>
    </section>
  </div>;
}
