"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ShareModalCloseButton from "./asset-register/ShareModalCloseButton";
import { PART_DETAIL_PRESETS, validatePartFields, type PartDetailField } from "../lib/parts-network-csv";
import styles from "../app/dealer/parts/parts.module.css";

export function DetailIcon({kind}:{kind:string}) {
  const paths: Record<string,string> = {
    description:"M4 6h16M4 12h16M4 18h10",
    quantity:"M8 3 6 21M18 3l-2 18M3 8h18M2 16h18",
    brand:"M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
    price:"M4 5h16v14H4V5Zm8 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM7 12h.01M17 12h.01",
    partNumber:"M4 4v16M8 4v16M12 4v16M17 4v16M20 4v16",
    alternative:"M4 7h14l-3-3m3 13H4l3 3M18 7l-3 3M4 17l3-3",
    compatibility:"M9 7H6a4 4 0 0 0 0 8h3m6-8h3a4 4 0 0 1 0 8h-3M7 11h10",
    condition:"m4 12 5 5L20 6",
    type:"M3 5h8l10 10-7 7L3 11V5Zm4 3h.01",
    notes:"M6 3h12v18H6V3Zm3 5h6m-6 4h6m-6 4h4",
    location:"M4 4h16v16H4V4Zm0 8h16M12 4v16",
    edit:"m16 3 5 5-12 12-6 1 1-6L16 3Zm-1 1 5 5",
    delete:"M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    custom:"M12 4v16M4 12h16",
    restore:"M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2",
  };
  return <span className={styles.detailIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind] || paths.custom}/></svg></span>;
}

export function PartInput({children,label,required=false,onRemove}:{children:ReactNode;label:string;required?:boolean;onRemove?:()=>void}) {
  return <span className={styles.partInputBar}>{children}<button type="button" className={styles.detailTrash} disabled={required} aria-label={required ? `${label} is required` : `Remove ${label} from this part`} title={required ? "Required field" : "Remove from this part"} onClick={onRemove}><DetailIcon kind="delete"/></button></span>;
}

