"use client";
import { useEffect, useRef, useState } from "react";
import ShareModalCloseButton from "./asset-register/ShareModalCloseButton";
import { createPortal } from "react-dom";
import { PART_LABELS, partCellErrors } from "../lib/parts-editor";
import styles from "../app/dealer/parts/parts.module.css";

export type SheetTool = { kind: "columns" | "bulk" } | { kind: "row"; index: number };
export default function PartsSheetTools({ tool, rows, selected, hidden, vatIncluded, onHidden, onApply, onClose }: {
  vatIncluded: boolean;
  tool: SheetTool; rows: string[][]; selected: number[]; hidden: number[];
  onHidden: (columns: number[]) => void;
  onApply: (rows: string[][], removing?: boolean) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [scope, setScope] = useState(selected.length ? "selected" : "all");
  const [field, setField] = useState(4);
  const [operation, setOperation] = useState("replace");
  const [value, setValue] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [trim, setTrim] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [rowMode, setRowMode] = useState<"choose" | "edit" | "delete">("choose");
  const [draft, setDraft] = useState(tool.kind === "row" ? [...rows[tool.index]] : []);
  const [error, setError] = useState("");
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  const selectedSet = new Set(selected);
  const targets = rows.map((_, i) => i).filter(i => scope === "all" || selectedSet.has(i));
  const targetSet = new Set(targets);
  const next = rows.map((row, i) => {
    if (!targetSet.has(i)) return row;
    if (field === 0) {
      let number = trim ? row[0].trim() : row[0];
      if (prefix && number.startsWith(prefix)) number = number.slice(prefix.length);
      if (suffix && number.endsWith(suffix)) number = number.slice(0, -suffix.length);
      return [number, ...row.slice(1)];
    }
    return row.map((cell, j) => j !== field || (operation === "fill" && cell.trim()) ? cell : operation === "clear" ? "" : value);
  });
  const changed = targets.filter(i => next[i][field] !== rows[i][field]);
  const bulkErrors = tool.kind === "bulk" && showPreview ? partCellErrors(next) : {};
  const invalid = changed.filter(i => (field === 0 && !next[i][0].trim()) || !!bulkErrors[i]?.[field]);
  const applyBulk = () => {
    if (!changed.length || invalid.length) return;
    onApply(next); onClose();
  };
  const title = tool.kind === "columns" ? "Visible columns" : tool.kind === "bulk" ? "Bulk edit parts" : rowMode === "edit" ? "Edit part" : rowMode === "delete" ? "Delete row?" : "Part actions";
  return createPortal(<dialog ref={dialog} className={`${styles.modal} ${styles.sheetToolDialog}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className={styles.sheetToolHeader}><div><h2>{title}</h2>{tool.kind === "row" && <p>{rows[tool.index][0] || `Row ${tool.index + 1}`}</p>}</div><ShareModalCloseButton aria-label="Close sheet tool" onClick={onClose} /></header>
    <div className={styles.sheetToolBody}>
      {tool.kind === "columns" && <><p>Choose which fields to display. Hidden values are kept when you save or export.</p><div className={styles.sheetColumnChoices}>{PART_LABELS.map((label, i) => <label key={label}><input type="checkbox" checked={!hidden.includes(i)} disabled={i === 0 || i === 2} onChange={e => onHidden(e.target.checked ? hidden.filter(n => n !== i) : [...hidden, i])}/>{label}{(i === 0 || i === 2) && <small>Always visible</small>}</label>)}</div></>}
      {tool.kind === "bulk" && <>
        <div className={styles.sheetToolFields}>
          <label>Apply to<select value={scope} onChange={e => {setScope(e.target.value);setShowPreview(false);}}><option value="selected" disabled={!selected.length}>Selected rows ({selected.length})</option><option value="all">All rows ({rows.length})</option></select></label>
          <label>Field<select value={field} onChange={e => {setField(Number(e.target.value));setOperation("replace");setValue("");setShowPreview(false);}}>{[1,2,4,3,0].map(i => <option key={i} value={i}>{i === 0 ? "Clean up part numbers" : PART_LABELS[i]}</option>)}</select></label>
          {field !== 0 ? <><label>Action<select value={operation} onChange={e => {setOperation(e.target.value);setShowPreview(false);}}><option value="replace">Replace value</option><option value="fill">Fill empty cells</option>{field !== 2 && <option value="clear">Clear field</option>}</select></label>{operation !== "clear" && <label>{field === 3 ? `Unit price (R, ${vatIncluded ? "incl." : "excl."} VAT)` : "New value"}<input value={value} inputMode={field === 2 ? "numeric" : field === 3 ? "decimal" : undefined} onChange={e => {setValue(e.target.value);setShowPreview(false);}} /></label>}</> : <><label>Remove prefix<input value={prefix} placeholder="e.g. 01." onChange={e => {setPrefix(e.target.value);setShowPreview(false);}}/></label><label>Remove suffix<input value={suffix} placeholder="e.g. .1" onChange={e => {setSuffix(e.target.value);setShowPreview(false);}}/></label><label className={styles.sheetCheck}><input type="checkbox" checked={trim} onChange={e => {setTrim(e.target.checked);setShowPreview(false);}}/>Trim surrounding spaces</label></>}
        </div>
        <p>{targets.length} {targets.length === 1 ? "row" : "rows"} in scope · {changed.length} will change. Changes stay in the sheet until reviewed and saved.</p>
        {showPreview && <><div className={styles.tableWrap}><table><thead><tr><th>Part</th><th>Before</th><th>After</th></tr></thead><tbody>{changed.slice(0, 8).map(i => <tr key={i}><td>{rows[i][0] || `Row ${i + 1}`}</td><td>{rows[i][field] || "Empty"}</td><td>{next[i][field] || "Empty"}</td></tr>)}</tbody></table></div>{changed.length > 8 && <p>Showing the first 8 changes.</p>}{!!invalid.length && <p role="alert" className={styles.error}>Check rows {invalid.slice(0, 8).map(i => i + 1).join(", ")}: {bulkErrors[invalid[0]]?.[field] || "Part number cannot be empty."}</p>}</>}
      </>}
      {tool.kind === "row" && rowMode === "choose" && <div className={styles.sheetRowChoices}><button onClick={() => setRowMode("edit")}>Edit part</button><button className={styles.sheetDelete} onClick={() => setRowMode("delete")}>Delete row</button></div>}
      {tool.kind === "row" && rowMode === "edit" && <div className={styles.sheetToolFields}>{PART_LABELS.map((label, i) => <label key={label}>{i === 3 ? `Unit price (R, ${vatIncluded ? "incl." : "excl."} VAT)` : label}<input aria-label={`Edit row ${label}`} value={draft[i]} placeholder={i !== 0 && i !== 2 ? "Optional" : undefined} inputMode={i === 2 ? "numeric" : i === 3 ? "decimal" : undefined} onChange={e => {setDraft(draft.map((v, j) => j === i ? e.target.value : v));setError("");}}/></label>)}</div>}
      {tool.kind === "row" && rowMode === "delete" && <p>Remove this row from your draft sheet? The saved parts list changes only after you review and save. You can undo this removal in the sheet.</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    <footer className={styles.sheetToolFooter}>
      <button onClick={onClose}>{tool.kind === "columns" ? "Done" : "Cancel"}</button>
      {tool.kind === "bulk" && (showPreview ? <button className={styles.primary} disabled={!changed.length || !!invalid.length} onClick={applyBulk}>Apply to {changed.length} {changed.length === 1 ? "part" : "parts"}</button> : <button className={styles.primary} disabled={!changed.length} onClick={() => setShowPreview(true)}>Preview changes</button>)}
      {tool.kind === "row" && rowMode === "delete" && <button className={styles.sheetDelete} onClick={() => {onApply(rows.filter((_, i) => i !== tool.index), true);onClose();}}>Delete row from sheet</button>}
      {tool.kind === "row" && rowMode === "edit" && <button className={styles.primary} onClick={() => {
        const updated = rows.map((row, i) => i === tool.index ? draft : row);
        const issues = partCellErrors(updated)[tool.index];
        if (!draft[0].trim() || issues) {setError(issues ? Object.values(issues)[0] : "Part number is required.");return;}
        onApply(updated);onClose();
      }}>Apply to sheet</button>}
    </footer>
  </dialog>, document.body);
}
