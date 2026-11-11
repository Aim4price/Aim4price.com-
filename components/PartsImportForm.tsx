"use client";
import { useState } from "react";
import {
  guessPartColumns,
  readPartsCsv,
  partsTableCsv,
  type PartColumns,
  type PartRow,
} from "../lib/parts-network-csv";
import { readPartsExcel } from "../lib/parts-network-excel";
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
  sample: PartRow[];
};
const fields = [
  "partNumber",
  "quantity",
  "price",
  "brand",
  "description",
] as const;
const labels = {
  partNumber: "Part number",
  quantity: "Quantity",
  price: "Unit price",
  brand: "Brand",
  description: "Description",
};
const blank = () => ({
  partNumber: "",
  quantity: "1",
  price: "",
  brand: "",
  description: "",
});
const manualColumns: PartColumns = {
  partNumber: 0,
  quantity: 1,
  price: 2,
  brand: 3,
  description: 4,
};
export default function PartsImportForm({
  initialDetails,
  request,
  onComplete,
  onBusyChange,
}: {
  initialDetails: Details;
  request: (body: Record<string, unknown>) => Promise<any>;
  onComplete: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [source, setSource] = useState<"manual" | "csv" | "sheet" | null>(null);
  const [details, setDetails] = useState(initialDetails);
  const [table, setTable] = useState<string[][]>([]);
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>(
    [],
  );
  const [sheetIndex, setSheetIndex] = useState(0);
  const [paste, setPaste] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [columns, setColumns] = useState<PartColumns>({
    partNumber: -1,
    quantity: -1,
    price: -1,
  });
  const [prefix, setPrefix] = useState("");
  const [defaultBrand, setDefaultBrand] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [manual, setManual] = useState([blank()]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  function loadTable(rows: string[][]) {
    if (!rows.length) throw new Error("The table is empty.");
    const guessed = guessPartColumns(rows[0]);
    const headings = guessed.partNumber >= 0 && guessed.quantity >= 0;
    setTable(rows);
    setHasHeader(headings);
    setColumns(
      headings
        ? guessed
        : {
            partNumber: 0,
            quantity: -1,
            price: -1,
            brand: -1,
            description: -1,
          },
    );
    setPrefix("");
    setPreview(null);
  }
  const payload = () => ({
    csv:
      source === "manual"
        ? partsTableCsv(manual.map((row) => fields.map((key) => row[key])))
        : partsTableCsv(table),
    columns: source === "manual" ? manualColumns : columns,
    options: {
      hasHeader: source === "manual" ? false : hasHeader,
      stripPrefix: source === "manual" ? "" : prefix,
      defaultBrand,
    },
    mode: source === "manual" ? "merge" : mode,
    ...details,
  });
  const ready = source === "manual" || table.length > 0;
  const choices = [
    {
      key: "manual",
      title: "Add manually",
      help: "Enter one or more parts",
      path: "M12 5v14M5 12h14",
    },
    {
      key: "csv",
      title: "Upload CSV",
      help: "Choose a stocklist file",
      path: "M12 16V3M7 8l5-5 5 5M3 15v6h18v-6",
    },
    {
      key: "sheet",
      title: "Excel / Sheets",
      help: "Upload Excel or paste cells",
      path: "M3 3h18v18H3zM3 9h18M9 3v18M3 15h18",
    },
  ] as const;
  return (
    <div className={styles.importForm}>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!preview ? (
        <fieldset disabled={busy} className={styles.importFields}>
          <div className={styles.importChoices}>
            {choices.map((choice) => (
              <button
                key={choice.key}
                type="button"
                aria-pressed={source === choice.key}
                onClick={() => {
                  setSource(choice.key);
                  setTable([]);
                  setSheets([]);
                  setPaste("");
                  setError("");
                  setPrefix("");
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d={choice.path} />
                </svg>
                <strong>{choice.title}</strong>
                <small>{choice.help}</small>
              </button>
            ))}
          </div>
          {source === "manual" && (
            <>
              <p>
                Add or update parts by part number. Other parts in this list
                stay unchanged.
              </p>
              <div className={styles.manualRows}>
                {manual.map((row, index) => (
                  <div className={styles.manualRow} key={index}>
                    <div className={styles.grid}>
                      {fields.map((key) => (
                        <label key={key}>
                          {labels[key]}
                          {key !== "partNumber" && key !== "quantity"
                            ? " (optional)"
                            : ""}
                          <input
                            aria-label={`${labels[key]} ${index + 1}`}
                            value={row[key]}
                            inputMode={
                              key === "quantity"
                                ? "numeric"
                                : key === "price"
                                  ? "decimal"
                                  : undefined
                            }
                            maxLength={key === "description" ? 500 : 100}
                            onChange={(e) =>
                              setManual(
                                manual.map((r, i) =>
                                  i === index
                                    ? { ...r, [key]: e.target.value }
                                    : r,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                    {manual.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setManual(manual.filter((_, i) => i !== index))
                        }
                      >
                        Remove row {index + 1}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setManual([...manual, blank()])}
              >
                Add another part
              </button>
            </>
          )}
          {(source === "csv" || source === "sheet") && (
            <>
              <label className={styles.drop}>
                <strong>
                  {source === "csv"
                    ? "Choose a CSV file"
                    : "Choose an Excel file (.xlsx)"}
                </strong>
                <span>
                  {source === "csv"
                    ? "Up to 2 MB"
                    : "Up to 5 MB · Choose a worksheet after upload"}
                </span>
                <input
                  key={source}
                  type="file"
                  accept={
                    source === "csv"
                      ? ".csv,text/csv"
                      : ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setTable([]);
                    setSheets([]);
                    void run(async () => {
                      if (source === "csv") {
                        if (file.size > 2_000_000)
                          throw new Error("Use a CSV smaller than 2 MB.");
                        loadTable(readPartsCsv(await file.text()));
                      } else {
                        if (!file.name.toLowerCase().endsWith(".xlsx"))
                          throw new Error(
                            "Use .xlsx or paste cells from your spreadsheet.",
                          );
                        if (file.size > 5_000_000)
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
                      }
                    });
                  }}
                />
              </label>
              {source === "sheet" && (
                <>
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
                        {sheets.map((sheet, i) => (
                          <option value={i} key={sheet.name}>
                            {sheet.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Or paste a table from Excel or Google Sheets
                    <textarea
                      aria-label="Paste spreadsheet cells"
                      value={paste}
                      onChange={(e) => {
                        setPaste(e.target.value);
                        setTable([]);
                        setSheets([]);
                      }}
                      placeholder="Copy the cells, including headings if available, and paste here."
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!paste.trim()}
                    onClick={() =>
                      void run(async () => loadTable(readPartsCsv(paste)))
                    }
                  >
                    Use pasted table
                  </button>
                </>
              )}
              {table.length > 0 && (
                <>
                  <label className={styles.importCheck}>
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => {
                        setHasHeader(e.target.checked);
                        setColumns(
                          e.target.checked
                            ? guessPartColumns(table[0])
                            : {
                                partNumber: 0,
                                quantity: -1,
                                price: -1,
                                brand: -1,
                                description: -1,
                              },
                        );
                      }}
                    />
                    First row contains column headings
                  </label>
                  <div className={styles.grid}>
                    {fields.map((key) => (
                      <label key={key}>
                        {labels[key]}
                        {key !== "partNumber" && key !== "quantity"
                          ? " (optional)"
                          : ""}
                        <select
                          aria-label={`${labels[key]} column`}
                          value={columns[key] ?? -1}
                          onChange={(e) =>
                            setColumns({
                              ...columns,
                              [key]: Number(e.target.value),
                            })
                          }
                        >
                          <option value={-1}>
                            {key === "partNumber" || key === "quantity"
                              ? "Choose column"
                              : "Not supplied"}
                          </option>
                          {table[0].map((cell, i) => (
                            <option value={i} key={i}>
                              {hasHeader
                                ? cell || `Column ${i + 1}`
                                : `Column ${i + 1}: ${cell.slice(0, 50)}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <label>
                    Remove this prefix from part numbers (optional)
                    <input
                      aria-label="Remove part number prefix"
                      value={prefix}
                      maxLength={30}
                      placeholder="e.g. 01."
                      onChange={(e) => setPrefix(e.target.value)}
                    />
                  </label>
                  <small>
                    Only an exact match at the start is removed. Check the part
                    numbers in the review.
                  </small>
                  <label>
                    Update this list
                    <select
                      value={mode}
                      onChange={(e) =>
                        setMode(e.target.value as "merge" | "replace")
                      }
                    >
                      <option value="merge">
                        Add / update these parts — keep other parts
                      </option>
                      <option value="replace">
                        Replace full list — remove parts not included
                      </option>
                    </select>
                  </label>
                </>
              )}
            </>
          )}
          {ready && (
            <>
              <label>
                Default brand (optional)
                <input
                  aria-label="Default brand"
                  value={defaultBrand}
                  maxLength={100}
                  placeholder="e.g. Landini"
                  onChange={(e) => setDefaultBrand(e.target.value)}
                />
              </label>
              <p>
                Blank prices show as “Price on request”. Brand and description
                are optional.
              </p>
              <div className={styles.grid}>
                {(["businessName", "town", "phone", "email"] as const).map(
                  (key) => (
                    <label key={key}>
                      {
                        {
                          businessName: "Dealership",
                          town: "Town",
                          phone: "Contact phone",
                          email: "Contact email",
                        }[key]
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
              <button
                className={styles.primary}
                disabled={
                  busy ||
                  (source !== "manual" &&
                    (columns.partNumber < 0 || columns.quantity < 0))
                }
                onClick={() =>
                  void run(async () =>
                    setPreview(
                      await request({ action: "preview", ...payload() }),
                    ),
                  )
                }
              >
                Review parts
              </button>
            </>
          )}
        </fieldset>
      ) : (
        <>
          <div className={styles.summary}>
            {Object.entries(preview.summary).map(([key, value]) => (
              <div key={key}>
                <strong>{value.toLocaleString()}</strong>
                <span>{key}</span>
              </div>
            ))}
          </div>
          <p>
            {source === "manual" || mode === "merge"
              ? "These part numbers will be added or updated. Other parts stay unchanged. Supplied rows replace their previous details."
              : "Parts missing from this table will be removed from your listing."}{" "}
            Your master stock records and cost ledger are unaffected.
          </p>
          <p>Sample of imported parts:</p>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Part number</th>
                  <th>Description</th>
                  <th>Brand</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((row) => (
                  <tr key={row.partNumber}>
                    <td>{row.partNumber}</td>
                    <td>{row.description || "—"}</td>
                    <td>{row.brand || "—"}</td>
                    <td>{row.quantity}</td>
                    <td>
                      {row.price === null
                        ? "Price on request"
                        : row.price.toLocaleString("en-ZA", {
                            style: "currency",
                            currency: "ZAR",
                          })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.actions}>
            <button disabled={busy} onClick={() => setPreview(null)}>
              Back
            </button>
            <button
              disabled={busy}
              className={styles.primary}
              onClick={() =>
                void run(async () => {
                  await request({
                    action: "import",
                    ...payload(),
                    revision: preview.revision,
                  });
                  await onComplete();
                })
              }
            >
              {source === "manual" || mode === "merge"
                ? "Save parts"
                : "Replace my parts list"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
