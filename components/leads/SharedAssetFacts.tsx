'use client';
import {useState,useEffect,useCallback, type ReactNode} from 'react';
import {createPortal} from '../WebsitePortal';
import DealerAssetCorrectionEditor from '../DealerAssetCorrectionEditor';
import SharedAssetWorkDialog from './SharedAssetWorkDialog';
import SharedAssetLocationDialog from './SharedAssetLocationDialog';
import type {DealerAssetCorrectionRequest} from '../../lib/dealer-asset-corrections';
import type {ExternalAssetShareItem} from '../../lib/asset-external-share';
import styles from '../../app/asset-register/page.module.css';
export type FactField = 'serial'|'year'|'usage'|'condition'|'replacement'|'finance'|'insurance'|'license'|'location';
export type FactPermissions = Partial<Record<FactField, boolean>>;
export default function SharedAssetFacts({assetTitle,serial,year,usage,condition,replacementPrice,statuses,permissions={},endpoint,sourceId,externalShare,directUpdates=false,correction,onSaved}: {
 assetTitle:string;serial:string;year:ReactNode;usage:ReactNode;condition:ReactNode;replacementPrice:number|null;
 statuses:{finance:ReactNode;insurance:ReactNode;license:ReactNode;location:ReactNode};permissions?:FactPermissions;
 endpoint:string;sourceId:string;externalShare?:{token:string;assetId:string};directUpdates?:boolean;correction?:DealerAssetCorrectionRequest|null;onSaved?:()=>void;
}) {
 const [live,setLive]=useState<ExternalAssetShareItem|null>(null);
 const [readError,setReadError]=useState('');
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  if(!endpoint.startsWith('/api/asset-leads/'))return;
  try {const response=await fetch(`${endpoint}/facts`,{cache:'no-store',signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not refresh asset details.');setLive(data.asset);setReadError('');}
  catch(error){if(!signal?.aborted)setReadError(error instanceof Error?error.message:'Could not refresh asset details.');}
 },[endpoint]);
 useEffect(()=>{const controller=new AbortController();setLive(null);void refresh(controller.signal);return()=>controller.abort();},[refresh]);
 const saved=()=>{void refresh();onSaved?.();};
 if(live){serial=live.serialNumber||'';year=live.yearModel;usage=live.usage;condition=live.condition;replacementPrice=live.replacementPriceExVat??null;statuses={finance:factStatusMark(live.financeStatus),insurance:factStatusMark(live.insuranceStatus),license:factStatusMark(live.licenseStatus),location:factStatusMark(live.mapped?'yes':'no')};}
 const [field,setField]=useState<FactField|null>(null);
 const close=()=>setField(null);
 function row(key:FactField,label:string,value:ReactNode,status=false){
  const classes=status?styles.assetStatusRow:styles.assetDetailRow;
  const contents=<><span>{label}</span>{status?value:<strong>{value}</strong>}</>;
  return permissions[key] ? <button key={key} type="button" className={`${classes} ${status?styles.assetStatusRowButton:styles.assetDetailRowButton}`} aria-label={`Edit ${label.toLowerCase()} for ${assetTitle}`} onClick={()=>setField(key)}>{contents}</button> : <div key={key} className={classes}>{contents}</div>;
 }
 const price=<><span>Replacement Price</span><strong>{replacementPrice==null?'Not saved':new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(replacementPrice)}</strong><small>Excl. VAT</small></>;
 return <>
  {readError&&<p role="alert">{readError}</p>}
  <div className={styles.assetDetailsGrid}>
   <div className={styles.assetPrimaryDetails}>{row('serial','Serial',serial||'Not saved')}{row('year','Year',year||'Not saved')}{row('usage','Usage',usage||'Not saved')}{row('condition','Condition',condition||'Not saved')}</div>
   <div className={styles.assetStatusDetails}>{row('finance','Financed',statuses.finance,true)}{row('insurance','Insured',statuses.insurance,true)}{row('license','Licensed',statuses.license,true)}{row('location','Mapped',statuses.location,true)}</div>
  </div>
  {permissions.replacement?<button type="button" className={`${styles.assetReplacementPriceBubble} ${styles.assetReplacementPriceButton}`} aria-label={`Edit replacement price for ${assetTitle}`} onClick={()=>setField('replacement')}>{price}</button>:<div className={styles.assetReplacementPriceBubble}>{price}</div>}
  {field && permissions[field] && (field==='serial'||field==='replacement' ? <DealerAssetCorrectionEditor key={field} initialField={field==='serial'?'serialNumber':'replacementPriceExVat'} onClose={close} assetTitle={assetTitle} sourceType={externalShare?'external':'lead'} sourceId={sourceId} serialNumber={serial} replacementPriceExVat={replacementPrice} externalShare={externalShare} directUpdates={directUpdates} correction={correction} canUpdateSerial={permissions.serial} canUpdateReplacementPrice={permissions.replacement} onSaved={()=>{saved();close();}}/> : createPortal(field==='location'?<SharedAssetLocationDialog endpoint={endpoint} assetTitle={assetTitle} onClose={close} onSaved={saved}/>:<SharedAssetWorkDialog endpoint={endpoint} action="details" initialField={field} assetTitle={assetTitle} onClose={close} onSaved={saved}/>,document.body))}
 </>;
}

export function factStatusMark(value?:string) {
 const status=String(value||'').toLowerCase();
 const yes=['yes','true','financed','insured','licensed','licenced'].includes(status),no=['no','false','paid','not_financed','not_insured','not_licensed'].includes(status),na=status==='not_applicable';
 return <strong className={`${styles.assetStatusMark} ${yes?styles.statusMarkYes:no?styles.statusMarkNo:na?styles.statusMarkNotApplicable:styles.statusMarkUnknown}`} aria-label={yes?'Yes':no?'No':na?'Not applicable':'Not saved'}>{yes?'✓':no?'×':na?'—':'?'}</strong>;
}
