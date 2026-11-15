"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
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
  blankPart,
  pastePartsCells,
  partCellErrors,
  EXAMPLE_PARTS,
} from "../lib/parts-editor";
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
  initialDetails,
  editSnapshot,
  onBack,
  request,
  onComplete,
  onBusyChange,
  onStageChange,
}: {
  onStageChange?: (stage: string) => void;
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
  const [details, setDetails] = useState(initialDetails);
  const [pastedTable, setPastedTable] = useState("");
  const [raw, setRaw] = useState<string[][]>([]);
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>(
    [],
  );
  const [sheetIndex, setSheetIndex] = useState(0);
  const [hasHeader, setHasHeader] = useState(true);
  const [columns, setColumns] = useState<PartColumns>(EDITOR_COLUMNS);
  const [rows, setRows] = useState<string[][]>(() => editSnapshot?.rows.length ? editSnapshot.rows : [blankPart()]);
  const [stage, setStage] = useState<
    "choose" | "example" | "file" | "entry" | "settings" | "review"
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
  const sheetRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (addRowFocus.current === null) return;
    const input = sheetRef.current?.querySelector<HTMLInputElement>(`[aria-label="Part number ${addRowFocus.current + 1}"]`);
    if (input) { input.focus(); input.scrollIntoView({block: "nearest"}); addRowFocus.current = null; }
  });
  const sheetEntry = stage === "entry" && source !== "manual";
  const [undo, setUndo] = useState<string[][] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(0);
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
        next === "sheet" ? Array.from({ length: 8 }, blankPart) : [blankPart()],
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
      setRows([blankPart()]);
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
    setUndo(rows);
    setRows(next);
    setPreview(null);

  }
  function loadTable(table: string[][]) {
    if (!table.length) throw new Error("The table is empty.");
    setRaw(table);
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
    const indexes = PART_FIELDS.map((k) => columns[k] ?? -1).filter(
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
    setRows(data.map((r) => PART_FIELDS.map((k) => r[columns[k] ?? -1] ?? "")));
    setStage("entry");
    setPage(0);
    setSelected([]);
    setUndo(null);
  }
  const payload = () => ({
    csv: partsTableCsv(populated),
    columns: EDITOR_COLUMNS,
    options: { hasHeader: false },
    mode,
    ...(editSnapshot ? {baseRevision: editSnapshot.revision} : {}),
    ...details,
  });
  async function template(excel: boolean) {
    let blob: Blob;
    if (excel) {
      const Excel = await import("exceljs");
      const book = new Excel.Workbook();
      const sheet = book.addWorksheet("Parts");
      sheet.addRow(PART_LABELS);
      EXAMPLE_PARTS.forEach((r) => sheet.addRow(r));
      sheet.getColumn(1).numFmt = "@";
      sheet.columns.forEach((c) => {
        c.width = 22;
      });
      blob = new Blob([(await book.xlsx.writeBuffer()) as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } else
      blob = new Blob([partsTableCsv([PART_LABELS, ...EXAMPLE_PARTS])], {
        type: "text/csv;charset=utf-8",
      });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parts-example.${excel ? "xlsx" : "csv"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
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
      {tool && <PartsSheetTools tool={tool} vatIncluded={details.vatIncluded} rows={rows} selected={selected} hidden={hiddenColumns} onHidden={setHiddenColumns} onClose={() => setTool(null)} onApply={(next, removing) => {change(next, removing);setError("");if (removing) {setSelected([]);setPage(Math.min(page, Math.max(0, Math.ceil(next.length / 50) - 1)));}}} />}
      {sheetEntry && <div className={styles.sheetToolbar} role="group" aria-label="Sheet tools">
        <span>{selected.length ? `${selected.length} selected` : `${rows.length} ${rows.length === 1 ? "part" : "parts"}`}</span>
        <button disabled={busy} onClick={() => setTool({kind: "columns"})}>Columns</button>
        <button disabled={busy || !rows.length} onClick={() => setTool({kind: "bulk"})}>Bulk edit</button>
        <button disabled={busy || !undo} onClick={() => {if (undo) {setRows(undo);setUndo(null);setSelected([]);setPage(0);setError("");setPreview(null);}}}>Undo</button>
      </div>}
      <fieldset disabled={busy} className={styles.importFields}>
        <div key={stage === "example" ? "example" : "parts"} className={styles.stageBody}>
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
                <div className={styles.actions}>
                  <button onClick={() => void run(() => template(false))}>
                    Download CSV example
                  </button>
                  <button onClick={() => void run(() => template(true))}>
                    Download Excel example
                  </button>
                </div>
              </section>
          )}
          {stage === "file" && (
            <>
              <label className={styles.drop}>
                <strong>Choose CSV or Excel (.xlsx)</strong>
                <span>CSV up to 2 MB · Excel up to 5 MB</span>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setRaw([]);
                    setSheets([]);
                    void run(async () => {
                      if (file.name.toLowerCase().endsWith(".xlsx")) {
                        if (file.size > 5000000)
                          throw new Error(
                            "Use an Excel file smaller than 5 MB.",
                          );
                        const result = await readPartsExcel(
                          await file.arrayBuffer(),
                        );
                        if (!result.length)
                          throw new Error("No populated worksheets found.");
                        setSheets(result);
                        setSheetIndex(0);
                        loadTable(result[0].rows);
                      } else {
                        if (!file.name.toLowerCase().endsWith(".csv"))
                          throw new Error("Choose CSV or .xlsx.");
                        loadTable(readPartsCsv(await file.text()));
                      }
                    });
                  }}
                />
              </label>
              <details>
                <summary>Paste a table with a different column order</summary>
                <label>
                  Cells from Excel / Sheets
                  <textarea
                    aria-label="Paste spreadsheet cells"
                    value={pastedTable}
                    onChange={(e) => {
                      setPastedTable(e.target.value);
                      setRaw([]);
                      setSheets([]);
                    }}
                    placeholder="Paste a block of cells, with or without headings."
                  />
                </label>
                <button
                  disabled={!pastedTable.trim()}
                  onClick={() =>
                    void run(async () =>
                      loadTable(
                        readPartsCsv(pastedTable, {
                          delimiter: "\t",
                          preserveEmptyRows: true,
                        }),
                      ),
                    )
                  }
                >
                  Match pasted columns
                </button>
              </details>
              {sheets.length > 1 && (
                <label>
                  Worksheet
                  <select
                    value={sheetIndex}
                    onChange={(e) => {
                      const i = Number(e.target.value);
                      setSheetIndex(i);
                      loadTable(sheets[i].rows);
                    }}
                  >
                    {sheets.map((s, i) => (
                      <option key={s.name} value={i}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!!raw.length && (
                <>
                  <label className={styles.importCheck}>
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => setHasHeader(e.target.checked)}
                    />
                    First row contains column headings
                  </label>
                  <div className={styles.grid}>
                    {PART_FIELDS.map((key, i) => (
                      <label key={key}>
                        {PART_LABELS[i]}
                        {i !== 0 && i !== 2 ? " (optional)" : ""}
                        <select
                          aria-label={`${PART_LABELS[i]} column`}
                          value={columns[key] ?? -1}
                          onChange={(e) =>
                            setColumns({
                              ...columns,
                              [key]: Number(e.target.value),
                            })
                          }
                        >
                          <option value={-1}>
                            {i === 0 || i === 2
                              ? "Choose column"
                              : "Not supplied"}
                          </option>
                          {Array.from(
                            {
                              length: Math.max(
                                ...raw.slice(0, 100).map((r) => r.length),
                              ),
                            },
                            (_, j) => (
                              <option key={j} value={j}>
                                Column {j + 1}: {(raw[0][j] || "").slice(0, 50)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {stage === "entry" && source === "manual" && (
            <div className={`${styles.partEditFields} ${styles.singlePartForm}`}>
              {[0, 4, 1, 2, 3].map(j => {
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
                  onChange={e => change([(rows[0] || blankPart()).map((v, k) => k === j ? e.target.value : v)])}
                />;
                return <div key={label} className={`${styles.partEditPrice} ${j === 1 ? styles.partEditDescription : ""}`}>
                  <label htmlFor={`add-part-field-${j}`}>
                    {label}{j === 3 && <small>{details.vatIncluded ? "Incl." : "Excl."} VAT</small>}
                  </label>
                  {j === 3 ? <div className={`${priceStyles.amountControl} ${styles.partEditPriceControl} ${styles.addPartAmount}`}>
                    <span aria-hidden="true">R</span>{input}
                  </div> : input}
                  {hint && <small id="add-part-price-hint">{hint}</small>}
                  {error && <small className={styles.cellError} id={`single-error-${j}`}>{error}</small>}
                </div>;
              })}
            </div>
          )}
          {stage === "entry" && source !== "manual" && (
            <>
              <div ref={sheetRef} className={styles.editorWrap} role="region" aria-label="Parts spreadsheet" tabIndex={0}>
                <table className={styles.editorTable}>
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
                      {PART_LABELS.map((label, i) => (
                        <th key={label} hidden={hiddenColumns.includes(i)}>
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
                        <tr key={i} data-selected={selected.includes(i) || undefined}>
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
                            <td key={j} hidden={hiddenColumns.includes(j)}>
                              <input
                                aria-label={`${PART_LABELS[j]} ${i + 1}`}
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
                                        j,
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
                {<button disabled={rows.length >= 20000} onClick={() => {addRowFocus.current = rows.length;change([...rows, blankPart()]);setPage(Math.floor(rows.length / 50));}}>+ Add row</button>}
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
              <p className={styles.stageHint}>Blank prices show as “Price on request”. Existing part numbers cannot be overwritten from Add parts.</p>
              <section aria-label="Contact details and VAT">
                <h3>Contact details &amp; VAT</h3>
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
                  <label>
                    Prices
                    <select
                      value={String(details.vatIncluded)}
                      onChange={(e) =>
                        setDetails({
                          ...details,
                          vatIncluded: e.target.value === "true",
                        })
                      }
                    >
                      <option value="false">Exclude VAT</option>
                      <option value="true">Include VAT</option>
                    </select>
                  </label>
                </div>
              </section>
            </>
          )}
          {stage === "review" && preview && (
            <>
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
        {stage === "choose" && <div className={styles.entryFooter}><button onClick={onBack}>Back</button></div>}
        {stage !== "choose" && (
          <div className={`${styles.entryFooter} ${stage === "entry" && source === "manual" ? styles.partEditFooter : ""}`}>
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
              {stage === "file" && raw.length > 0 && (
                <button
                  className={styles.primary}
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
