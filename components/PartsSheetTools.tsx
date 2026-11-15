"use client";
import { useEffect, useRef, useState } from "react";
import ShareModalCloseButton from "./asset-register/ShareModalCloseButton";
import { createPortal } from "react-dom";
import { PART_LABELS, partCellErrors } from "../lib/parts-editor";
import { DetailIcon } from "./PartsDetailFields";
import PartEditDialog, { type PartEditValue } from "./PartEditDialog";
import { parsePartsSnapshot, partsTableCsv, type PartDetailField } from "../lib/parts-network-csv";
import PartsChoice from "./PartsChoice";
import styles from "../app/dealer/parts/parts.module.css";

export type SheetTool = { kind: "columns" | "bulk" } | { kind: "row"; index: number };
export default function PartsSheetTools({ tool, rows, selected, hidden, vatIncluded, onHidden, onApply, onClose, labels = PART_LABELS, extraFields = [], listName, removableFieldIds }: {
  labels?: string[];
  removableFieldIds?: string[];
  extraFields?: PartDetailField[];
  listName?: string;
  vatIncluded: boolean;
  tool: SheetTool; rows: string[][]; selected: number[]; hidden: number[];
  onHidden: (columns: number[]) => void;
  onApply: (rows: string[][], removing?: boolean, fields?: PartDetailField[]) => void;
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
  const [bulkStep,setBulkStep]=useState(0);
  const [fieldPage,setFieldPage]=useState(0);
  const [previewPage,setPreviewPage]=useState(0);
  const bulkSteps=["Choose rows","Choose field","Set change","Review changes"];
  const fieldOptions=[1,2,4,3,0,...labels.slice(5).map((_,i)=>i+5)];
  const goToStep=(step:number)=>{setBulkStep(step);setShowPreview(step===3);setPreviewPage(0);};
  useEffect(()=>{if(tool.kind==="bulk"){dialog.current?.querySelector<HTMLElement>("[data-bulk-heading]")?.focus();const body=dialog.current?.querySelector("[data-bulk-body]");if(body)body.scrollTop=0;}},[bulkStep,tool.kind]);
  const [rowMode, setRowMode] = useState<"choose" | "edit" | "delete">("choose");
  const [editor, setEditor] = useState<PartEditValue>(() => {
    const row = tool.kind === "row" ? rows[tool.index] : [];
    let price = row[3] || "";
    try { const amount = parsePartsSnapshot(partsTableCsv([["part","1",price]]), {partNumber:0,quantity:1,price:2,description:-1,brand:-1}, {hasHeader:false})[0]?.price; price = amount == null ? "" : String(amount / (vatIncluded ? 1.15 : 1)); } catch { /* Keep invalid drafts available for validation. */ }
    return {partNumber:row[0] || "",description:row[1] || "",quantity:row[2] || "",brand:row[4] || "",price,priceIncluded:vatIncluded,extraFields,details:Object.fromEntries(extraFields.map((f,i)=>[f.id,row[5+i] || ""]))};
  });
  const [columnPage,setColumnPage]=useState(0);
  const [columnAction,setColumnAction]=useState<{index:number;kind:"clear"|"delete"}|null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    if (rowMode !== "edit") dialog.current?.showModal();
    return () => { dialog.current?.close(); if (opener?.isConnected) opener.focus(); };
  }, [rowMode]);
  const columnValueCount = columnAction ? rows.filter((row,i)=>(columnAction.kind==="delete" || scope==="all" || selected.includes(i)) && row[columnAction.index]?.trim()).length : 0;
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
  useEffect(()=>{
    if(tool.kind!=="columns")return;
    const body=dialog.current?.querySelector<HTMLElement>("[data-columns-body]");
    if(body)body.scrollTop=0;
    dialog.current?.querySelector<HTMLElement>("[data-column-heading]")?.focus();
  },[columnAction,columnPage,tool.kind]);
  if (tool.kind === "row" && rowMode === "edit") return <PartEditDialog value={editor} onChange={setEditor} subtitle={listName} onClose={onClose} onBack={()=>{setError("");setRowMode("choose");}} backLabel="Back" feedback={error ? <p role="alert" className={styles.error}>{error}</p> : undefined} onSave={()=>{
    const price = editor.price.trim() && Number.isFinite(Number(editor.price)) ? (Number(editor.price) * (vatIncluded ? 1.15 : 1)).toFixed(2) : editor.price;
    const draft = [editor.partNumber,editor.description,editor.quantity.trim() || rows[tool.index][2],price,editor.brand,...editor.extraFields.map(f=>editor.details[f.id] || "")];
    const updated = rows.map((row,i)=>i===tool.index ? draft : [...row,...editor.extraFields.slice(extraFields.length).map(()=>"")]);
    const issues = partCellErrors(updated)[tool.index];
    if (!draft[0].trim() || issues) {setError(issues ? Object.values(issues)[0] : "Part number is required.");return;}
    onApply(updated,false,editor.extraFields);onClose();
  }}/>;
  const applyColumnAction=()=>{
    if(!columnAction)return;
    const index=columnAction.index;
    if(columnAction.kind==="delete") onApply(rows.map(row=>row.filter((_,i)=>i!==index)),false,extraFields.filter((_,i)=>i!==index-5));
    else onApply(rows.map((row,i)=>targetSet.has(i) ? row.map((cell,j)=>j===index ? "" : cell) : row));
    onClose();
  };
  const title = tool.kind === "columns" ? "Manage columns" : tool.kind === "bulk" ? "Bulk edit parts" : rowMode === "delete" ? "Delete row?" : "Part actions";
  return createPortal(<dialog ref={dialog} className={`${styles.modal} ${styles.sheetToolDialog} ${tool.kind === "bulk" ? styles.bulkWizard : ""} ${tool.kind === "columns" ? styles.columnsDialog : ""} ${tool.kind === "row" && rowMode === "choose" ? styles.marketplaceChoiceModal : ""}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className={styles.sheetToolHeader}><div><h2>{title}</h2>{tool.kind === "row" && <p>{rows[tool.index][0] || `Row ${tool.index + 1}`}</p>}</div><ShareModalCloseButton aria-label="Close sheet tool" onClick={onClose} /></header>
    {tool.kind==="bulk" && <div className={styles.bulkProgress}><span>Step {bulkStep+1} of 4</span><div role="progressbar" aria-label="Bulk edit progress" aria-valuemin={1} aria-valuemax={4} aria-valuenow={bulkStep+1}><span style={{width:`${(bulkStep+1)*25}%`}}/></div></div>}
    <div className={styles.sheetToolBody} data-columns-body={tool.kind==="columns" || undefined} data-bulk-body={tool.kind==="bulk" || undefined}>
      {tool.kind === "columns" && <>
        {columnAction ? <section className={styles.columnActionStage}>
          <div className={styles.columnActionHeading}><DetailIcon kind="delete"/><div><h3 tabIndex={-1} data-column-heading>{columnAction.kind==="delete" ? "Delete column?" : "Clear values?"}</h3><p>{labels[columnAction.index]}</p></div></div>
          {columnAction.kind==="clear" && <PartsChoice label="Clear values for" value={scope} onChange={setScope} options={[{value:"selected",label:`Selected parts (${selected.length})`,disabled:!selected.length},{value:"all",label:`All parts (${rows.filter(r=>r.some(v=>v.trim())).length})`}]} />}
          <div className={styles.columnImpact}><strong>{columnValueCount} {columnValueCount===1 ? "part affected" : "parts affected"}</strong><p>{columnAction.kind==="delete" ? "Removes this column and its values from all parts." : "Clears these values. The column stays in your sheet."}</p></div>
          <p className={styles.bulkHint}>Draft only. You can undo this before saving the sheet.</p>
        </section> : <>
          <div className={styles.columnIntro}><p tabIndex={-1} data-column-heading>Choose which columns to show.</p><span>Hidden values are kept.</span></div>
          <div className={styles.manageColumns}>{labels.slice(columnPage*6,columnPage*6+6).map((label,offset)=>{const i=columnPage*6+offset;const count=rows.filter(r=>r[i]?.trim()).length;return <div key={i} className={styles.manageColumnRow}>
            <label><input type="checkbox" checked={!hidden.includes(i)} disabled={i===0 || i===2} onChange={e=>onHidden(e.target.checked ? hidden.filter(n=>n!==i) : [...hidden,i])}/><span><strong title={label}>{label}</strong><small>{i===0 || i===2 ? "Required · always visible" : `${count} ${count===1 ? "part" : "parts"} with values`}</small></span></label>
            <div className={styles.columnCardActions}>
              {i===0 || i===2 ? <span>Required column</span> : <button type="button" disabled={!rows.some(row=>row[i]?.trim())} onClick={()=>setColumnAction({index:i,kind:"clear"})} aria-label={`Clear ${label} values`}>Clear values</button>}
              {i>=5 && <button type="button" className={styles.detailTrash} aria-label={`Delete ${label} column`} disabled={removableFieldIds && !removableFieldIds.includes(extraFields[i-5].id)} title={removableFieldIds && !removableFieldIds.includes(extraFields[i-5].id) ? "Use Edit in a sheet to delete an existing column" : "Delete column"} onClick={()=>setColumnAction({index:i,kind:"delete"})}><DetailIcon kind="delete"/></button>}
            </div>
          </div>})}</div>
          {labels.length>6 && <div className={styles.bulkPager}><button disabled={!columnPage} onClick={()=>setColumnPage(columnPage-1)}>Previous columns</button><span>{columnPage+1} / {Math.ceil(labels.length/6)}</span><button disabled={(columnPage+1)*6>=labels.length} onClick={()=>setColumnPage(columnPage+1)}>More columns</button></div>}
        </>}

      </>}
      {tool.kind === "bulk" && <section className={styles.bulkStage}>
        <h3 tabIndex={-1} data-bulk-heading>{bulkSteps[bulkStep]}</h3>
        {bulkStep===0 && <><p>Which parts should change?</p><PartsChoice label="Apply to" value={scope} onChange={setScope} options={[{value:"selected",label:`Selected rows (${selected.length})`,disabled:!selected.length},{value:"all",label:`All rows (${rows.length})`}]} /></>}
        {bulkStep===1 && <><p>Choose one field for {targets.length} {targets.length===1 ? "row" : "rows"}.</p><PartsChoice label="Field to change" value={String(field)} onChange={v=>{setField(Number(v));setOperation("replace");setValue("");}} options={fieldOptions.slice(fieldPage*6,fieldPage*6+6).map(i=>({value:String(i),label:i===0 ? "Part numbers" : labels[i]}))}/>{fieldOptions.length>6 && <div className={styles.bulkPager}><button disabled={!fieldPage} onClick={()=>setFieldPage(fieldPage-1)}>Previous fields</button><span>{fieldPage+1} / {Math.ceil(fieldOptions.length/6)}</span><button disabled={(fieldPage+1)*6>=fieldOptions.length} onClick={()=>setFieldPage(fieldPage+1)}>More fields</button></div>}</>}
        {bulkStep===2 && <><p>{labels[field]} · {targets.length} {targets.length===1 ? "row" : "rows"}</p>{field!==0 ? <><PartsChoice label="How to change it" value={operation} onChange={setOperation} options={[{value:"replace",label:"Replace value",hint:"Set a new value"},{value:"fill",label:"Fill empty cells",hint:"Keep existing values"},...(field!==2 ? [{value:"clear",label:"Clear field",hint:"Remove values"}] : [])]}/>{operation!=="clear" && <label className={styles.bulkValue}>{field===3 ? `Unit price (R, ${vatIncluded ? "incl." : "excl."} VAT)` : "New value"}<input autoFocus value={value} inputMode={field===2 ? "numeric" : field===3 ? "decimal" : undefined} onChange={e=>setValue(e.target.value)}/></label>}</> : <><div className={styles.bulkCleanup}><label>Remove prefix<input value={prefix} placeholder="e.g. 01." onChange={e=>setPrefix(e.target.value)}/></label><label>Remove suffix<input value={suffix} placeholder="e.g. .1" onChange={e=>setSuffix(e.target.value)}/></label></div><label className={styles.sheetCheck}><input type="checkbox" checked={trim} onChange={e=>setTrim(e.target.checked)}/>Trim surrounding spaces</label></>}<p className={styles.bulkHint}>{changed.length ? `${changed.length} ${changed.length===1 ? "row will" : "rows will"} change.` : "Enter a change to preview."}</p></>}
        {bulkStep===3 && <><p>{labels[field]} · {changed.length} {changed.length===1 ? "row will" : "rows will"} change</p><div className={styles.bulkReview}>{changed.slice(previewPage*3,previewPage*3+3).map(i=><div key={i}><strong title={rows[i][0]}>{rows[i][0] || `Row ${i+1}`}</strong><span><small>Before</small><span title={rows[i][field]}>{rows[i][field] || "Empty"}</span></span><span><small>After</small><span title={next[i][field]}>{next[i][field] || "Empty"}</span></span></div>)}</div>{changed.length>3 && <div className={styles.bulkPager}><button disabled={!previewPage} onClick={()=>setPreviewPage(previewPage-1)}>Previous</button><span>{previewPage+1} / {Math.ceil(changed.length/3)}</span><button disabled={(previewPage+1)*3>=changed.length} onClick={()=>setPreviewPage(previewPage+1)}>Next</button></div>}{!!invalid.length && <p role="alert" className={styles.error}>Check row {invalid[0]+1}: {bulkErrors[invalid[0]]?.[field] || "Part number cannot be empty."}</p>}<p className={styles.bulkHint}>This updates your draft. Save the sheet when ready.</p></>}
      </section>}
      {tool.kind === "row" && rowMode === "choose" && <div className={styles.sheetRowChoices}><button type="button" data-detail="edit" onClick={() => setRowMode("edit")}><DetailIcon kind="edit"/><span><strong>Edit part</strong><small>Update this part’s details in the sheet.</small></span></button><button type="button" data-detail="delete" onClick={() => setRowMode("delete")}><DetailIcon kind="delete"/><span><strong>Delete row</strong><small>Remove this part from the draft sheet.</small></span></button></div>}

      {tool.kind === "row" && rowMode === "delete" && <p>Remove this row from your draft sheet? The saved parts list changes only after you review and save. You can undo this removal in the sheet.</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    <footer className={styles.sheetToolFooter}>
      {tool.kind==="columns" && columnAction ? <><button onClick={()=>setColumnAction(null)}>Back</button><button className={styles.sheetDelete} disabled={columnAction.kind==="clear" && !columnValueCount} onClick={applyColumnAction}>{columnAction.kind==="delete" ? "Delete column from sheet" : "Clear values in sheet"}</button></> : <button className={tool.kind==="columns" ? styles.primary : undefined} onClick={onClose}>{tool.kind === "columns" ? "Done" : "Cancel"}</button>}
      {tool.kind === "bulk" && <>{bulkStep>0 && <button onClick={()=>goToStep(bulkStep-1)}>Back</button>}{bulkStep===3 ? <button className={styles.primary} disabled={!changed.length || !!invalid.length} onClick={applyBulk}>Apply to {changed.length} {changed.length===1 ? "part" : "parts"}</button> : <button className={styles.primary} disabled={!targets.length || (bulkStep===2 && (!changed.length || (field!==0 && operation!=="clear" && !value.trim())))} onClick={()=>goToStep(bulkStep+1)}>{bulkStep===2 ? "Preview changes" : "Continue"}</button>}</>}
      {tool.kind === "row" && rowMode === "delete" && <button className={styles.sheetDelete} onClick={() => {onApply(rows.filter((_, i) => i !== tool.index), true);onClose();}}>Delete row from sheet</button>}

    </footer>
  </dialog>, document.body);
}