export function AddPartField({ fields, onAdd, column = false, restorableFields = [], restoreInputs = [], onRestoreInput }: { restoreInputs?:{id:string;label:string}[];onRestoreInput?:(id:string)=>void; restorableFields?:PartDetailField[]; fields: PartDetailField[]; onAdd: (field:PartDetailField)=>void; column?:boolean }) {
  const [open,setOpen] = useState(false);
  return <><button type="button" disabled={fields.length >= 12 && !restoreInputs.length && !restorableFields.length} onClick={()=>setOpen(true)}>+ {column ? "Add column" : "Add detail"}</button>{open && <FieldPicker restoreInputs={restoreInputs} onRestoreInput={id=>{onRestoreInput?.(id);setOpen(false);}} restorableFields={restorableFields} fields={fields} onClose={()=>setOpen(false)} onAdd={f=>{onAdd(f);setOpen(false);}} column={column}/>}</>;
}
function FieldPicker({fields,onAdd,onClose,column,restorableFields,restoreInputs,onRestoreInput}:{restoreInputs:{id:string;label:string}[];onRestoreInput:(id:string)=>void;restorableFields:PartDetailField[];fields:PartDetailField[];onAdd:(field:PartDetailField)=>void;onClose:()=>void;column:boolean}) {
  const dialog = useRef<HTMLDialogElement>(null);

  const [choice,setChoice] = useState("");
  const [name,setName] = useState("");
  const [privateField,setPrivate] = useState(false);
  const [error,setError] = useState("");
  const examples: Record<string,string> = {alternative:"Cross-reference code",compatibility:"Compatible asset models",condition:"New, used or reconditioned",type:"Genuine or aftermarket",notes:"Useful part information",location:"Storage location · Private"};

  const candidates = [...PART_DETAIL_PRESETS.map(p=>restorableFields.find(f=>f.id===p.id) || p),...restorableFields.filter(f=>!PART_DETAIL_PRESETS.some(p=>p.id===f.id))];
  const alreadyAdded = (f:PartDetailField) => fields.some(old=>old.id===f.id || old.label.toLowerCase()===f.label.toLowerCase());
  const restoreCustomFields = restorableFields.filter(f=>!PART_DETAIL_PRESETS.some(p=>p.id===f.id));
  useEffect(()=>{const opener=document.activeElement as HTMLElement;dialog.current?.showModal();return()=>{dialog.current?.close();opener?.focus();};},[]);
  return createPortal(<dialog ref={dialog} className={`${styles.modal} ${styles.sheetToolDialog} ${styles.detailPicker} ${styles.marketplaceChoiceModal} ${styles.columnPicker}`} aria-label={column ? "Add column" : "Add detail"} onCancel={e=>{e.preventDefault();onClose();}}>
    <header className={styles.sheetToolHeader}><div><h2>{column ? "Add column" : "Add detail"}</h2><p>Optional information for this stocklist</p></div><ShareModalCloseButton aria-label="Close add detail" onClick={onClose}/></header>
    <div className={styles.sheetToolBody}>
      {!choice ? <>
        <div className={styles.detailPickerChoices}>{[...PART_DETAIL_PRESETS.map(p=>restorableFields.find(f=>f.id===p.id) || p),{id:"custom",label:"Custom field",private:false}].map(f=><button type="button" key={f.id} data-detail={f.id} disabled={f.id!=="custom" && alreadyAdded(f)} title={f.id!=="custom" && alreadyAdded(f) ? "Already added" : undefined} onClick={()=>{setChoice(f.id);setPrivate(f.private);setError("");}}><DetailIcon kind={f.id}/><span><strong>{f.label}</strong><small>{f.id==="custom" ? "Choose your own field name" : examples[f.id]}</small></span></button>)}</div>
        {(restoreInputs.length>0 || restoreCustomFields.length>0) && <section className={styles.detailRestoreInputs} aria-label="Restore removed fields"><h3>Restore removed fields</h3><div className={styles.detailPickerChoices}>{restoreInputs.map(f=><button type="button" key={f.id} aria-label={`Restore ${f.label}`} onClick={()=>onRestoreInput(f.id)}><DetailIcon kind="restore"/><span><strong>{f.label}</strong><small>Restore this field</small></span></button>)}{restoreCustomFields.map(f=><button type="button" key={f.id} aria-label={`Restore ${f.label}`} onClick={()=>{setChoice(f.id);setPrivate(f.private);setError("");}}><DetailIcon kind="restore"/><span><strong>{f.label}</strong><small>Restore custom field</small></span></button>)}</div></section>}

      </> : <div className={styles.detailSelection}><DetailIcon kind={choice}/><div><strong>{choice === "custom" ? "Custom field" : candidates.find(f=>f.id===choice)?.label}</strong><p>{choice === "custom" ? "Choose a name that is clear to your team." : examples[choice]}</p></div><button type="button" onClick={()=>{setChoice("");setError("");}}>Change</button></div>}
      {choice && <div className={styles.detailFieldSettings}>{choice==="custom" && <label>Field name<input aria-label="Custom field name" maxLength={60} value={name} placeholder="e.g. Dimensions" onChange={e=>setName(e.target.value)}/></label>}<label className={styles.sheetCheck}><input type="checkbox" disabled={restorableFields.some(f=>f.id===choice)} checked={privateField} onChange={e=>setPrivate(e.target.checked)}/>Private to my dealership</label><p>{privateField ? "Shared dealers cannot see this field or its values. It is included in your own downloads." : "Dealers with access can see this field and include it in their downloads."} The field is available to all parts on this stocklist; values can be left blank.</p></div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    <footer className={styles.sheetToolFooter}><button type="button" onClick={onClose}>Cancel</button><button type="button" className={styles.primary} disabled={!choice || (choice==="custom" && !name.trim())} onClick={()=>{try {const f=restorableFields.find(f=>f.id===choice) || {id:choice==="custom" ? `custom-${crypto.randomUUID()}` : choice,label:choice==="custom" ? name.trim() : candidates.find(f=>f.id===choice)!.label,private:privateField};validatePartFields([...fields,f]);onAdd(f);}catch(e){setError((e as Error).message);}}}>{column ? "Next" : "Add detail"}</button></footer>
  </dialog>,document.body);
}
export function PartDetailInputs({fields,values,onChange,onRemove}:{fields:PartDetailField[];values:Record<string,string>;onChange:(values:Record<string,string>)=>void;onRemove?:(id:string)=>void}) {
  return <>{fields.map(f=><label key={f.id}>{f.label}{f.private && <small>Private</small>}<PartInput label={f.label} onRemove={()=>onRemove?.(f.id)} required={!onRemove}><input aria-label={f.label} placeholder="Optional" maxLength={500} value={values[f.id] || ""} onChange={e=>onChange({...values,[f.id]:e.target.value})}/></PartInput></label>)}</>;
}
