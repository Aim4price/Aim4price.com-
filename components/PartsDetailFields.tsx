"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ShareModalCloseButton from "./asset-register/ShareModalCloseButton";
import { PART_DETAIL_PRESETS, validatePartFields, type PartDetailField } from "../lib/parts-network-csv";
import styles from "../app/dealer/parts/parts.module.css";

export function AddPartField({ fields, onAdd, column = false }: { fields: PartDetailField[]; onAdd: (field:PartDetailField)=>void; column?:boolean }) {
  const [open,setOpen] = useState(false);
  return <><button type="button" disabled={fields.length >= 12} onClick={()=>setOpen(true)}>+ Add {column ? "column" : "detail"}</button>{open && <FieldPicker fields={fields} onClose={()=>setOpen(false)} onAdd={f=>{onAdd(f);setOpen(false);}} column={column}/>}</>;
}
function FieldPicker({fields,onAdd,onClose,column}:{fields:PartDetailField[];onAdd:(field:PartDetailField)=>void;onClose:()=>void;column:boolean}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [choice,setChoice] = useState("");
  const [name,setName] = useState("");
  const [privateField,setPrivate] = useState(false);
  const [error,setError] = useState("");
  const available = PART_DETAIL_PRESETS.filter(f=>!fields.some(old=>old.id===f.id || old.label.toLowerCase()===f.label.toLowerCase()));
  useEffect(()=>{const opener=document.activeElement as HTMLElement;dialog.current?.showModal();return()=>{dialog.current?.close();opener?.focus();};},[]);
  return createPortal(<dialog ref={dialog} className={`${styles.modal} ${styles.sheetToolDialog}`} aria-label={column ? "Add column" : "Add detail"} onCancel={e=>{e.preventDefault();onClose();}}>
    <header className={styles.sheetToolHeader}><div><h2>{column ? "Add column" : "Add detail"}</h2><p>Optional information for this stocklist</p></div><ShareModalCloseButton aria-label="Close add detail" onClick={onClose}/></header>
    <div className={styles.sheetToolBody}>
      <div className={styles.detailFieldChoices}>{[...available,{id:"custom",label:"Custom field",private:false}].map(f=><button type="button" key={f.id} aria-pressed={choice===f.id} onClick={()=>{setChoice(f.id);setPrivate(f.private);setError("");}}><strong>{f.label}</strong><span>{f.id==="custom" ? "Choose your own field name" : f.private ? "Private by default" : "Visible to dealers with access"}</span></button>)}</div>
      {choice && <div className={styles.detailFieldSettings}>{choice==="custom" && <label>Field name<input aria-label="Custom field name" maxLength={60} value={name} placeholder="e.g. Dimensions" onChange={e=>setName(e.target.value)}/></label>}<label className={styles.sheetCheck}><input type="checkbox" checked={privateField} onChange={e=>setPrivate(e.target.checked)}/>Private to my dealership</label><p>{privateField ? "Shared dealers cannot see this field or its values. It is included in your own downloads." : "Dealers with access can see this field and include it in their downloads."} The field is available to all parts on this stocklist; values can be left blank.</p></div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    <footer className={styles.sheetToolFooter}><button type="button" onClick={onClose}>Cancel</button><button type="button" className={styles.primary} disabled={!choice || (choice==="custom" && !name.trim())} onClick={()=>{try {const f={id:choice==="custom" ? `custom-${crypto.randomUUID()}` : choice,label:choice==="custom" ? name.trim() : PART_DETAIL_PRESETS.find(f=>f.id===choice)!.label,private:privateField};validatePartFields([...fields,f]);onAdd(f);}catch(e){setError((e as Error).message);}}}>Add {column ? "column" : "detail"}</button></footer>
  </dialog>,document.body);
}
export function PartDetailInputs({fields,values,onChange}:{fields:PartDetailField[];values:Record<string,string>;onChange:(values:Record<string,string>)=>void}) {
  return <>{fields.map(f=><label key={f.id}>{f.label}{f.private && <small>Private</small>}<input aria-label={f.label} placeholder="Optional" maxLength={500} value={values[f.id] || ""} onChange={e=>onChange({...values,[f.id]:e.target.value})}/></label>)}</>;
}
