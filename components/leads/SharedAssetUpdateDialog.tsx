'use client';
import SharedAssetExport from './SharedAssetExport';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLeadDialog} from './useLeadDialog';
import AssetDetailsFields from '../AssetDetailsFields';
import AssetActionIcon from '../asset-register/AssetActionIcon';
import SharedAssetValueDialog from './SharedAssetValueDialog';
import SharedAssetVatField from './SharedAssetVatField';
import SharedAssetPaperwork from './SharedAssetPaperwork';
import AssetDocumentUploadModal from '../documents/AssetDocumentUploadModal';
import styles from '../../app/asset-register/page.module.css';
import account from '../../app/account/page.module.css';
import refinements from '../../app/asset-register/asset-update-refinements.module.css';
import colours from './ManageActionGrid.module.css';
import local from './SharedAssetUpdateDialog.module.css';

export type SharedUpdateField='current'|'year'|'usage'|'condition'|'finance'|'insurance'|'license'|'serial'|'replacement'|'documents';
type Asset={id:string;title:string;kind:string;categoryLabel?:string;brand?:string;model?:string;serialNumber?:string;note?:string;yearModel:number|null;usageReading:number|null;usageMetric:string;condition:string;replacementPriceExVat?:number|null;currentValue?:number|null;insuredValue?:number|null;photos?:string[]};
type Draft={title:string;brand:string;model:string;note:string;year:string;usage:string;condition:string};
type Document={id:string;title:string;fileName:string};
function draftFor(a:Asset):Draft{return {title:a.title,brand:a.brand||'',model:a.model||'',note:a.note||'',year:String(a.yearModel??''),usage:String(a.usageReading??''),condition:a.condition||''};}
export default function SharedAssetUpdateDialog({endpoint,assetTitle,onClose,onSaved,initialField}:{endpoint:string;assetTitle:string;onClose:()=>void;onSaved?:()=>void;initialField?:SharedUpdateField}) {
 const router=useRouter();
 const [valueField,setValueField]=useState<'current'|'replacement'|null>(initialField==='current'||initialField==='replacement'?initialField:null);
 const [valueRefresh,setValueRefresh]=useState(0);
 const [paperDirty,setPaperDirty]=useState(false);
 const [paperFocus,setPaperFocus]=useState<'finance'|'insurance'|'license'|undefined>(initialField==='finance'||initialField==='insurance'||initialField==='license'?initialField:undefined);
 const [section,setSection]=useState<'menu'|'details'|'paperwork'|'documents'>(initialField?['finance','insurance','license'].includes(initialField)?'paperwork':initialField==='documents'?'documents':'details':'menu');
 const [asset,setAsset]=useState<Asset|null>(null),[draft,setDraft]=useState<Draft|null>(null),[permissions,setPermissions]=useState<Record<string,boolean>>({});
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[upload,setUpload]=useState(false),[documents,setDocuments]=useState<Document[]>([]);
 const [serial,setSerial]=useState(''),[replacement,setReplacement]=useState(''),[correctionNotice,setCorrectionNotice]=useState('');
 const baseline=useRef<Draft|null>(null),requestId=useRef(crypto.randomUUID()),saving=useRef(false),photoInput=useRef<HTMLInputElement>(null);
 const close=()=>{if(!saving.current&&!changed&&!paperDirty){if(section==='menu')onClose();else setSection('menu');}};
 const dialog=useLeadDialog(close,busy||paperDirty);
 const saved=()=>{router.refresh();onSaved?.();};
 useEffect(()=>{const controller=new AbortController();fetch(endpoint+'/details',{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load this asset.');setAsset(d.asset);if(!d.asset||!d.permissions)throw Error('Could not load asset details.');setPermissions(d.permissions);const next=draftFor(d.asset);baseline.current=next;setDraft(next);setSerial(d.asset.serialNumber||'');setReplacement(String(d.asset.replacementPriceExVat??''));setStatus('Saved automatically');}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[endpoint,valueRefresh]);
 useEffect(()=>{if(!asset||!initialField||section!=='details')return;const target=(dialog.current?.querySelector<HTMLElement>(`[data-asset-detail-edit-target="${initialField}"] input`) || dialog.current?.querySelector<HTMLElement>(`[data-asset-detail-edit-target="${initialField}"] button`));target?.focus();target?.scrollIntoView({block:'nearest'});},[asset,initialField,section,dialog]);
 async function loadDocuments(){const r=await fetch(endpoint+'/documents',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setDocuments(d.documents);}
 useEffect(()=>{if(section==='documents'&&permissions.addDocuments)void loadDocuments().catch(e=>setError(e.message));},[section,permissions.addDocuments,endpoint]);
 // Only the granted details are autosaved. Serial and price retain their existing approval flow.
 async function saveDetails(next:Draft) {
  if(!baseline.current||saving.current)return;
  const patch:Record<string,unknown>={};
  for(const key of ['title','brand','model','note','year','usage','condition'] as const){
   const permission=key==='year'?'yearModel':key;
   if(permissions[permission]&&next[key]!==baseline.current[key])patch[permission]=key==='year'?(next.year?Number(next.year):null):key==='usage'?Number(next.usage):next[key];
  }
  if(!Object.keys(patch).length)return;
  saving.current=true;setBusy(true);setError('');setStatus('Saving…');
  try{const r=await fetch(endpoint+'/details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patch,requestId:requestId.current})}),data=await r.json();if(!r.ok)throw Error(data.error||'Could not save.');baseline.current=next;requestId.current=crypto.randomUUID();setAsset(a=>a?{...a,title:next.title}:a);setStatus('Saved automatically');saved();}
  catch(e){setError(e instanceof Error?e.message:'Could not save.');setStatus('Changes not saved');}
  finally{saving.current=false;setBusy(false);}
 }
 useEffect(()=>{if(!draft||!baseline.current||JSON.stringify(draft)===JSON.stringify(baseline.current))return;setStatus('Unsaved changes');const timer=setTimeout(()=>void saveDetails(draft),750);return()=>clearTimeout(timer);},[draft]);
 const changed=!!draft&&!!baseline.current&&JSON.stringify(draft)!==JSON.stringify(baseline.current);
 function update(key:keyof Draft,value:string){setDraft(d=>d?{...d,[key]:value}:d);}
 async function saveCorrection(field:'serialNumber') {
  if(saving.current)return;saving.current=true;setBusy(true);setError('');setCorrectionNotice('');
  const link=endpoint.match(/^\/api\/asset-share-links\/([^/]+)\/assets\/([^/]+)$/),lead=endpoint.match(/^\/api\/asset-leads\/([^/]+)$/);
  try {
   if(!link&&!lead)throw Error('This asset action is unavailable.');
   const r=await fetch(link?`/api/asset-share-links/${link[1]}/corrections`:'/api/dealer/asset-corrections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceType:link?'external':'lead',sourceId:link?`${link[1]}:${link[2]}`:lead![1],...(link?{assetId:link[2]}:{}),field,value:serial})}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Could not save this change.');
   setCorrectionNotice(d.correction?.status==='pending'?'Sent to the owner for approval.':'Saved to the owner’s asset.');if(d.correction?.status!=='pending'&&field==='serialNumber')setAsset(a=>a?{...a,serialNumber:serial}:a);saved();
  }catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{saving.current=false;setBusy(false);}
 }
 async function addPhotos(files:FileList|null){if(!files?.length||saving.current)return;saving.current=true;setBusy(true);setError('');
  try{const body=new FormData();body.set('requestId',crypto.randomUUID());Array.from(files).forEach(f=>body.append('files',f));const r=await fetch(endpoint+'/photos',{method:'POST',body}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not upload photos.');const fresh=await fetch(endpoint+'/details',{cache:'no-store'}),data=await fresh.json();if(fresh.ok)setAsset(data.asset);setStatus('Photos saved');saved();}
  catch(e){setError(e instanceof Error?e.message:'Could not upload photos.');}finally{saving.current=false;setBusy(false);if(photoInput.current)photoInput.current.value='';}
 }
 if(valueField)return <SharedAssetValueDialog endpoint={endpoint} assetTitle={assetTitle} field={valueField} onClose={()=>{if(initialField===valueField)onClose();else {setValueField(null);setValueRefresh(v=>v+1);}}} onSaved={saved}/>;
 const title=draft?.title.trim()||assetTitle;
 const shell=`${styles.modalCard} ${styles.assetFormModal} ${styles.managementAccountModal} ${account.modalTheme} ${styles.assetUpdateModal} ${section==='menu'?styles.assetUpdateMenuModal:''} ${local.shell}`;
 const canDetails=Object.values(permissions).some(Boolean);
 const cards=[{key:'details',label:'Details',copy:'Edit asset details and usage.',icon:'details',allowed:canDetails},{key:'paperwork',label:'Paperwork',copy:'Manage asset paperwork.',icon:'documents',allowed:permissions.updateDetails},{key:'documents',label:'Documents',copy:'Manage documents and photos.',icon:'addPhotos',allowed:permissions.addDocuments||permissions.addPhotos}] as const;
 return <div className={styles.modalOverlay} data-website-overlay data-account-asset-modal>
  <div className={styles.modalBackdrop} data-website-overlay onClick={()=>{if(!changed)close();}}/>
  <section ref={dialog} tabIndex={-1} className={shell} role="dialog" aria-modal="true" aria-label={section==='menu'?'Update asset':title}>
   <div className={`${styles.modalHeader} ${styles.assetFormModalHeader} ${styles.manualWizardHeader} ${styles.assetFormModalChromeHeader}`}>
    <div className={styles.modalHeaderText}><h3>{section==='menu'?'Update asset':title}</h3><p>{section==='menu'?title:section==='details'?'Details':section==='paperwork'?'Paperwork':'Documents'}</p></div>
    <button type="button" className={`${account.modalCloseButton} ${account.passwordModalCloseButton}`} aria-label="Close action form" onClick={close} disabled={busy||changed||paperDirty}>×</button>
   </div>
   <div className={`${styles.modalScrollBody} ${section==='menu'?styles.assetUpdateMenuBody:styles.manualStepScrollBody} ${local.body}`}>
    {error&&<p role="alert" className={local.error}>{error}</p>}
    {!asset||!draft?<p>Loading asset…</p>:section==='menu'?<div className={`${styles.optionsGrid} ${styles.assetOptionsGrid} ${styles.ownerCommandGrid} ${colours.grid} ${local.menu}`} data-manage-actions>{cards.filter(c=>c.allowed).map(c=><button key={c.key} type="button" data-manage-action={c.icon} className={`${styles.optionActionButton} ${styles.ownerCommandAction}`} onClick={()=>setSection(c.key)}>{c.key==='paperwork'?<svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></svg>:<AssetActionIcon action={c.key==='documents'?'documents':'details'} className={styles.buttonIcon}/>}<span><strong>{c.label}</strong><small>{c.copy}</small></span></button>)}</div>:section==='paperwork'?<SharedAssetPaperwork endpoint={endpoint} initialSection={paperFocus} onDirtyChange={setPaperDirty} onUpload={permissions.addDocuments?()=>setUpload(true):undefined} onSaved={saved}/>:section==='documents'?<>
     <p className={local.notice}><strong>Asset documents only — no invoices.</strong> Use Add cost for invoices and expenses.</p>
     <div className={`${styles.manualStageGrid} ${styles.manualUploadGrid}`}>
      {permissions.addDocuments&&<div className={styles.field}><span>Other documents</span><div className={`${styles.documentUploadPanel} ${local.uploadPanel}`}><div className={styles.uploadRow}><button className={`${styles.secondaryButton} ${styles.filePickerButton}`} onClick={()=>setUpload(true)}>Add documents</button><span className={styles.uploadCount}>{documents.length}</span></div></div></div>}
      {permissions.addPhotos&&<div className={styles.field}><span>Photos</span><div className={`${styles.uploadPanel} ${local.uploadPanel}`}><div className={styles.uploadRow}><button className={`${styles.secondaryButton} ${styles.filePickerButton}`} disabled={busy} onClick={()=>photoInput.current?.click()}>Add photos</button><span className={styles.uploadCount}>{asset.photos?.length||0} / 12</span><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>void addPhotos(e.target.files)}/></div></div></div>}
     </div>
     {(documents.length > 0 || !!asset.photos?.length) && <SharedAssetExport title={title} photos={asset.photos || []} asset={{serialNumber:asset.serialNumber,yearModel:asset.yearModel,usage:asset.usageReading == null ? "" : `${asset.usageReading} ${asset.usageMetric}`,condition:asset.condition,replacementPriceExVat:asset.replacementPriceExVat,valueExVat:asset.currentValue}} attachments={documents.map(d => ({name:d.title || d.fileName, url:endpoint+'/documents?id='+encodeURIComponent(d.id)}))}/>}
     {!!documents.length&&<div className={local.documents}>{documents.map(d=><a key={d.id} href={endpoint+'/documents?id='+encodeURIComponent(d.id)} target="_blank" rel="noreferrer">{d.title||d.fileName}</a>)}</div>}
     {!!asset.photos?.length&&<div className={local.photos}>{asset.photos.map((src,i)=><img key={src+i} src={src} alt={`${title} — photo ${i+1}`}/>)}</div>}
    </>:<form className={`${styles.modalForm} ${styles.manualAssetForm} ${styles.manualStepForm}`} onSubmit={e=>e.preventDefault()}>
     <section className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.assetUpdateStageCard} ${styles.fullWidth}`}>
      <div className={styles.manualUtilityRow}><dl className={styles.assetClassificationSummary}><div><dt>Asset type</dt><dd>{asset.kind==='vehicle'?'Vehicle':asset.kind==='tractor'?'Equipment':asset.kind}</dd></div>{asset.categoryLabel&&<div><dt>Family</dt><dd>{asset.categoryLabel}</dd></div>}</dl></div>
      <div className={`${styles.assetFormDetailsStack} ${refinements.detailsStack}`}>
       <div className={styles.assetTitleRow}><label className={`${styles.field} ${styles.manualTitleField}`}><span>Asset title</span><input value={draft.title} maxLength={240} readOnly={!permissions.title} disabled={busy} onChange={e=>update('title',e.target.value)}/></label></div>
       <div className={`${styles.assetTripleGrid} ${refinements.compactGrid}`}>
        <label className={styles.field} data-asset-detail-edit-target="serial"><span>Serial / reference</span><input value={serial} readOnly={!permissions.serialNumber} disabled={busy} onChange={e=>setSerial(e.target.value)}/>{permissions.serialNumber&&serial!==(asset.serialNumber||'')&&<button className={styles.secondaryButton} disabled={busy||serial===(asset.serialNumber||'')} onClick={()=>void saveCorrection('serialNumber')}>Save serial number</button>}</label>
        {(['brand','model'] as const).map(key=><label key={key} className={styles.field}><span>{key==='brand'?'Brand':'Model'}</span><input value={draft[key]} maxLength={240} readOnly={!permissions[key]} disabled={busy} onChange={e=>update(key,e.target.value)}/></label>)}
       </div>
       <fieldset disabled={busy} className={local.fieldset}><AssetDetailsFields className={`${styles.assetTripleGrid} ${refinements.compactGrid}`} year={draft.year} usage={draft.usage} condition={draft.condition} canYear={permissions.yearModel} canUsage={permissions.usage&&asset.usageMetric!=='none'} canCondition={permissions.condition} usageLabel={`Usage (${asset.usageMetric})`} onYear={v=>update('year',v)} onUsage={v=>update('usage',v)} onCondition={v=>update('condition',v)}/></fieldset>
       <div className={`${styles.assetValueBoxGrid} ${refinements.valueGrid}`}>
        <SharedAssetVatField label="Current value" value={asset.currentValue==null?'':String(asset.currentValue)} className={styles.manualCurrentValueField} onOpen={permissions.suggestValue||permissions.owner?()=>setValueField('current'):undefined} disabled={busy||changed}/>
        <SharedAssetVatField label="Replacement price" target="replacement" value={replacement} onOpen={permissions.replacementPrice?()=>setValueField('replacement'):undefined} disabled={busy||changed} className={styles.manualReplacementValueField}/>
        <SharedAssetVatField label="Insured value" value={asset.insuredValue==null?'':String(asset.insuredValue)} className={styles.assetInsuredValueField}/>
       </div>
       {correctionNotice&&<p role="status">{correctionNotice}</p>}
       <label className={`${styles.field} ${styles.fullWidth} ${styles.assetNotesField} ${refinements.notesField}`}><span>Notes</span><textarea rows={3} value={draft.note} readOnly={!permissions.note} disabled={busy} maxLength={4000} onChange={e=>update('note',e.target.value)}/></label>
      </div>
     </section>
    </form>}
   </div>
   <footer className={`${styles.assetUpdateFooter} ${local.footer}`}><span className={styles.assetUpdateSaveText} role="status">{section==='paperwork'?'Click Done to save paperwork changes.':section==='details'&&correctionNotice?correctionNotice:section==='details'&&asset&&Number(replacement)!==Number(asset.replacementPriceExVat??0)?'Replacement price not sent':section==='details'&&asset&&serial!==(asset.serialNumber||'')?'Serial number not saved':status}</span>{error&&changed&&draft&&<button className={styles.secondaryButton} disabled={busy} onClick={()=>void saveDetails(draft)}>Retry save</button>}<button type="button" className={section==='menu'?styles.secondaryButton:styles.primaryButton} disabled={busy||changed||paperDirty} onClick={close}>{section==='menu'?'Exit':'Done'}</button></footer>
  </section>
  {upload&&asset&&<AssetDocumentUploadModal accountDesign excludeInvoices assetId={asset.id} assetTitle={title} uploadEndpoint={endpoint+'/documents'} onClose={()=>setUpload(false)} onUploaded={async(_,outcome)=>{await loadDocuments();saved();if(outcome.complete)setUpload(false);}}/>}
 </div>;
}
