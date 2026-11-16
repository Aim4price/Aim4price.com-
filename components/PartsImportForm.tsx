"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  type PartDetailField,
  guessPartColumns,
  readPartsCsv,
  partsTableCsv,
  type PartColumns,
} from "../lib/parts-network-csv";
import { readPartsExcel } from "../lib/parts-network-excel";
import {
  PART_LABELS,
  PART_FIELDS,
  EDITOR_COLUMNS,
  pastePartsCells,
  partCellErrors,
  EXAMPLE_PARTS,
} from "../lib/parts-editor";
import { AddPartField, PartDetailInputs, PartInput } from "./PartsDetailFields";
import VatPriceInput from "./VatPriceInput";
import PartsChoice from "./PartsChoice";
import ModalSelect from "./AssetModalSelect";
import importStyles from "./PartsImportForm.module.css";
import PartsSheetTools, { type SheetTool } from "./PartsSheetTools";
import priceStyles from "./asset-register/AssetDisposal.module.css";
import styles from "../app/dealer/parts/parts.module.css";
type Details = {
  businessName: string;
  town: string;
  phone: string;
  email: string;
  vatIncluded: boolean;
};
type Preview = {
  revision: number;
  summary: { added: number; updated: number; removed: number; total: number };
};
export default function PartsImportForm({
  initialFields = [],
  listName,
  initialDetails,
  editSnapshot,
  onBack,
  request,
  onComplete,
  onBusyChange,
  onStageChange,
}: {
  onStageChange?: (stage: string) => void;
  initialFields?: PartDetailField[];
  listName?: string;
  initialDetails: Details;
  editSnapshot?: {rows: string[][]; revision: number};
  onBack: () => void;
  request: (body: Record<string, unknown>) => Promise<any>;
  onComplete: (addAnother?: boolean) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [source, setSource] = useState<"manual" | "sheet" | "file" | null>(
    editSnapshot ? "sheet" : null,
  );
  const [hiddenInputs,setHiddenInputs]=useState<number[]>([]);
  const [hiddenDetails,setHiddenDetails]=useState<string[]>([]);
  const [priceIncluded,setPriceIncluded]=useState(initialDetails.vatIncluded);
  const [extraFields,setExtraFields] = useState<PartDetailField[]>(initialFields);
  const [importedDetailIds,setImportedDetailIds] = useState<string[]>([]);
  const labels = [...PART_LABELS,...extraFields.map(f=>f.label)];
  const emptyRow = () => Array(5 + extraFields.length).fill("") as string[];
  function addField(field:PartDetailField) {if(extraFields.some(f=>f.id===field.id)){setHiddenDetails(hiddenDetails.filter(id=>id!==field.id));return;}setUndo({rows,fields:extraFields,hidden:hiddenColumns});revealColumn.current = true;setExtraFields([...extraFields,field]);setRows(rows.map(r=>[...r,""]));setPreview(null);}
  const [details, setDetails] = useState(initialDetails);
  const [fileName, setFileName] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedTable, setPastedTable] = useState("");
  const [raw, setRaw] = useState<string[][]>([]);
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>(
    [],
  );
  const [sheetIndex, setSheetIndex] = useState(0);
  const [hasHeader, setHasHeader] = useState(true);
  const [columns, setColumns] = useState<PartColumns>(EDITOR_COLUMNS);
  const [rows, setRows] = useState<string[][]>(() => editSnapshot?.rows.length ? editSnapshot.rows : [emptyRow()]);
  const [stage, setStage] = useState<
    "choose" | "example" | "file" | "mapping" | "entry" | "settings" | "review"
  >(editSnapshot ? "entry" : "choose");
  useEffect(() => { onStageChange?.(stage); }, [stage, onStageChange]);
  const exampleHeading = useRef<HTMLHeadingElement>(null);
  const exampleButton = useRef<HTMLButtonElement>(null);
  const returningFromExample = useRef(false);
  useLayoutEffect(() => {
    if (stage === "example") exampleHeading.current?.focus();
    if (stage === "choose" && returningFromExample.current) {
      returningFromExample.current = false;
      exampleButton.current?.focus();
    }
  }, [stage]);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState("");
  const [tool, setTool] = useState<SheetTool | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<number[]>([]);
  const addRowFocus = useRef<number | null>(null);
  const [page, setPage] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const horizontalRef = useRef<HTMLDivElement>(null);
  const revealColumn = useRef(false);
  const horizontalPosition = useRef(0);
  const [horizontalSize, setHorizontalSize] = useState({width: 0, content: 0});
  function panSheet(left: number) {
    horizontalPosition.current = left;
    sheetRef.current?.querySelectorAll("tr").forEach(row => {
      if (Math.abs(row.scrollLeft - left) > 1) row.scrollLeft = left;
    });
    if (horizontalRef.current && Math.abs(horizontalRef.current.scrollLeft - left) > 1) horizontalRef.current.scrollLeft = left;
  }
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const measure = () => {
      const header = sheet.querySelector("thead tr");
      if (!header) return;
      setHorizontalSize({width: header.clientWidth, content: header.scrollWidth});
      const left = revealColumn.current ? header.scrollWidth - header.clientWidth : Math.min(horizontalPosition.current, header.scrollWidth - header.clientWidth);
      revealColumn.current = false;
      panSheet(left);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [stage, source, extraFields, hiddenColumns, rows.length, page]);
  useLayoutEffect(() => {
    if (horizontalRef.current) horizontalRef.current.scrollLeft = horizontalPosition.current;
  }, [horizontalSize]);
  useLayoutEffect(() => {
    if (addRowFocus.current === null) return;
    const input = sheetRef.current?.querySelector<HTMLInputElement>(`[aria-label="Part number ${addRowFocus.current + 1}"]`);
    if (input) { input.focus(); input.scrollIntoView({block: "nearest"}); addRowFocus.current = null; }
  });
  const sheetEntry = stage === "entry" && source !== "manual";
  const [undo, setUndo] = useState<{rows:string[][];fields:PartDetailField[];hidden:number[]} | null>(null);
  const [selected, setSelected] = useState<number[]>([]);

  const mode = editSnapshot ? "replace" : "add";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cellErrors = useMemo(() => partCellErrors(rows), [rows]);
  const errors = Object.fromEntries(
    Object.entries(cellErrors).map(([i, cells]) => [
      i,
      Object.values(cells)[0],
    ]),
  );
  const invalid = Object.keys(errors).length;
  const populated = rows.filter((r) => r.some((v) => v.trim()));
  const showError = (i: number, j: number) =>
    attempted || touched[`${i}:${j}`] ? cellErrors[i]?.[j] : undefined;
  function choose(next: "manual" | "sheet" | "file") {
    if (source !== next) {
      setRows(
        next === "sheet" ? Array.from({ length: 8 }, emptyRow) : [emptyRow()],
      );
      setRaw([]);
      setSheets([]);
      setSelected([]);
      setUndo(null);
      setPage(0);
    }
    setSource(next);
    setStage(next === "file" ? "file" : "entry");
    setError("");
    setSaved("");
    setAttempted(false);
    setTouched({});
  }
  function continueEntry() {
    setAttempted(true);
    if (!populated.length && !editSnapshot) {
      setError("Add at least one part to continue.");
      return;
    }
    if (invalid) {
      setHiddenColumns([]);
      setError("Check the highlighted cells.");
      setPage(Math.floor(Number(Object.keys(errors)[0]) / 50));
      return;
    }
    setError("");
    if (editSnapshot) void review();
    else setStage("settings");
  }
  async function review() {
    await run(async () => {
      setPreview(await request({action: "preview", ...payload()}));
      setStage("review");
    });
  }
  async function save(addAnother = false) {
    if (!preview) return;
    await request({
      action: "import",
      ...payload(),
      revision: preview.revision,
    });
    await onComplete(addAnother);
    if (addAnother) {
      setRows([emptyRow()]);
      setPreview(null);
      setStage("entry");
      setAttempted(false);
      setTouched({});
      setSaved("Part saved. Add the next one.");
    }
  }
  async function run(work: () => Promise<void>) {
    setError("");
    setBusy(true);
    onBusyChange(true);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read these parts.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  function change(next: string[][], removing = false) {
    if (editSnapshot && !removing && rows.some((row, i) => row.some(v => v.trim()) && !next[i]?.some(v => v.trim()))) {
      setError("Use the row actions to delete parts. Clearing cells does not remove a saved part.");
      return;
    }
    setUndo({rows,fields:extraFields,hidden:hiddenColumns});
    setRows(next);
    setPreview(null);

  }
  function loadTable(table: string[][]) {
    if (!table.length) throw new Error("The table is empty.");
    setRaw(table);
    setStage("mapping");
    const guessed = guessPartColumns(table[0]);
    const header = guessed.partNumber >= 0 && guessed.quantity >= 0;
    setHasHeader(header);
    setColumns(
      header
        ? guessed
        : {
            partNumber: 0,
            quantity: -1,
            price: -1,
            brand: -1,
            description: -1,
          },
    );
  }
  function mapTable() {
    const indexes = [...PART_FIELDS.map((k) => columns[k] ?? -1), ...extraFields.map(f=>columns.details?.[f.id] ?? (hasHeader ? raw[0].findIndex(h=>h.replace(/ \(private\)$/i, "").trim().toLowerCase()===f.label.toLowerCase()) : -1))].filter(
      (i) => i >= 0,
    );
    if (
      columns.partNumber < 0 ||
      columns.quantity < 0 ||
      new Set(indexes).size !== indexes.length
    )
      throw new Error(
        "Choose different columns. Part number and quantity are required.",
      );
    const data = raw.slice(hasHeader ? 1 : 0);
    if (!data.length || data.length > 20000)
      throw new Error("Include between 1 and 20,000 parts.");
    setAttempted(false);
    setTouched({});
    setImportedDetailIds(extraFields.filter(f=>(columns.details?.[f.id] ?? (hasHeader ? raw[0].findIndex(h=>h.replace(/ \(private\)$/i, "").trim().toLowerCase()===f.label.toLowerCase()) : -1)) >= 0).map(f=>f.id));
    setRows(data.map((r) => [...PART_FIELDS.map((k) => r[columns[k] ?? -1] ?? ""), ...extraFields.map(f=>r[columns.details?.[f.id] ?? (hasHeader ? raw[0].findIndex(h=>h.replace(/ \(private\)$/i, "").trim().toLowerCase() === f.label.toLowerCase()) : -1)] ?? "")]));
    setStage("entry");
    setPage(0);
    setSelected([]);
    setUndo(null);
  }
  const columnCount = Math.max(0,...raw.slice(0,100).map(row=>row.length));
  const sampleFor = (index:number) => index<0 ? 'Not included in this import' : `Sample: ${raw.slice(hasHeader?1:0,(hasHeader?1:0)+3).map(row=>row[index]||'—').join(' · ')}`;
  const columnOptions = Array.from({length:columnCount},(_,i)=>({value:String(i),label:`Column ${i+1}${hasHeader&&raw[0]?.[i]?` · ${raw[0][i]}`:''}`,description:sampleFor(i)}));
  const detailColumn = (id:string,label:string) => columns.details?.[id] ?? (hasHeader ? raw[0]?.findIndex(h=>h.replace(/ \(private\)$/i,'').trim().toLowerCase()===label.toLowerCase()) ?? -1 : -1);
  const mappedIndexes = [...PART_FIELDS.map(key=>columns[key]??-1),...extraFields.map(f=>detailColumn(f.id,f.label))].filter(i=>i>=0);
  const mappingIssue = columns.partNumber<0||columns.quantity<0 ? 'Choose a column for part number and quantity to continue.' : new Set(mappedIndexes).size!==mappedIndexes.length ? 'Each file column can only be used once. Check the repeated selections.' : '';
  const payload = () => ({
    csv: partsTableCsv(populated),
    columns: {...EDITOR_COLUMNS, details:Object.fromEntries(extraFields.flatMap((f,i)=>(source !== "manual" || !hiddenDetails.includes(f.id)) && (source !== "file" || importedDetailIds.includes(f.id) || populated.some(r=>r[5+i]?.trim())) ? [[f.id,5+i]] : []))},
    extraFields:source==="manual" ? extraFields.filter(f=>!hiddenDetails.includes(f.id) || initialFields.some(old=>old.id===f.id)) : extraFields,
    removedFieldIds: initialFields.filter(f=>!extraFields.some(next=>next.id===f.id)).map(f=>f.id),
    options: { hasHeader: false },
    mode,
    ...(editSnapshot ? {baseRevision: editSnapshot.revision} : {}),
    ...details,
  });
  const visible = rows.slice(page * 50, page * 50 + 50);
  return (
    <div className={`${styles.importForm} ${sheetEntry ? styles.stockSheet : ""}`}>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className={styles.notice}>
          {saved}
        </p>
      )}
      {tool && <PartsSheetTools removableFieldIds={extraFields.filter(f=>editSnapshot || !initialFields.some(old=>old.id===f.id)).map(f=>f.id)} listName={listName} extraFields={extraFields} tool={tool} vatIncluded={details.vatIncluded} rows={rows} selected={selected} hidden={hiddenColumns} onHidden={setHiddenColumns} labels={labels} onClose={() => setTool(null)} onApply={(next, removing, fields) => {change(next, removing);if(fields) {setExtraFields(fields);setHiddenColumns(hiddenColumns.flatMap(i=>i<5 ? [i] : fields.some(f=>f.id===extraFields[i-5]?.id) ? [5+fields.findIndex(f=>f.id===extraFields[i-5]?.id)] : []));}setError("");if (removing) {setSelected([]);setPage(Math.min(page, Math.max(0, Math.ceil(next.length / 50) - 1)));}}} />}
      {sheetEntry && <div className={styles.sheetToolbar} role="group" aria-label="Sheet tools">
        <span>{selected.length ? `${selected.length} selected` : `${rows.length} ${rows.length === 1 ? "part" : "parts"}`}</span>
        <AddPartField column fields={extraFields} onAdd={addField}/>
        <button disabled={busy} onClick={() => setTool({kind: "columns"})}>Manage columns</button>
        <button disabled={busy || !rows.length} onClick={() => setTool({kind: "bulk"})}>Bulk edit</button>
        <button disabled={busy || !undo} onClick={() => {if (undo) {setRows(undo.rows);setExtraFields(undo.fields);setHiddenColumns(undo.hidden);setUndo(null);setSelected([]);setPage(0);setError("");setPreview(null);}}}>Undo</button>
      </div>}
      <fieldset disabled={busy} className={styles.importFields}>
        <div key={stage} className={styles.stageBody}>
          {stage === "choose" && (
            <>
              <div className={`${styles.shareChoices} ${styles.entryMethods}`}>
                {(
                  [
                    ["manual", "Add one part", "A simple form for one part"],
                    ["sheet", "Add in a sheet", "Type or paste multiple rows"],
                    ["file", "Import file", "Upload CSV or Excel"],
                  ] as const
                ).map(([value, title, hint]) => (
                  <button
                    key={value}
                    data-tone={value === "manual" ? "blue" : value === "file" ? "amber" : "green"}
                    type="button"
                    onClick={() => choose(value)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      aria-hidden="true"
                    >
                      {value === "manual" ? (
                        <path d="M12 5v14M5 12h14" />
                      ) : value === "sheet" ? (
                        <>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18M3 15h18M9 3v18" />
                        </>
                      ) : (
                        <path d="M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7" />
                      )}
                    </svg>
                    <span><strong>{title}</strong><small>{hint}</small></span>
                  </button>
                ))}
              </div>
              <div className={styles.entryExample}>
                <button ref={exampleButton} type="button" onClick={() => {setError(""); setStage("example");}}>See an example</button>
              </div>
            </>
          )}
          {stage === "example" && (
              <section className={styles.entryExampleView} aria-labelledby="parts-example-heading">
                <h3 id="parts-example-heading" ref={exampleHeading} tabIndex={-1}>Example parts list</h3>
                <p>
                  Part number and quantity are required. Price, brand and
                  description are optional. Keep part numbers as text in your
                  spreadsheet to preserve leading zeros.
                </p>
                <div className={styles.tableWrap} role="region" aria-label="Example parts table" tabIndex={0}>
                  <table>
                    <thead>
                      <tr>
                        {PART_LABELS.map((l) => (
                          <th key={l}>{l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {EXAMPLE_PARTS.map((r) => (
                        <tr key={r[0]}>
                          {r.map((c, i) => (
                            <td key={i}>{c || "Price on request"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </section>
          )}
          {stage === "file" && <section className={importStyles.upload}>
            <div className={importStyles.heading}><span className={importStyles.eyebrow}>STEP 1 · IMPORT</span><h3>Bring in your parts</h3><p>Upload a stocklist or paste cells. You’ll match the columns and check every part before saving.</p></div>
            <div className={importStyles.tabs} role="group" aria-label="Import source">
              <button type="button" aria-pressed={!pasteMode} onClick={()=>setPasteMode(false)}>Upload a file</button>
              <button type="button" aria-pressed={pasteMode} onClick={()=>setPasteMode(true)}>Paste from a spreadsheet</button>
            </div>
            {!pasteMode ? <label className={importStyles.drop}>
              <span className={importStyles.uploadIcon} aria-hidden="true">↑</span><strong>Choose your stocklist</strong><span>CSV or Excel (.xlsx)</span><small>CSV up to 2 MB · Excel up to 5 MB</small>
              <input aria-label="Upload parts file" type="file" accept=".csv,.xlsx" onChange={e=>{
                const file=e.target.files?.[0]; if(!file)return;
                setRaw([]);setSheets([]);setFileName(file.name);
                void run(async()=>{
                  if(file.name.toLowerCase().endsWith('.xlsx')){
                    if(file.size>5000000)throw new Error('Use an Excel file smaller than 5 MB.');
                    const result=await readPartsExcel(await file.arrayBuffer());
                    if(!result.length)throw new Error('No populated worksheets found.');
                    setSheets(result);setSheetIndex(0);loadTable(result[0].rows);
                  }else{
                    if(!file.name.toLowerCase().endsWith('.csv'))throw new Error('Choose CSV or .xlsx.');
                    if(file.size>2000000)throw new Error('Use a CSV file smaller than 2 MB.');
                    loadTable(readPartsCsv(await file.text()));
                  }
                });
              }}/>
            </label> : <div className={importStyles.paste}>
              <label>Cells from Excel / Sheets<textarea aria-label="Paste spreadsheet cells" value={pastedTable} onChange={e=>setPastedTable(e.target.value)} placeholder="Paste your cells here, with or without column headings."/></label>
              <p>Keep the original column order. You can match each column in the next step.</p>
              <button disabled={!pastedTable.trim()} onClick={()=>void run(async()=>{setSheets([]);setFileName('Pasted spreadsheet');loadTable(readPartsCsv(pastedTable,{delimiter:'\t',preserveEmptyRows:true}));})}>Match pasted columns</button>
            </div>}
          </section>}
          {stage === "mapping" && <section className={importStyles.mapping}>
            <div className={importStyles.heading}><span className={importStyles.eyebrow}>STEP 2 · MATCH COLUMNS</span><h3>Match your file to the parts list</h3><p>Choose where each detail comes from. Sample values help you pick the right column.</p></div>
            <div className={importStyles.fileSummary}><div><strong>{fileName}</strong><small>{Math.max(0,raw.length-(hasHeader?1:0)).toLocaleString()} rows · {columnOptions.length} columns</small></div><button onClick={()=>setStage('file')}>Change source</button></div>
            <div className={importStyles.mappingControls}>
              {sheets.length>1&&<ModalSelect label="Worksheet" buttonLabel="Worksheet" value={String(sheetIndex)} options={sheets.map((sheet,i)=>({value:String(i),label:sheet.name,description:`${sheet.rows.length} rows`}))} onChange={value=>{const i=Number(value);setSheetIndex(i);loadTable(sheets[i].rows);}}/>}
              <label className={styles.importCheck}><input type="checkbox" checked={hasHeader} onChange={e=>setHasHeader(e.target.checked)}/>First row contains column headings</label>
            </div>
            {[true,false].map(required=><section key={String(required)} className={importStyles.group} data-optional={!required||undefined}>
              <div className={importStyles.groupHeading}><h4>{required?'Required details':'Optional details'}</h4><span>{required?'Match both to continue':'Leave out anything your file doesn’t include'}</span></div>
              <div className={importStyles.fields}>{PART_FIELDS.map((key,i)=>{if((i===0||i===2)!==required)return null;return <div key={key} className={importStyles.field}>
                <ModalSelect label={PART_LABELS[i]} buttonLabel={`${PART_LABELS[i]} column`} value={String(columns[key]??-1)} options={[{value:'-1',label:required?'Choose column':'Not supplied',description:required?'Select the matching column from your file':'Leave this detail blank'},...columnOptions]} onChange={value=>setColumns({...columns,[key]:Number(value)})}/>
                <small>{sampleFor(columns[key]??-1)}</small>
              </div>;})}</div>
            </section>)}
            <div className={importStyles.extraFields}><AddPartField column fields={extraFields} onAdd={addField}/>{extraFields.map(f=><ModalSelect key={f.id} label={`${f.label}${f.private?' (private)':''}`} buttonLabel={`${f.label} column`} value={String(detailColumn(f.id,f.label))} options={[{value:'-1',label:'Not in this file'},...columnOptions]} onChange={value=>setColumns({...columns,details:{...columns.details,[f.id]:Number(value)}})}/>)}</div>
            {mappingIssue&&<p className={importStyles.mappingHint} role="status">{mappingIssue}</p>}
          </section>}
          {stage === "entry" && source === "manual" && (
            <div className={`${styles.partEditFields} ${styles.singlePartForm}`}>
              {[0, 4, 1, 2, 3].filter(j=>!hiddenInputs.includes(j)).map(j => {
                const label = PART_LABELS[j];
                const required = j === 0 || j === 2;
                const error = showError(0, j);
                const hint = j === 3 ? "Leave blank for price on request." : undefined;
                const input = <input
                  id={`add-part-field-${j}`}
                  aria-label={`${label} 1`}
                  required={required}
                  placeholder={required ? undefined : "Optional"}
                  value={rows[0]?.[j] || ""}
                  inputMode={j === 2 ? "numeric" : j === 3 ? "decimal" : undefined}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `single-error-${j}` : hint ? "add-part-price-hint" : undefined}
                  onBlur={() => setTouched(t => ({...t, [`0:${j}`]: true}))}
                  onChange={e => change([(rows[0] || emptyRow()).map((v, k) => k === j ? e.target.value : v)])}
                />;
                return <div key={label} className={`${styles.partEditPrice} ${j === 1 ? styles.partEditDescription : ""}`}>
                  <label htmlFor={`add-part-field-${j}`}>
                    {label}{j === 3 && <small>{priceIncluded ? "Incl." : "Excl."} VAT</small>}
                  </label>
                  <PartInput label={label} required={required} onRemove={()=>{setHiddenInputs([...hiddenInputs,j]);change([(rows[0] || emptyRow()).map((v,k)=>k===j ? "" : v)]);}}>{j === 3 ? <div className={`${priceStyles.amountControl} ${styles.partEditPriceControl}`}>
                    <VatPriceInput id={`add-part-field-${j}`} aria-label={`${label} 1`} placeholder="Optional" aria-invalid={Boolean(error)} aria-describedby={error ? `single-error-${j}` : "add-part-price-hint"} onBlur={() => setTouched(t => ({...t, [`0:${j}`]: true}))} included={priceIncluded} vatRate={.15} valueExVat={rows[0]?.[3]?.trim() ? String(Number(rows[0][3])/(details.vatIncluded ? 1.15 : 1)) : ""} onValueChange={price=>change([(rows[0] || emptyRow()).map((v,k)=>k===3 ? (price.trim() && Number.isFinite(Number(price)) ? String(Number(price)*(details.vatIncluded ? 1.15 : 1)) : price) : v)])}/>
                    <div className={priceStyles.amountVatToggle} role="group" aria-label="Unit price VAT basis"><button type="button" aria-label="Including VAT" aria-pressed={priceIncluded} onClick={()=>setPriceIncluded(true)}>Incl</button><button type="button" aria-label="Excluding VAT" aria-pressed={!priceIncluded} onClick={()=>setPriceIncluded(false)}>Excl</button></div>
                  </div> : input}</PartInput>
                  {hint && <small id="add-part-price-hint">{hint}</small>}
                  {error && <small className={styles.cellError} id={`single-error-${j}`}>{error}</small>}
                </div>;
              })}
              <PartDetailInputs fields={extraFields.filter(f=>!hiddenDetails.includes(f.id))} onRemove={id=>{setHiddenDetails([...hiddenDetails,id]);change([[...rows[0].slice(0,5),...extraFields.map((f,i)=>f.id===id ? "" : rows[0]?.[5+i] || "")]]);}} values={Object.fromEntries(extraFields.map((f,i)=>[f.id,rows[0]?.[5+i] || ""]))} onChange={values=>change([[...rows[0].slice(0,5),...extraFields.map(f=>values[f.id] || "")]])}/>

            </div>
          )}
          {stage === "entry" && source !== "manual" && (
            <>
              <div ref={sheetRef} className={styles.editorWrap} role="region" aria-label="Parts spreadsheet" tabIndex={0}>
                <table className={`${styles.editorTable} ${styles.independentRows}`}>
                  <thead>
                    <tr>
                      <th scope="col">
                        {<input
                          type="checkbox"
                          aria-label="Select all rows"
                          checked={
                            rows.length > 0 && selected.length === rows.length
                          }
                          onChange={(e) =>
                            setSelected(
                              e.target.checked ? rows.map((_, i) => i) : [],
                            )
                          }
                        />}
                      </th>
                      {labels.map((label, i) => (
                        <th key={label} data-column={i} hidden={hiddenColumns.includes(i)}>
                          {label}
                          {i !== 0 && i !== 2 && <small>Optional</small>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row, offset) => {
                      const i = page * 50 + offset;
                      return (
                        <tr key={i} tabIndex={0} aria-label={`Part row ${i + 1}`} data-extra-details={row.some((v,j)=>j>=5 && !hiddenColumns.includes(j) && v.trim()) || undefined} data-selected={selected.includes(i) || undefined} onScroll={e=>panSheet(e.currentTarget.scrollLeft)}>
                          <td>
                            <div className={styles.sheetRowControls}>
                            {<input
                              type="checkbox"
                              aria-label={`Select row ${i + 1}`}
                              checked={selected.includes(i)}
                              onChange={(e) =>
                                setSelected(
                                  e.target.checked
                                    ? [...selected, i]
                                    : selected.filter((n) => n !== i),
                                )
                              }
                            />}
                            <span className={styles.sheetRowNumber}>{i + 1}</span>
                            {<button type="button" className={styles.sheetRowAction} title={`Row ${i + 1} options`} aria-haspopup="dialog" aria-label={`Actions for row ${i + 1}`} onClick={() => setTool({kind: "row", index: i})}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3h6l.5 3 2 1.2 2.8-1 3 5.2-2.3 2v2.3l2.3 2-3 5.2-2.8-1-2 1.2L15 26H9l-.5-3-2-1.2-2.8 1-3-5.2 2.3-2v-2.3l-2.3-2 3-5.2 2.8 1 2-1.2Z" transform="translate(2 0) scale(.8)"/><circle cx="11.6" cy="11.6" r="3.2"/></svg></button>}
                            </div>
                          </td>
                          {row.map((cell, j) => (
                            <td key={j} data-column={j} hidden={hiddenColumns.includes(j)}>
                              <input
                                aria-label={`${labels[j]} ${i + 1}`}
                                aria-invalid={Boolean(showError(i, j))}
                                aria-describedby={
                                  showError(i, j)
                                    ? `part-error-${i}-${j}`
                                    : undefined
                                }
                                value={cell}
                                inputMode={
                                  j === 2
                                    ? "numeric"
                                    : j === 3
                                      ? "decimal"
                                      : undefined
                                }
                                onBlur={() =>
                                  setTouched((t) => ({
                                    ...t,
                                    [`${i}:${j}`]: true,
                                  }))
                                }
                                onChange={(e) =>
                                  change(
                                    rows.map((r, n) =>
                                      n === i
                                        ? r.map((v, k) =>
                                            k === j ? e.target.value : v,
                                          )
                                        : r,
                                    ),
                                  )
                                }
                                onPaste={(e) => {
                                  e.preventDefault();
                                  try {
                                    setError("");
                                    if (hiddenColumns.length && e.clipboardData.getData("text/plain").includes("\t")) throw new Error("Show all columns before pasting multiple columns so values stay aligned.");
                                    change(
                                      pastePartsCells(
                                        rows,
                                        e.clipboardData.getData("text/plain"),
                                        i,
                                        j, labels.length,
                                      ),
                                    );
                                  } catch (err) {
                                    setError((err as Error).message);
                                  }
                                }}
                              />
                              {showError(i, j) && (
                                <small
                                  id={`part-error-${i}-${j}`}
                                  className={styles.cellError}
                                >
                                  {showError(i, j)}
                                </small>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={styles.actions}>
                {<button disabled={rows.length >= 20000} onClick={() => {addRowFocus.current = rows.length;change([...rows, emptyRow()]);setPage(Math.floor(rows.length / 50));}}>+ Add row</button>}
                <span>
                  {rows.length.toLocaleString()} {rows.length === 1 ? "row" : "rows"}
                  {attempted && invalid ? ` · ${invalid} need attention` : ""}
                </span>
                {attempted && invalid > 0 && (
                  <button
                    onClick={() =>
                      setPage(Math.floor(Number(Object.keys(errors)[0]) / 50))
                    }
                  >
                    Show first issue
                  </button>
                )}
                {rows.length > 50 && (
                  <>
                    <button disabled={!page} onClick={() => setPage(page - 1)}>
                      Previous
                    </button>
                    <span>
                      Page {page + 1} of {Math.ceil(rows.length / 50)}
                    </span>
                    <button
                      disabled={(page + 1) * 50 >= rows.length}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          {stage === "settings" && (
            <>
              <section className={styles.partContactStep} aria-label="Contact details">
                <h3>Contact details</h3>
                <div className={styles.grid}>
                  {(["businessName", "town", "phone", "email"] as const).map(
                    (key, i) => (
                      <label key={key}>
                        {
                          [
                            "Dealership",
                            "Town",
                            "Contact phone",
                            "Contact email",
                          ][i]
                        }
                        <input
                          value={details[key]}
                          onChange={(e) =>
                            setDetails({ ...details, [key]: e.target.value })
                          }
                        />
                      </label>
                    ),
                  )}
                  {source!=="manual" && <PartsChoice label="Price VAT basis" value={String(details.vatIncluded)} onChange={value=>setDetails({...details,vatIncluded:value === "true"})} options={[{value:"false",label:"Exclude VAT",hint:"Prices before VAT"},{value:"true",label:"Include VAT",hint:"Prices already include VAT"}]} />}
                </div>
              </section>
            </>
          )}
          {stage === "review" && preview && (
            <>
              {initialFields.some(f=>!extraFields.some(next=>next.id===f.id)) && <p className={styles.error}>Columns to delete: {initialFields.filter(f=>!extraFields.some(next=>next.id===f.id)).map(f=>f.label).join(", ")}. Their values will be removed from every part.</p>}
              <div className={styles.summary}>
                {Object.entries(preview.summary).map(([k, v]) => (
                  <div key={k}>
                    <strong>{v.toLocaleString()}</strong>
                    <span>{k}</span>
                  </div>
                ))}
              </div>
              <p>
                {mode === "add"
                  ? "Unlisted parts stay unchanged."
                  : "Removed rows will leave the shared list. A changed part number is counted as one removal and one addition."}{" "}
                Your master stock records and cost ledger are unaffected.
              </p>
              <p>
                {populated.length.toLocaleString()} reviewed rows.{" "}
                {preview.summary.removed > 0
                  ? `${preview.summary.removed} existing parts will be removed.`
                  : "No existing parts will be removed."}
              </p>
            </>
          )}
        </div>
        {sheetEntry && horizontalSize.content > horizontalSize.width + 1 && <div ref={horizontalRef} className={styles.sheetHorizontalScroll} style={{width: horizontalSize.width}} role="region" aria-label="Scroll sheet columns" tabIndex={0} onScroll={e=>panSheet(e.currentTarget.scrollLeft)}><div style={{width: horizontalSize.content, height: 1}} /></div>}
        {stage === "choose" && <div className={styles.entryFooter}><button onClick={onBack}>Back</button></div>}
        {stage !== "choose" && (
          <div className={`${styles.entryFooter} ${stage === "entry" && source === "manual" ? styles.partEditFooter : ""}`}>
            {stage === "entry" && source === "manual" && <div className={styles.detailFooterAction}><AddPartField restoreInputs={hiddenInputs.map(i=>({id:String(i),label:PART_LABELS[i]}))} onRestoreInput={id=>setHiddenInputs(hiddenInputs.filter(i=>i!==Number(id)))} restorableFields={extraFields.filter(f=>hiddenDetails.includes(f.id))} fields={extraFields.filter(f=>!hiddenDetails.includes(f.id))} onAdd={addField}/></div>}
            <button
              onClick={() => {
                setError("");
                if (stage === "example") {
                  returningFromExample.current = true;
                  setStage("choose");
                } else if (stage === "review") {
                  setPreview(null);
                  setStage(editSnapshot ? "entry" : "settings");
                } else if (stage === "settings") setStage("entry");
                else if (stage === "mapping") setStage("file");
                else if (stage === "entry" && source === "file") setStage("mapping");
                else if (editSnapshot) onBack();
                else setStage("choose");
              }}
            >
              Back
            </button>
            <div className={styles.actions}>
              {stage === "entry" && (
                <button className={styles.primary} onClick={continueEntry}>
                  {editSnapshot ? "Review changes" : "Continue"}
                </button>
              )}
              {stage === "mapping" && raw.length > 0 && (
                <button
                  className={styles.primary}
                  disabled={!!mappingIssue}
                  onClick={() => void run(async () => mapTable())}
                >
                  Continue to editable table
                </button>
              )}
              {stage === "settings" && (
                <button
                  className={styles.primary}
                  onClick={() => void review()}
                >
                  Review parts
                </button>
              )}
              {stage === "review" && preview && (
                <>
                  {source === "manual" && (
                    <button onClick={() => void run(() => save(true))}>
                      Save &amp; add another
                    </button>
                  )}
                  <button
                    className={styles.primary}
                    onClick={() => void run(() => save())}
                  >
                    {mode === "add"
                      ? "Save parts"
                      : `Save changes${preview.summary.removed ? ` (${preview.summary.removed} removed)` : ""}`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
