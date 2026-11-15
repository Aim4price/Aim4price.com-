"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ShareModalCloseButton from "./asset-register/ShareModalCloseButton";
import { PART_DETAIL_PRESETS, validatePartFields, type PartDetailField } from "../lib/parts-network-csv";
import styles from "../app/dealer/parts/parts.module.css";

function DetailIcon({kind}:{kind:string}) {
  const paths: Record<string,string> = {
    alternative:"M4 7h14l-3-3m3 13H4l3 3M18 7l-3 3M4 17l3-3",
    compatibility:"M9 7H6a4 4 0 0 0 0 8h3m6-8h3a4 4 0 0 1 0 8h-3M7 11h10",
    condition:"m4 12 5 5L20 6",
    type:"M3 5h8l10 10-7 7L3 11V5Zm4 3h.01",
    notes:"M6 3h12v18H6V3Zm3 5h6m-6 4h6m-6 4h4",
    location:"M4 4h16v16H4V4Zm0 8h16M12 4v16",
    custom:"M12 4v16M4 12h16",
  };
  return <span className={styles.detailIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind] || paths.custom}/></svg></span>;
}

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
  const examples: Record<string,string> = {alternative:"Cross-reference or replacement code",compatibility:"Tractor, engine or implement models",condition:"New, used or reconditioned",type:"Genuine, aftermarket or replacement",notes:"Specifications or helpful part information",location:"Find the part in your store · Private by default"};

  const available = PART_DETAIL_PRESETS.filter(f=>!fields.some(old=>old.id===f.id || old.label.toLowerCase()===f.label.toLowerCase()));
  useEffect(()=>{const opener=document.activeElement as HTMLElement;dialog.current?.showModal();return()=>{dialog.current?.close();opener?.focus();};},[]);
  return createPortal(<dialog ref={dialog} className={`${styles.modal} ${styles.sheetToolDialog} ${styles.detailPicker}`} aria-label={column ? "Add column" : "Add detail"} onCancel={e=>{e.preventDefault();onClose();}}>
    <header className={styles.sheetToolHeader}><div><h2>{column ? "Add column" : "Add detail"}</h2><p>Optional information for this stocklist</p></div><ShareModalCloseButton aria-label="Close add detail" onClick={onClose}/></header>
    <div className={styles.sheetToolBody}>
      {!choice ? <div className={styles.detailPickerChoices}>{[...available,{id:"custom",label:"Custom field",private:false}].map(f=><button type="button" key={f.id} data-detail={f.id} onClick={()=>{setChoice(f.id);setPrivate(f.private);setError("");}}><DetailIcon kind={f.id}/><span><strong>{f.label}</strong><small>{f.id==="custom" ? "Give your own detail a name, such as dimensions or thread size" : examples[f.id]}</small></span><span className={styles.detailArrow} aria-hidden="true">›</span></button>)}</div> : <div className={styles.detailSelection}><DetailIcon kind={choice}/><div><strong>{choice === "custom" ? "Custom field" : PART_DETAIL_PRESETS.find(f=>f.id===choice)?.label}</strong><p>{choice === "custom" ? "Choose a name that is clear to your team." : examples[choice]}</p></div><button type="button" onClick={()=>{setChoice("");setError("");}}>Change</button></div>}
      {choice && <div className={styles.detailFieldSettings}>{choice==="custom" && <label>Field name<input aria-label="Custom field name" maxLength={60} value={name} placeholder="e.g. Dimensions" onChange={e=>setName(e.target.value)}/></label>}<label className={styles.sheetCheck}><input type="checkbox" checked={privateField} onChange={e=>setPrivate(e.target.checked)}/>Private to my dealership</label><p>{privateField ? "Shared dealers cannot see this field or its values. It is included in your own downloads." : "Dealers with access can see this field and include it in their downloads."} The field is available to all parts on this stocklist; values can be left blank.</p></div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    <footer className={styles.sheetToolFooter}><button type="button" onClick={onClose}>Cancel</button><button type="button" className={styles.primary} disabled={!choice || (choice==="custom" && !name.trim())} onClick={()=>{try {const f={id:choice==="custom" ? `custom-${crypto.randomUUID()}` : choice,label:choice==="custom" ? name.trim() : PART_DETAIL_PRESETS.find(f=>f.id===choice)!.label,private:privateField};validatePartFields([...fields,f]);onAdd(f);}catch(e){setError((e as Error).message);}}}>Add {column ? "column" : "detail"}</button></footer>
  </dialog>,document.body);
}
export function PartDetailInputs({fields,values,onChange}:{fields:PartDetailField[];values:Record<string,string>;onChange:(values:Record<string,string>)=>void}) {
  return <>{fields.map(f=><label key={f.id}>{f.label}{f.private && <small>Private</small>}<input aria-label={f.label} placeholder="Optional" maxLength={500} value={values[f.id] || ""} onChange={e=>onChange({...values,[f.id]:e.target.value})}/></label>)}</>;
}
