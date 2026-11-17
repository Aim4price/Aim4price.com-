"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  type PartDetailField,
  PART_DETAIL_PRESETS,
  readPartsCsv,
  partsTableCsv,
} from "../lib/parts-network-csv";
import { columnLetter, inspectPartsTable, mappedPartColumns } from "../lib/parts-import-mapping";
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
  const [mapping, setMapping] = useState<string[]>([]);
  const columns = useMemo(() => mappedPartColumns(mapping), [mapping]);
  const mappedSignature = useRef("");
  const [dragging, setDragging] = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const importHeading = useRef<HTMLHeadingElement>(null);
  const [rows, setRows] = useState<string[][]>(() => editSnapshot?.rows.length ? editSnapshot.rows : [emptyRow()]);
  const [stage, setStage] = useState<
    "choose" | "example" | "file" | "mapping" | "entry" | "settings" | "review"
  >(editSnapshot ? "entry" : "choose");
  useLayoutEffect(() => { importHeading.current?.focus(); }, [stage]);
  useEffect(() => { onStageChange?.(source === "file" && stage !== "choose" ? `import-${stage}` : stage); }, [stage, source, onStageChange]);
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
    setHiddenColumns([]);
    setIssuesOnly(false);
    setPreview(null);
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
      setHiddenColumns(current => source === "file" ? current.filter(j => !Object.values(cellErrors).some(cells => cells[j])) : []);
      setError("Check the highlighted cells.");
      setPage(issuesOnly ? 0 : Math.floor(Number(Object.keys(errors)[0]) / 50));
      return;
    }
    setError("");
    if (editSnapshot || source === "file") void review();
    else setStage("settings");
  }
  async function review() {
    await run(async () => {
      setPreview(await request({action: "preview", ...payload()}));
      if (source !== "file") setStage("review");
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
    table = table.filter(row => row.some(cell => cell.trim()));
    const result = inspectPartsTable(table, extraFields);
    setRaw(table);
    setHasHeader(result.hasHeader);
    setMapping(result.mapping);
    setExtraFields([...extraFields, ...result.addedFields]);
    mappedSignature.current = "";
    setStage("mapping");
    setPreview(null);
  }
  function changeHeader(checked: boolean) {
    setHasHeader(checked);
    // Re-detect headings only when requested; existing manual choices stay in place.
    if (checked) {
      const result = inspectPartsTable(raw, extraFields, true);
      const next = [...mapping];
      result.mapping.forEach((key, i) => { if (!next[i] && key && !next.includes(key)) next[i] = key; });
      setMapping(next);
      setExtraFields([...extraFields, ...result.addedFields]);
    }
  }
  async function loadFile(file: File) {
    await run(async () => {
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        if (file.size > 5000000) throw new Error("Use an Excel file smaller than 5 MB.");
        const result = await readPartsExcel(await file.arrayBuffer());
        if (!result.length) throw new Error("No populated worksheets found.");
        loadTable(result[0].rows);
        setSheets(result);
        setSheetIndex(0);
      } else {
        if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a CSV or .xlsx file.");
        if (file.size > 2000000) throw new Error("Use a CSV file smaller than 2 MB.");
        loadTable(readPartsCsv(await file.text()));
        setSheets([]);
      }
      setFileName(file.name);
    });
  }
  function mapTable() {
    if (mappingIssue) throw new Error(mappingIssue);
    const data = raw.slice(hasHeader ? 1 : 0).filter(row => row.some(cell => cell.trim()));
    if (!data.length || data.length > 20000) throw new Error("Include between 1 and 20,000 parts.");
    const signature = JSON.stringify([hasHeader, mapping]);
    // Going back to check the mapping must not erase edits in an unchanged preview.
    if (signature !== mappedSignature.current) {
      setRows(data.map(r => [...PART_FIELDS.map(k => r[columns[k] ?? -1] ?? ""), ...extraFields.map(f => r[columns.details?.[f.id] ?? -1] ?? "")]));
      setImportedDetailIds(extraFields.filter(f => (columns.details?.[f.id] ?? -1) >= 0).map(f => f.id));
      setHiddenColumns([...PART_FIELDS.map((k, i) => (columns[k] ?? -1) < 0 ? i : -1), ...extraFields.map((f, i) => (columns.details?.[f.id] ?? -1) < 0 ? 5 + i : -1)].filter(i => i >= 0));
      setPreview(null);
      setUndo(null);
      mappedSignature.current = signature;
    }
    setAttempted(true);
    setTouched({});
    setIssuesOnly(false);
    setStage("entry");
    setPage(0);
    setSelected([]);
  }
  const columnCount = mapping.length;
  const availableFields = [...extraFields, ...PART_DETAIL_PRESETS.filter(p => extraFields.length < 12 && !extraFields.some(f => f.id === p.id || f.label.toLowerCase() === p.label.toLowerCase()))];
  const fieldOptions = [...PART_FIELDS.map((key, i) => ({value: key, label: PART_LABELS[i]})), ...availableFields.map(f => ({value: `detail:${f.id}`, label: `${f.label}${f.private ? " (private)" : ""}`}))];
  const missingRequired = [columns.partNumber < 0 ? "part number" : "", columns.quantity < 0 ? "quantity" : ""].filter(Boolean);
  const unmatched = mapping.filter(value => !value).length;
  const mappingIssue = missingRequired.length ? `Choose a column for ${missingRequired.join(" and ")}.` : unmatched ? `Choose a field or Skip for ${unmatched} ${unmatched === 1 ? "column" : "columns"}.` : "";
  const skipped = mapping.filter(value => value === "skip").length;
  const sourceRows = raw.slice(hasHeader ? 1 : 0).filter(row => row.some(cell => cell.trim()));
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
  const visibleIndexes = rows.map((_, i) => i).filter(i => !issuesOnly || Boolean(cellErrors[i]));
  const visible = visibleIndexes.slice(page * 50, page * 50 + 50);
  useEffect(() => { setPage(current => Math.min(current, Math.max(0, Math.ceil(visibleIndexes.length / 50) - 1))); }, [visibleIndexes.length]);
  const fileFlow = source === "file" && stage !== "choose";
  const sheetTools = <div className={styles.sheetToolbar} role="group" aria-label="Sheet tools">
        <span>{selected.length ? `${selected.length} selected` : `${rows.length} ${rows.length === 1 ? "part" : "parts"}`}</span>
        <AddPartField column fields={extraFields} onAdd={addField}/>
        <button disabled={busy} onClick={() => setTool({kind: "columns"})}>Manage columns</button>
        <button disabled={busy || !rows.length} onClick={() => setTool({kind: "bulk"})}>Bulk edit</button>
        <button disabled={busy || !undo} onClick={() => {if (undo) {setRows(undo.rows);setExtraFields(undo.fields);setHiddenColumns(undo.hidden);setUndo(null);setSelected([]);setPage(0);setError("");setPreview(null);}}}>Undo</button>
      </div>;
  return (
    <div data-parts-import={fileFlow || undefined} className={`${styles.importForm} ${sheetEntry ? styles.stockSheet : ""}`}>
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
      {tool && <PartsSheetTools removableFieldIds={extraFields.filter(f=>editSnapshot || !initialFields.some(old=>old.id===f.id)).map(f=>f.id)} listName={listName} extraFields={extraFields} tool={tool} vatIncluded={details.vatIncluded} rows={rows} selected={selected} hidden={hiddenColumns} onHidden={setHiddenColumns} labels={labels} onClose={() => setTool(null)} onApply={(next, removing, fields) => {change(next, removing);if(fields) {setExtraFields(fields);setMapping(mapping.map(value => value.startsWith("detail:") && !fields.some(f => `detail:${f.id}` === value) ? "" : value));setHiddenColumns(hiddenColumns.flatMap(i=>i<5 ? [i] : fields.some(f=>f.id===extraFields[i-5]?.id) ? [5+fields.findIndex(f=>f.id===extraFields[i-5]?.id)] : []));}setError("");if (removing) {setSelected([]);setPage(Math.min(page, Math.max(0, Math.ceil(next.length / 50) - 1)));}}} />}
      {sheetEntry && source !== "file" && sheetTools}
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
            <div className={importStyles.heading}><h3 ref={importHeading} tabIndex={-1}>Upload your stocklist</h3><p>Choose a file or paste cells from Excel.</p></div>
            <div className={importStyles.tabs} role="group" aria-label="Import source">
              <button type="button" aria-pressed={!pasteMode} onClick={() => setPasteMode(false)}>Upload file</button>
              <button type="button" aria-pressed={pasteMode} onClick={() => setPasteMode(true)}>Paste cells</button>
            </div>
            {!pasteMode ? <label className={importStyles.drop} data-dragging={dragging || undefined}
              onDragOver={e => {e.preventDefault(); if (!busy) setDragging(true);}}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {e.preventDefault(); setDragging(false); if (!busy && e.dataTransfer.files[0]) void loadFile(e.dataTransfer.files[0]);}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 13h8m-8 4h5"/></svg>
              <strong>Drop your file here, or browse</strong><span>CSV or Excel (.xlsx)</span>
              <input aria-label="Upload parts file" type="file" accept=".csv,.xlsx" onChange={e => {const file = e.target.files?.[0]; e.target.value = ""; if (file) void loadFile(file);}}/>
            </label> : <div className={importStyles.paste}>
              <label>Cells from Excel or Sheets<textarea aria-label="Paste spreadsheet cells" value={pastedTable} onChange={e => setPastedTable(e.target.value)} placeholder="Copy your cells, then paste them here."/></label>
            </div>}
            <p className={importStyles.uploadHint}>{pasteMode ? "With or without headings. Keep your columns in any order." : "CSV up to 2 MB · Excel up to 5 MB"}</p>
          </section>}
          {stage === "mapping" && <section className={importStyles.mapping}>
            <div className={importStyles.heading}><h3 ref={importHeading} tabIndex={-1}>Check your columns</h3></div>
            <div className={importStyles.fileSummary}><div><strong>{fileName}</strong><span>{sourceRows.length.toLocaleString()} {sourceRows.length === 1 ? "part" : "parts"} · {columnCount} columns</span></div>{sheets.length > 1 && <ModalSelect className={importStyles.worksheet} label="Worksheet" buttonLabel="Worksheet" value={String(sheetIndex)} options={sheets.map((sheet, i) => ({value: String(i), label: sheet.name}))} onChange={value => {const i = Number(value); setSheetIndex(i); loadTable(sheets[i].rows);}}/>}<button onClick={() => setStage("file")}>Change file</button></div>

            <label className={importStyles.headerChoice}><input aria-label="First row is headings" type="checkbox" checked={hasHeader} onChange={e => changeHeader(e.target.checked)}/><span>First row is headings<small>{raw[0]?.join(" · ")}</small></span></label>
            <div className={importStyles.columnList} role="group" aria-label="File columns">
              <div className={importStyles.columnHead} aria-hidden="true"><span>Your file</span><span>Sample values</span><span>Use as</span></div>
              {mapping.map((value, i) => <div key={i} className={importStyles.columnRow} data-skipped={value === "skip" || undefined}>
                <div className={importStyles.columnName}><span className={importStyles.letter}>{columnLetter(i)}</span><strong>{hasHeader && raw[0]?.[i] ? raw[0][i] : `Column ${columnLetter(i)}`}</strong></div>
                <div className={importStyles.samples}>{sourceRows.slice(0, 2).map((row, n) => <span key={n}>{row[i]?.trim() || "—"}</span>)}</div>
                <ModalSelect className={importStyles.columnSelect} label={`Use column ${columnLetter(i)} as`} buttonLabel={`Use column ${columnLetter(i)} as`} value={value} placeholder="Choose a field" showDescriptions={false} options={[{value: "", label: "Choose a field"}, ...fieldOptions.filter(option => option.value === value || !mapping.includes(option.value)), {value: "skip", label: "Skip this column"}]} onChange={key => {
                  const field = availableFields.find(f => `detail:${f.id}` === key);
                  if (field && !extraFields.some(f => f.id === field.id)) setExtraFields([...extraFields, field]);
                  setMapping(mapping.map((old, index) => index === i ? key : old));
                }}/>
              </div>)}
            </div>
            <div className={importStyles.mappingExtras}><span>Need another field?</span><AddPartField fields={extraFields} onAdd={addField}/></div>
          </section>}
          {stage === "entry" && source === "file" && <>
            <div className={importStyles.reviewHeading}><div className={importStyles.heading}><h3 ref={importHeading} tabIndex={-1}>Review parts</h3><p>{invalid ? `${invalid} ${invalid === 1 ? "part needs" : "parts need"} attention` : `${populated.length.toLocaleString()} ${populated.length === 1 ? "part" : "parts"} ready`} · Edit any cell below.</p></div>{invalid > 0 || issuesOnly ? <button aria-pressed={issuesOnly} onClick={() => {setIssuesOnly(!issuesOnly); setPage(0); setHiddenColumns(current => current.filter(j => !Object.values(cellErrors).some(cells => cells[j])));}}>{issuesOnly ? "Show all parts" : "Show issues"}</button> : null}</div>
            <details className={importStyles.importSettings}><summary>Contact &amp; prices <span>{details.businessName} · {details.vatIncluded ? "Incl." : "Excl."} VAT</span></summary><div className={styles.grid}>
              {(["businessName", "town", "phone", "email"] as const).map((key, i) => <label key={key}>{["Business", "Town", "Phone", "Email"][i]}<input value={details[key]} onChange={e => {setDetails({...details, [key]: e.target.value}); setPreview(null);}}/></label>)}
              <PartsChoice label="Prices in this file" value={String(details.vatIncluded)} onChange={value => {setDetails({...details, vatIncluded: value === "true"}); setPreview(null);}} options={[{value: "false", label: "Exclude VAT"}, {value: "true", label: "Include VAT"}]}/>
            </div></details>
            <details className={importStyles.importSettings}><summary>Editing tools</summary>{sheetTools}</details>
            {initialFields.some(f => !extraFields.some(next => next.id === f.id)) && <p className={styles.error}>Columns to delete: {initialFields.filter(f => !extraFields.some(next => next.id === f.id)).map(f => f.label).join(", ")}. Their values will be removed from every part.</p>}
            {preview && <div role="status" className={importStyles.importSummary}><strong>Ready to import</strong><span>{preview.summary.added} new · {preview.summary.updated} updated · {preview.summary.removed} removed</span><small>Parts not in this file stay unchanged.</small></div>}
          </>}
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
                          aria-label={issuesOnly ? "Select all rows with issues" : "Select all rows"}
                          checked={visibleIndexes.length > 0 && visibleIndexes.every(i => selected.includes(i))}
                          onChange={e => setSelected(e.target.checked
                            ? [...new Set([...selected, ...visibleIndexes])]
                            : selected.filter(i => !visibleIndexes.includes(i)))}
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
                    {visible.map(i => {
                      const row = rows[i];
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
                {attempted && invalid > 0 && source !== "file" && (
                  <button
                    onClick={() =>
                      setPage(Math.floor(Number(Object.keys(errors)[0]) / 50))
                    }
                  >
                    Show first issue
                  </button>
                )}
                {visibleIndexes.length > 50 && (
                  <>
                    <button disabled={!page} onClick={() => setPage(page - 1)}>
                      Previous
                    </button>
                    <span>
                      Page {page + 1} of {Math.ceil(visibleIndexes.length / 50)}
                    </span>
                    <button
                      disabled={(page + 1) * 50 >= visibleIndexes.length}
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
            {stage === "mapping" && <p className={importStyles.footerStatus} role="status">{mappingIssue || `${sourceRows.length.toLocaleString()} ${sourceRows.length === 1 ? "part" : "parts"}${skipped ? ` · ${skipped} ${skipped === 1 ? "column" : "columns"} skipped` : " · Columns matched"}`}</p>}
            <div className={styles.actions}>
              {stage === "file" && pasteMode && <button className={styles.primary} disabled={!pastedTable.trim()} onClick={() => void run(async () => {loadTable(readPartsCsv(pastedTable, {delimiter: "\t", preserveEmptyRows: true})); setSheets([]); setFileName("Pasted cells");})}>Check columns</button>}
              {stage === "entry" && source === "file" && preview ? <button className={styles.primary} onClick={() => void run(() => save())}>{busy ? "Importing…" : `Import ${populated.length.toLocaleString()} ${populated.length === 1 ? "part" : "parts"}`}</button> : stage === "entry" && (
                <button className={styles.primary} onClick={continueEntry}>
                  {busy ? "Checking…" : editSnapshot ? "Review changes" : source === "file" ? "Check import" : "Continue"}
                </button>
              )}
              {stage === "mapping" && raw.length > 0 && (
                <button
                  className={styles.primary}
                  disabled={!!mappingIssue}
                  onClick={() => void run(async () => mapTable())}
                >
                  Review parts
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
