'use client';
import { useLayoutEffect, useRef, useState, type ClipboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAssetFlowTransition } from './useAssetFlowTransition';
import { useLeadDialog } from '../leads/useLeadDialog';
import registerStyles from '../../app/asset-register/page.module.css';
import Select from '../AssetModalSelect';
import ShareModalCloseButton from './ShareModalCloseButton';
import { MAX_PARTS_CSV_BYTES, readPartsCsv } from '../../lib/parts-network-csv';
import { readPartsExcel } from '../../lib/parts-network-excel';
import { assetColumns, assetTitle, columnLabel, customColumn, hasAssetData, isCustomColumn, blankAsset, columns, type CustomColumn, mapAssetRow, mapHeading, maxAssets, rowErrors, usageUnit, targetColumn, type Column, type Mapping } from '../../lib/asset-sheet';
import parts from '../../app/dealer/parts/parts.module.css';
import SpreadsheetUpload from '../SpreadsheetUpload';
import uploadStyles from '../PartsImportForm.module.css';
import { columnLetter } from '../../lib/parts-import-mapping';
import AssetSheetEditor, { type AssetDraft } from './AssetSheetEditor';
import css from './AssetSheetDialog.module.css';
export type AssetSheetEntry = 'choose' | 'one' | 'edit' | 'file';
type Stage = AssetSheetEntry | 'multiple' | 'map' | 'review';
type Sheet = {
  name: string;
  rows: string[][];
};
const choices = {
  choose: [
    ['one', 'Add 1 asset', 'Value a single asset', 'blue', 'M12 5v14M5 12h14'],
    ['multiple', 'Add multiple assets', 'Enter or upload a list', 'green', 'M3 5h18v14H3z M3 10h18M3 14h18M8 5v14'],
  ],
  one: [
    ['valuation', 'Aim4price Value', 'Get an Aim4price estimate', 'blue', 'M3 4v16h18 M6 15l5-5 4 3 6-7'],
    ['manual', 'Manual Value', 'Enter your own value', 'green', 'M4 16l-1 5 5-1L20 8l-4-4z M13 7l4 4'],
  ],
  multiple: [
    ['edit', 'Add in a sheet', 'Type or paste multiple assets', 'green', 'M3 3h18v18H3z M3 9h18M3 15h18M9 3v18'],
    ['file', 'Import file', 'Upload CSV or Excel', 'amber', 'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7'],
  ],
} as const;
const startColumns: Column[] = ['title', 'year', 'serial'];
type Match = Mapping | 'skip' | 'new';
const mappingChoices = [
  { value: '', label: 'Choose a field' }, { value: 'skip', label: 'Skip column' }, ...columns.map(value => ({ value, label: assetColumns[value] })),
  { value: 'hours', label: 'Usage in hours' }, { value: 'km', label: 'Usage in km' }, { value: 'percentage', label: 'Usage in %' },
];
export default function AssetSheetDialog({ registerId, registerName, initialStage = 'choose', savedColumns = [], valuationHref, onManual, onBack, onClose, onSaved, request }: {
  registerId: string;
  registerName: string;
  initialStage?: AssetSheetEntry;
  savedColumns?: CustomColumn[];
  valuationHref: string;
  onManual: () => void;
  onBack: () => void;
  onClose: () => void;
  onSaved: (added: number, skipped: number) => void;
  request: typeof fetch;
}) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [draft, setDraft] = useState<AssetDraft>(() => ({ rows: [blankAsset()], visible: startColumns, custom: [], basis: '' }));
  const { rows, visible, basis, custom } = draft;
  const allColumns = [...columns, ...custom];
  const [undo, setUndo] = useState<AssetDraft | null>(null);
  const mappedSource = useRef<{ sheet: Sheet; signature: string } | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<Match[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [header, setHeader] = useState(true);
  const [example, setExample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [validate, setValidate] = useState(false);
  const [focusError, setFocusError] = useState<{ row: number; field: Column; vat: boolean } | null>(null);
  const [checks, setChecks] = useState<{
    skip: string;
  }[]>([]);
  const [token, setToken] = useState('');
  const [hosting, setHosting] = useState('');
  const [metered, setMetered] = useState(false);
  const [page, setPage] = useState(0);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const filled = rows.filter(hasAssetData);
  const ready = checks.filter(c => !c.skip).length;
  const sheet = sheets[sheetIndex];
  const sourceRows = sheet?.rows.slice(Number(header)) ?? [];
  const headingsOnly = Boolean(sheet && header && !sourceRows.length);
  const size = 20;
  const pages = Math.max(1, Math.ceil((stage === 'review' ? filled : rows).length / size));
  const currentPage = Math.min(page, pages - 1);
  const router = useRouter();
  const transition = useAssetFlowTransition();
  const dialog = useLeadDialog(onClose, busy || transition.pending);
  useLayoutEffect(() => {
    if (!focusError) return;
    const selector = focusError.vat ? 'button[aria-label="Current values in rand"]'
      : `[data-row="${focusError.row}"] input[data-field="${CSS.escape(focusError.field)}"]`;
    const target = dialog.current?.querySelector<HTMLElement>(selector);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'center', inline: 'center' });
    setFocusError(null);
  }, [focusError, dialog]);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(stage);
  useLayoutEffect(() => {
    if (previousStage.current !== stage) heading.current?.focus({ preventScroll: true });
    previousStage.current = stage;
  }, [stage]);
  const [history, setHistory] = useState<Stage[]>([]);
  function change(next: Stage) {
    if (stage !== next) setHistory(previous => [...previous, stage]);
    setStage(next);
    setError('');
    setPage(0);
  }
  function back() {
    const previous = history.at(-1);
    if (!previous) return onBack();
    setHistory(history.slice(0, -1));
    setStage(previous);
    setPage(0);
    setError('');
  }
  const cards = stage === 'choose' || stage === 'one' || stage === 'multiple' ? choices[stage] : null;
  const importStep = stage === 'file' || stage === 'map';
  const sheetStep = stage === 'edit' || stage === 'review';
  const sheetReturnLabel = stage === 'review' ? 'Edit sheet' : history.at(-1) === 'map' ? 'Change mapping' : null;
  const importCustom = [...new Set([...savedColumns, ...custom])];
  const matched: Mapping[] = [];
  const mappedCustom: CustomColumn[] = [];
  let mappingIssue = '';
  for (const [i, choice] of mapping.entries()) {
    if (!choice) mappingIssue ||= 'Choose a field or Skip for each column.';
    try {
      const key = choice === 'new' ? customColumn(names[i] || '', mappedCustom) : choice === 'skip' ? '' : choice;
      if (key && isCustomColumn(key)) {
        const canonical = importCustom.find(k => k.toLowerCase() === key.toLowerCase()) ?? key;
        if (choice !== 'new') customColumn(columnLabel(canonical), mappedCustom);
        mappedCustom.push(canonical);
        matched.push(canonical);
      } else matched.push(key);
    } catch (cause) { mappingIssue ||= (cause as Error).message; matched.push(''); }
  }
  if (!matched.includes('title') && !(matched.includes('make') && matched.includes('model'))) mappingIssue ||= 'Match Asset name, or both Make and Model.';
  function updateDraft(next: Partial<AssetDraft>, remember = true) {
    if (remember) setUndo(draft);
    setDraft(previous => ({ ...previous, ...next }));
    setError('');
  }
  function selectSheet(list: Sheet[], index: number, headerOverride?: boolean) {
    const table = list[index].rows;
    if (!table.length)
      throw Error('The sheet has no asset rows.');
    const hasHeader = headerOverride ?? table[0].some(cell => mapHeading(cell));
    if (table.length - (hasHeader ? 1 : 0) > maxAssets)
      throw Error('Import up to ' + maxAssets + ' assets at a time.');
    const width = table.reduce((max, cells) => Math.max(max, cells.length), 0);
    if (width > 100) throw Error('Use up to 100 columns per import.');
    const matched = new Set<Mapping>();
    const guessed = Array.from({ length: width }, (_, i): Match => {
      if (table.every(row => !row[i]?.trim())) return 'skip';
      const label = table[0][i]?.trim() || '';
      const key = hasHeader ? mapHeading(label) || importCustom.find(k => columnLabel(k).toLowerCase() === label.toLowerCase()) || '' : '';
      if (!key || matched.has(key)) return '';
      matched.add(key);
      return key;
    });
    setError('');
    setSheets(list);
    setSheetIndex(index);
    setHeader(hasHeader);
    if (stage === 'map' && list === sheets && index === sheetIndex) {
      const next = [...mapping];
      if (hasHeader) guessed.forEach((key, i) => {
        if (!next[i] && key && (key === 'skip' || !next.includes(key))) next[i] = key;
      });
      setMapping(next);
    } else {
      setNames(guessed.map((_, i) => hasHeader ? table[0][i]?.trim() || '' : ''));
      setMapping(guessed);
    }
    if (stage !== 'map') transition.start(dialog.current, 'Match columns', () => change('map'));
  }
  async function load(file: File) {
    setBusy(true);
    setError('');
    try {
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext !== 'xlsx' && ext !== 'csv')
        throw Error('Choose a CSV or .xlsx file.');
      if (ext === 'csv' && file.size > MAX_PARTS_CSV_BYTES) throw Error('Use a CSV file smaller than 2 MB.');
      if (ext === 'xlsx' && file.size > 5_000_000) throw Error('Use an Excel file smaller than 5 MB.');
      const list = ext === 'xlsx' ? await readPartsExcel(await file.arrayBuffer(), 'assets') : [{ name: file.name, rows: readPartsCsv(await file.text()) }];
      if (!list[0]?.rows.length)
        throw Error('This file has no populated rows.');
      selectSheet(list, 0);
    }
    catch (e) {
      setError((e as Error).message);
    }
    finally {
      setBusy(false);
    }
  }
  function mapTable() {
    if (mappingIssue) return setError(mappingIssue);
    const used = matched.map(targetColumn);
    const readings = matched.map((key, i) => targetColumn(key) === 'usage' ? i : -1).filter(i => i >= 0);
    for (const cells of sourceRows) {
      const populated = readings.filter(i => cells[i]?.trim());
      if (populated.length > 1)
        return setError('An asset has two usage readings. Match the column you want to keep.');
      const suppliedUnit = cells[mapping.indexOf('unit')];
      if (populated.length && suppliedUnit && mapping[populated[0]] !== 'usage' && usageUnit(suppliedUnit) !== mapping[populated[0]])
        return setError('The usage column and its unit disagree. Check the column matches.');
    }
    const mapped = sourceRows.map(r => mapAssetRow(r, matched));
    if (mapped.some(r => !hasAssetData(r)))
      return setError('Some rows have no mapped details. Check the column matches or remove empty asset rows from the source.');
    const signature = JSON.stringify([header, matched]);
    if (mappedSource.current?.sheet !== sheet || mappedSource.current.signature !== signature) {
      setDraft({ rows: headingsOnly ? [blankAsset()] : mapped, visible: [...columns, ...mappedCustom].filter(k => k === 'title' || used.includes(k) || mapped.some(r => r[k])), custom: mappedCustom, basis: '' });
      setUndo(null);
      mappedSource.current = { sheet, signature };
    }
    setValidate(false);
    transition.start(dialog.current, 'Edit asset sheet', () => change('edit'));
  }
  function paste(e: ClipboardEvent<HTMLInputElement>, index: number, key: Column, ordered: Column[]) {
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
      const offset = ordered.indexOf(key);
      if (table.some(r => r.length + offset > ordered.length))
        throw Error('Add the missing columns first, or use Import file to paste a table with headings.');
      if (index + table.length > maxAssets)
        throw Error('Import up to ' + maxAssets + ' assets at a time.');
      const next = rows.map(r => ({ ...r }));
      table.forEach((cells, i) => { const r = next[index + i] ||= blankAsset(); cells.forEach((v, j) => r[ordered[offset + j]] = v); });
      updateDraft({ rows: next });
    }
    catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit(save = false) {
    setValidate(true);
    setError('');
    const invalid = rows.findIndex(r => hasAssetData(r) && Object.keys(rowErrors(r, basis)).length);
    if (invalid >= 0) {
      const errors = rowErrors(rows[invalid], basis);
      const fields = allColumns.filter(k => errors[k]);
      const invalidFields = fields.filter(k => !visible.includes(k));
      if (invalidFields.length) setDraft({ ...draft, visible: [...visible, ...invalidFields] });
      setPage(Math.floor(invalid / size));
      setFocusError({ row: invalid, field: fields[0], vat: fields[0] === 'value' && !basis });
      return setError('Check the highlighted cells in row ' + (invalid + 1) + '.');
    }
    if (!filled.length)
      return setError('Add at least one asset.');
    setBusy(true);
    try {
      const result = await request('/api/asset-register/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: save ? 'save' : 'preview', registerId, rows: filled, customColumns: custom, basis, token }) });
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
      transition.start(dialog.current, 'Review assets', () => change('review'));
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
      if (!busy && !transition.pending)
        onClose();
    }} />
    <section ref={dialog} tabIndex={-1} data-dialog-initial-focus className={`${parts.modal} ${parts.entryModal} ${css.dialog} ${importStep ? css.importFrame : ''}`} aria-labelledby="add-asset-choice-title" role="dialog" aria-modal="true">
      {transition.feedback}
      <div className={parts.closeWrap}>
        <ShareModalCloseButton aria-label="Close add asset options" disabled={busy || transition.pending} onClick={onClose} />
      </div>
      <header className={parts.dialogHeader}>
        <h2 ref={heading} tabIndex={-1} id="add-asset-choice-title">{{ choose: 'Add assets', one: 'Add 1 asset', multiple: 'Add multiple assets', file: 'Import assets', map: 'Import assets', edit: 'Add in a sheet', review: 'Review assets' }[stage]}</h2>
        <p>{registerName}</p>
        {!importStep && <div className={parts.partsProgress} aria-hidden="true">
          <span style={{ width: ({ choose: 25, one: 50, multiple: 50, file: 60, map: 65, edit: 80, review: 100 }[stage]) + '%' }} />
        </div>}
      </header>
      <div key={stage} className={cards ? css.choiceScroll : importStep ? css.importScroll : css.sheetBody}>
      <fieldset disabled={busy || transition.pending} data-parts-import={importStep || undefined} className={css.body}>
        {cards && <div className={`${parts.shareChoices} ${parts.entryMethods} ${parts.partsIntent} ${css.pair}`}>
          {cards.map(([next, label, hint, tone, path]) => {
            const content = <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={path} /></svg>
              <span><strong>{label}</strong><small>{hint}</small></span>
            </>;
            if (next === 'valuation') {
              return <Link key={next} className={parts.choiceLink} data-tone={tone} href={valuationHref} onClick={event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                transition.start(event.currentTarget, label, () => router.push(valuationHref));
              }}>{content}</Link>;
            }
            return <button key={next} type="button" data-tone={tone} onClick={event => transition.start(event.currentTarget, label, () => next === 'manual' ? onManual() : change(next))}>{content}</button>;
          })}
        </div>}
        {stage === 'multiple' && <div className={css.example}>
            <button type="button" aria-controls="asset-sheet-example" aria-expanded={example} onClick={() => setExample(!example)}>See an example</button>
          <div id="asset-sheet-example" hidden={!example} className={css.exampleContent}>
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
          </div>
        </div>}
        {stage === 'file' && <SpreadsheetUpload title="Upload your asset list" fileLabel="Upload asset file" busy={busy || transition.pending}
            pasteMode={pasteMode} onModeChange={mode => { setPasteMode(mode); setError(''); }} pasted={pasteText} onPasteChange={setPasteText} onFile={load} />}
        {stage === 'map' && sheet && <section className={uploadStyles.mapping}>
          <div className={uploadStyles.heading}><h3>Match columns</h3><p>Choose which asset field to use for each column.</p></div>
          <div className={uploadStyles.fileSummary}><div><strong>{sheet.name}</strong><span>{sourceRows.length} {sourceRows.length === 1 ? 'row' : 'rows'}</span></div>
            {sheets.length > 1 && <Select label="Worksheet" buttonLabel="Worksheet" className={uploadStyles.worksheet} value={String(sheetIndex)}
              options={sheets.map((s, i) => ({ value: String(i), label: s.name }))} onChange={v => {
                try { selectSheet(sheets, Number(v)); } catch (e) { setError((e as Error).message); }
              }} />}
          </div>
          <label className={uploadStyles.headerChoice}><input type="checkbox" checked={header} onChange={e => {
            try { selectSheet(sheets, sheetIndex, e.target.checked); } catch (err) { setError((err as Error).message); }
          }} /><span>First row contains headings</span></label>
          <div className={uploadStyles.columnList} data-headings-only={headingsOnly || undefined} role="group" aria-label="File columns">
            <div className={`${uploadStyles.columnHead} ${css.mappingHead}`} aria-hidden="true"><span>Your file</span>{!headingsOnly && <span>Sample values</span>}<span>Use as</span></div>
            {mapping.map((v, i) => <div key={i} className={uploadStyles.columnRow} data-skipped={v === 'skip' || undefined}>
              <div className={uploadStyles.columnName}><span className={uploadStyles.letter}>{columnLetter(i)}</span><strong>{header && sheet.rows[0][i] || 'Column ' + columnLetter(i)}</strong></div>
              {!headingsOnly && <div className={uploadStyles.samples}>{sourceRows.slice(0, 2).map((r, n) => <span key={n}>{r[i] || '—'}</span>)}</div>}
              <Select className={uploadStyles.columnSelect} label={'Match column ' + (i + 1)} buttonLabel={'Match column ' + (i + 1)} value={v}
                options={[...mappingChoices, ...importCustom.map(k => ({value:k,label:columnLabel(k)}))].filter(o => !o.value || o.value === 'skip' || o.value === v || !mapping.includes(o.value as Match)).concat({ value: 'new', label: 'Custom field…' })}
                onChange={next => { setMapping(mapping.map((m, j) => j === i ? next as Match : m)); setError(''); }} />
              {v === 'new' && <label className={css.customName}>Field name<input aria-label={`Custom field name for column ${columnLetter(i)}`} maxLength={60} value={names[i] || ''}
                onChange={e => setNames(names.map((name, j) => j === i ? e.target.value : name))} /></label>}
            </div>)}
          </div>
        </section>}
        {stage === 'edit' && <AssetSheetEditor savedColumns={savedColumns} draft={draft} registerId={registerId} register={registerName} validate={validate} page={currentPage} size={size}
          onPage={setPage} onChange={updateDraft} onPaste={paste} canUndo={!!undo} onUndo={() => {
            if (undo) { setDraft(undo); setUndo(null); setError(''); }
          }} />}
        {stage === 'review' && <>
          <div className={uploadStyles.importSummary}>
            <strong>{ready} ready to add</strong><span>{checks.length - ready} skipped</span>
            {metered && <span>{ready} Business credits</span>}{hosting && <small>{hosting}</small>}
          </div>
          <div className={css.reviewTable} role="region" aria-label="Assets to add" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Asset name</th>
                  <th>Serial / VIN</th>
                  <th>Current value</th>
                  {custom.map(k => <th key={k}>{columnLabel(k)}</th>)}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>{filled.slice(currentPage * size, (currentPage + 1) * size).map((r, j) => <tr key={j}>
                <td>{assetTitle(r)}</td>
                <td>{r.serial || '—'}</td>
                <td>{r.value ? 'R ' + r.value + (basis === 'included' ? ' incl. VAT' : ' excl. VAT') : 'Awaiting valuation'}</td>
                {custom.map(k => <td key={k}>{r[k] || '—'}</td>)}
                <td>{checks[currentPage * size + j]?.skip || 'Ready'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
      </fieldset>
      </div>
      {error && <p role="alert" className={parts.error}>{error}</p>}
      {sheetStep ? <footer className={`${parts.entryFooter} ${css.sheetFooter}`}>
        {pages > 1 && <nav className={css.sheetPages} aria-label={stage === 'edit' ? 'Sheet pages' : 'Review pages'}>
          <button type="button" disabled={busy || transition.pending || currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span aria-live="polite" aria-atomic="true">Page {currentPage + 1} of {pages}</span>
          <button type="button" disabled={busy || transition.pending || currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button>
        </nav>}
        <div className={css.sheetActions}>
          {sheetReturnLabel && <button type="button" disabled={busy || transition.pending} onClick={event => transition.start(event.currentTarget, sheetReturnLabel, back)}>{sheetReturnLabel}</button>}
          {stage === 'edit'
            ? <button type="button" className={parts.primary} disabled={busy || transition.pending} onClick={() => void submit()}>{busy ? 'Reviewing assets…' : 'Review assets'}</button>
            : <button type="button" className={parts.primary} disabled={busy || transition.pending || !ready} onClick={() => void submit(true)}>{busy ? 'Adding assets…' : 'Add ' + ready + ' asset' + (ready === 1 ? '' : 's')}</button>}
        </div>
      </footer> : <footer className={parts.entryFooter}>
        <button disabled={busy || transition.pending} onClick={event => transition.start(event.currentTarget, 'Going back…', back)}>Back</button>
        {stage === 'file' && <button type="button" className={css.template} disabled={busy || transition.pending} onClick={() => void template()}>Download Excel template</button>}
        {stage === 'file' && pasteMode && <button className={parts.primary} disabled={busy || transition.pending || !pasteText.trim()} onClick={() => {
          try { selectSheet([{ name: 'Pasted cells', rows: readPartsCsv(pasteText) }], 0); }
          catch (e) { setError((e as Error).message); }
        }}>Check columns</button>}
        {stage === 'map' && <p className={uploadStyles.footerStatus} role="status">{mappingIssue || (headingsOnly ? 'Headings only. Add your first asset in the sheet.' : 'Columns matched')}</p>}
        {stage === 'map' && <button className={parts.primary} disabled={busy || transition.pending || !!mappingIssue} onClick={mapTable}>{headingsOnly ? 'Start blank sheet' : 'Edit sheet'}</button>}
      </footer>}
    </section>
  </div>;
}
