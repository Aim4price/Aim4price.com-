"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ShareModalCloseButton from "./asset-register/ShareModalCloseButton";
import { AddPartField, PartDetailInputs } from "./PartsDetailFields";
import type { PartDetailField } from "../lib/parts-network-csv";
import VatPriceInput from "./VatPriceInput";
import priceStyles from "./asset-register/AssetDisposal.module.css";
import styles from "../app/dealer/parts/parts.module.css";

export type PartEditValue = {partNumber:string;brand:string;description:string;quantity:string;price:string;priceIncluded:boolean;extraFields:PartDetailField[];details:Record<string,string>};
export default function PartEditDialog<T extends PartEditValue>({value,onChange,onSave,onClose,onBack,subtitle,busy=false,feedback,backLabel="Cancel",submitLabel="Save changes"}:{
 value:T;onChange:(value:T)=>void;onSave:()=>void;onClose:()=>void;onBack:()=>void;subtitle?:string;busy?:boolean;feedback?:ReactNode;backLabel?:string;submitLabel?:string;
}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const id=useId();
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null; const node=dialog.current;node?.showModal();return()=>{node?.close();if(opener?.isConnected)opener.focus();};},[]);
 return createPortal(<dialog ref={dialog} className={`${styles.modal} ${styles.sheetToolDialog} ${styles.partEditorModal} ${styles.sharedPartEditor}`} role="dialog" aria-modal="true" aria-label="Edit part" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
   <div className={styles.closeWrap}><ShareModalCloseButton onClick={onClose} disabled={busy}/></div>
   <header className={styles.dialogHeader}><h2>Edit part</h2>{subtitle && <p>{subtitle}</p>}<div className={styles.partsProgress} role="progressbar" aria-label="Parts workflow" aria-valuemin={0} aria-valuemax={100} aria-valuenow={80} aria-valuetext="Edit selected part"><span style={{width:"80%"}}/></div></header>
   <form className={styles.partEditorForm} onSubmit={e=>{e.preventDefault();onSave();}}>
            <div className={styles.partEditorBody}>
            <div className={styles.partEditFields}>
              <label>Part number<input required maxLength={100} aria-label="Part number" value={value.partNumber} onChange={e=>onChange({...value,partNumber:e.target.value})}/></label>
              <label>Brand<input placeholder="Optional" maxLength={100} aria-label="Brand" value={value.brand} onChange={e=>onChange({...value,brand:e.target.value})}/></label>
              <label className={styles.partEditDescription}>Description<input placeholder="Optional" maxLength={500} aria-label="Description" value={value.description} onChange={e=>onChange({...value,description:e.target.value})}/></label>
              <label>Quantity<input placeholder="Optional" type="number" min="0" max="999999999" step="1" aria-label="Quantity" value={value.quantity} onChange={e=>onChange({...value,quantity:e.target.value})} aria-describedby={`${id}-quantity-hint`}/><small id={`${id}-quantity-hint`}>Leave blank to keep the current quantity.</small></label>
              <div className={styles.partEditPrice}>
                <label htmlFor={`${id}-price`}>Unit price <small>{value.priceIncluded ? "Incl." : "Excl."} VAT</small></label>
                <div className={`${priceStyles.amountControl} ${styles.partEditPriceControl}`}>
                  <VatPriceInput id={`${id}-price`} valueExVat={value.price} included={value.priceIncluded} vatRate={0.15} onValueChange={price=>onChange({...value,price})} placeholder="Optional" aria-label={`Unit price, ${value.priceIncluded ? "including" : "excluding"} VAT`} />
                  <div className={priceStyles.amountVatToggle} role="group" aria-label="Unit price VAT basis">
                    <button type="button" aria-label="Including VAT" aria-pressed={value.priceIncluded} onClick={()=>onChange({...value,priceIncluded:true})}>Incl</button>
                    <button type="button" aria-label="Excluding VAT" aria-pressed={!value.priceIncluded} onClick={()=>onChange({...value,priceIncluded:false})}>Excl</button>
                  </div>
                </div>
                <small>Leave blank for price on request.</small>
              </div>
            </div>
            {value.extraFields.length > 0 && <div className={styles.partEditFields}><PartDetailInputs fields={value.extraFields} values={value.details} onChange={details=>onChange({...value,details})}/></div>}
            {feedback}
            </div>
            <footer className={`${styles.actions} ${styles.partEditFooter}`}><div className={styles.detailFooterAction}><AddPartField fields={value.extraFields} onAdd={field=>onChange({...value,extraFields:[...value.extraFields,field]})}/></div><button type="button" disabled={busy} onClick={onBack}>{backLabel}</button><button className={styles.primary} disabled={busy} type="submit">{busy ? "Saving…" : submitLabel}</button></footer>
   </form>
 </dialog>,document.body);
}
