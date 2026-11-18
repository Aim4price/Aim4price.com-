'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import {useRouter} from 'next/navigation';
import ModalSelect from '../AssetModalSelect';
import PricingVatToggle from '../PricingVatToggle';
import {pricingVatAmount,pricingInputExVat} from '../../lib/pricing-vat';
import LeadActionDialog from '../leads/LeadActionDialog';
import styles from './AssetValueDialog.module.css';
import assetStyles from '../../app/asset-register/page.module.css';
const money=(v:unknown)=>v===null||v===undefined?'Not saved':new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(Number(v)).replace(/[,\s]/g,' ');
type RequestItem={id:string;amount:number|string;reason:string;actor_name:string;status:string;submitted_value:number|string;created_at:string;email_sent_at?:string;email_error?:string;decided_at?:string;decided_by_name?:string;decision_reason?:string};
type Review={asset:{id:string;title:string;value:number;replacementPrice:number|null;revision:string;manual:boolean;baseline?:{amount:number;actorName:string;date:string;reason:string}|null};requests:RequestItem[];replacementRequests?:Array<{id:string;actorName:string;dealerName:string;reason?:string;proposedReplacementPriceExVat:number|null;email_error?:string|null}>;history:Array<{id:string;action:string;actor_name:string;created_at:string;before_data:{amount:number;replacementPrice?:number};after_data:{amount:number;reason:string;suggestionReason?:string}}>};
function ValueIcon({kind}: {kind: 'value'|'replacement'|'history'|'refresh'}) {
 const paths={value:'M3 17 9 11l4 4 8-8 M14 7h7v7',replacement:'M3 4h9l9 9-8 8-10-10z M7 8h.01',history:'M4 5v5h5 M4 10a8 8 0 1 1 1 8 M12 7v5l3 2',refresh:'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 11-1l3 3 M4 15l3 3a7 7 0 0 0 11-1'};
 return <span className={styles.valueIcon} data-kind={kind} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]}/></svg></span>;
}
function ChoiceArrow(){return <span className={styles.chevron} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7"/></svg></span>;}
export default function AssetValueDialog({endpoint,assetTitle,onClose,onSaved,suggest=false,initialReplacement,legacyCorrectionId,initialView,replacementSuggestion,initialRequestId,returnToDetails=false}: {returnToDetails?:boolean;initialRequestId?:string;endpoint:string;assetTitle:string;onClose:()=>void;onSaved?:(item?:any)=>void;suggest?:boolean;initialReplacement?:number;legacyCorrectionId?:string;initialView?:'override'|'replacement';replacementSuggestion?:{readEndpoint:string;endpoint:string;sourceId:string;assetId?:string;current:number|null}}) {
 const router=useRouter();const [review,setReview]=useState<Review|null>(null),[current,setCurrent]=useState<number|null>(null),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [view,setView]=useState<'menu'|'override'|'replacement'|'review'|'history'|'reset'|'restore'|'complete'>(initialView||(initialReplacement?'replacement':'menu')),[selected,setSelected]=useState<RequestItem|null>(null),[replacement,setReplacementExVat]=useState(String(initialReplacement??'')),[preview,setPreview]=useState<{revision:string;currentValue:number;recalculatedValue:number|null;replacementPrice?:number;previousReplacementPrice?:number|null}|null>(null);
 const [historyPage,setHistoryPage]=useState(0);
 const [reasonTouched,setReasonTouched]=useState(false);
 const reasonRef=useRef<HTMLTextAreaElement>(null);
 const reasonInvalid=reasonTouched&&reason.trim().length<3;
 const replacementLoaded=useRef(initialReplacement!==undefined);
 const replacementReview=view==='replacement'&&!!preview;
 const [correctionId,setCorrectionId]=useState(legacyCorrectionId);
 const [manual,setManual]=useState(false),[sharedRevision,setSharedRevision]=useState(''),[restoreEntry,setRestoreEntry]=useState<Review['history'][number]|null>(null);
 const [valueVat,setValueVat]=useState(false);
 const [amountDraft,setAmountDraft]=useState<string|null>(null);
 const [replacementDraft,setReplacementDraft]=useState<string|null>(null);
 // Keep the canonical amount separate so toggling cannot compound VAT rounding.
 function setReplacement(value:string){setReplacementExVat(value);setReplacementDraft(null);}
 const displayedReplacement=replacementDraft??(replacement===''?'':String(pricingVatAmount(Number(replacement),valueVat)));
 const displayedAmount=amountDraft??(amount===''?'':String(pricingVatAmount(Number(amount),valueVat)));
 function changeValueVat(included:boolean){setValueVat(included);setAmountDraft(null);setReplacementDraft(null);}
 const vatLabel=valueVat?'Incl. VAT':'Excl. VAT';
 const summaryVat=['override','replacement','complete'].includes(view)&&valueVat;
 const summaryMoney=(value:unknown)=>value==null?'Not saved':money(pricingVatAmount(Number(value),summaryVat));
 const ownerMoney=(value:unknown)=>value==null?'Not saved':money(pricingVatAmount(Number(value),valueVat));
 const bodyRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const elements=[document.documentElement,document.body];
  const previous=elements.map(element=>({value:element.style.getPropertyValue('overflow'),priority:element.style.getPropertyPriority('overflow')}));
  elements.forEach(element=>element.style.setProperty('overflow','hidden','important'));
  return()=>elements.forEach((element,index)=>element.style.setProperty('overflow',previous[index].value,previous[index].priority));
 },[]);
 useEffect(()=>{if(bodyRef.current?.parentElement)bodyRef.current.parentElement.scrollTop=0;},[view,replacementReview]);
 const [suggestionVat,setSuggestionVat]=useState(false);
 const suggestedAmount=pricingInputExVat(Number(amount),suggestionVat);
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const refresh=useCallback(async()=>{if(replacementSuggestion){const r=await fetch(replacementSuggestion.readEndpoint,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not reload this asset.');setCurrent(d.asset.replacementPriceExVat);setManual(d.asset.manual===true);setSharedRevision(d.asset.revision||'');return;}const r=await fetch(initialRequestId?`${endpoint}?valueRequest=${encodeURIComponent(initialRequestId)}`:endpoint,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);if(suggest){setCurrent(d.value);setManual(d.manual===true);setSharedRevision(d.revision||'');}else {setReview(d);if(initialView==='replacement'&&!replacementLoaded.current){setReplacement(String(d.asset.replacementPrice??''));replacementLoaded.current=true;}}},[endpoint,suggest,replacementSuggestion,initialRequestId]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message));const update=()=>void refresh().catch(e=>setError(e.message));window.addEventListener('focus',update);return()=>window.removeEventListener('focus',update);},[refresh]);
 useEffect(()=>{if(!initialRequestId||!review)return;const request=review.requests.find(r=>r.id===initialRequestId);setSelected(request||null);setView(request?.status==='pending'?'review':'history');},[review,initialRequestId]);
 function changed(){setRequestId(crypto.randomUUID());setNotice('');}
 async function send(action:string,extra:Record<string,unknown>={}){
  setError('');
  if(!['previewReset','retryNotification'].includes(action)&&reason.trim().length<3){setReasonTouched(true);reasonRef.current?.focus();return;}
  setBusy(true);try{
  if((action==='suggest'||action==='override')&&!amount.trim())throw Error('Enter a value.');
  if(replacementSuggestion){
   if(!Number.isFinite(Number(amount))||Number(amount)<=0)throw Error('Enter a replacement price greater than zero.');
   const link=!!replacementSuggestion.assetId;
   const r=await fetch(replacementSuggestion.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceType:link?'external':'lead',sourceId:replacementSuggestion.sourceId,assetId:replacementSuggestion.assetId,field:'replacementPriceExVat',value:suggestedAmount,reason,confirmed:true,revision:sharedRevision})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to send suggestion.');
   setNotice(d.correction?.status==='accepted'?'Manual replacement price saved. Current value is unchanged.':'Sent to the owner for approval.');await refresh();setAmount('');setReason('');router.refresh();onSaved?.();return;
  }
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,amount:suggest?suggestedAmount:Number(amount),reason,requestId,legacyCorrectionId:['replacement','declineReplacement'].includes(action)?correctionId:undefined,revision:preview?.revision||review?.asset.revision||sharedRevision,confirmed:true,expectedValue:preview?.recalculatedValue,...extra})});const d=await r.json();if(!r.ok)throw Error(d.error);
  if(action==='previewReplacement'||action==='previewReset'){setPreview(action==='previewReplacement'?{...d,replacementPrice:Number(extra.replacementPrice),previousReplacementPrice:review?.asset.replacementPrice}:d);return;}
  setNotice(action==='retryNotification'?'Notification retry requested. The suggestion remains available here.':suggest?(d.direct?'Manual value updated. The change is recorded in history.':'Suggestion sent. The owner must approve it before the asset value changes.'):'Saved. The change has been recorded in asset history.');setRequestId(crypto.randomUUID());setReason('');setAmount('');setAmountDraft(null);setView(action==='replacement'?'complete':'menu');setReasonTouched(false);navigation.current=[];reasons.current={};setSelected(null);setPreview(null);setCorrectionId(undefined);await refresh();router.refresh();onSaved?.(d.item);
 }catch(e){setError(e instanceof Error?e.message:'Unable to save.');if(initialRequestId)await refresh().catch(()=>{});}finally{setBusy(false)}}
 const navigation=useRef<Array<typeof view>>([]);
 const reasons=useRef<Partial<Record<typeof view,string>>>({});
 function open(next:typeof view){if(next==='history')setHistoryPage(0);setReasonTouched(false);reasons.current[view]=reason;navigation.current.push(view);setView(next);setReason(reasons.current[next]??'');setError('');setNotice('');setPreview(null);changed();}
 function dismiss(){if(busy)return;setReasonTouched(false);if(preview){setPreview(null);return;}const previous=navigation.current.pop();if(previous){reasons.current[view]=reason;setView(previous);setReason(reasons.current[previous]??'');setError('');}else onClose();}
 const replacementRequests=review?.replacementRequests||[];
 const replacementRequest=replacementRequests.find(r=>r.id===correctionId);
 const pending=review?.requests.filter(r=>r.status==='pending')||[];
 const decided=review?.requests.filter(r=>r.status!=='pending')||[];
 const historyCount=(review?.history.length||0)+decided.length;
 const activeHistoryPage=Math.min(historyPage,Math.max(0,historyCount-1));
 const footer=suggest?<div className={styles.suggestionFooter}>
  <button type="button" className={assetStyles.secondaryButton} disabled={busy} onClick={()=>void refresh().then(()=>setError('')).catch(e=>setError(e.message))}><ValueIcon kind="refresh"/><span>Refresh values</span></button>
  <button type="button" className={assetStyles.primaryButton} disabled={busy} onClick={()=>void send('suggest')}>{busy?'Saving…':manual?'Confirm update':'Send suggestion'}</button>
 </div>:<div className={styles.flowActions}>
  {view!=='complete'&&<button type="button" className={styles.backButton} disabled={busy} onClick={dismiss}>{view==='menu'&&!returnToDetails?'Close':'Back'}</button>}
  <div className={styles.forwardActions}>
   {view==='menu'&&<button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>void refresh().then(()=>setError('')).catch(e=>setError(e.message))}><ValueIcon kind="refresh"/><span>Refresh values</span></button>}
   {view==='override'&&<button type="button" className={styles.primaryButton} disabled={busy||!review} onClick={()=>void send('override')}>{busy?'Saving…':'Confirm value change'}</button>}
   {view==='replacement'&&!preview&&<button type="button" className={styles.primaryButton} disabled={busy||!replacement.trim()||!review} onClick={()=>void send('previewReplacement',{replacementPrice:Number(replacement)})}>{busy?'Preparing…':'Preview change'}</button>}
   {replacementReview&&<>
    <button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>void send('replacement',{replacementPrice:preview?.replacementPrice,mode:'keep'})}>Keep current value</button>
    <button type="button" className={styles.primaryButton} disabled={busy||preview?.recalculatedValue===null} onClick={()=>void send('replacement',{replacementPrice:preview?.replacementPrice,mode:'recalculate'})}>Recalculate current value</button>
   </>}
   {view==='review'&&selected&&<>
    <button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>void send('decline',{proposalId:selected.id})}>Decline</button>
    <button type="button" className={styles.primaryButton} disabled={busy} onClick={()=>void send('approve',{proposalId:selected.id})}>Approve value</button>
   </>}
   {view==='reset'&&<button type="button" className={styles.primaryButton} disabled={busy} onClick={()=>void send(preview?'resetAim4price':'previewReset')}>{preview?'Confirm return to Aim4price':'Preview today’s value'}</button>}
   {view==='restore'&&restoreEntry&&<button type="button" className={styles.primaryButton} disabled={busy} onClick={()=>void send('restoreManual',{historyId:restoreEntry.id})}>Confirm restoration</button>}
   {view==='complete'&&<button type="button" className={styles.primaryButton} onClick={onClose}>Done</button>}
  </div>
 </div>;
 return <LeadActionDialog title={replacementSuggestion?(manual?'Update replacement price':'Suggest replacement price'):suggest?(manual?'Update manual value':'Suggest current value'):view==='override'?'Change current value':view==='complete'?'Replacement price updated':replacementReview?'Review replacement change':view==='replacement'?'Change replacement price':view==='history'?(initialRequestId?'Value suggestion':'Value history'):view==='review'?'Review suggestion':view==='reset'?'Return to Aim4price value':view==='restore'?'Restore previous value':'Manage values'} assetTitle={assetTitle} onClose={()=>{if(!busy)onClose();}} busy={busy} className={`${styles.dialog} ${suggest?styles.suggestionDialog:''}`} footer={footer}>
 <div ref={bodyRef} className={styles.body} data-value-view={view}>
 {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status">{notice}</p>}
 {!suggest&&!replacementReview&&view!=='menu'&&view!=='history'&&<div className={styles.summary}>
  <div><span>Current value · {summaryVat?'Incl. VAT':'Excl. VAT'}</span><strong>{summaryMoney(review?.asset.value)}</strong></div>
  <div><span>Replacement price · {summaryVat?'Incl. VAT':'Excl. VAT'}</span><strong>{summaryMoney(review?.asset.replacementPrice)}</strong></div>
 </div>}
 {!suggest&&!review&&!error&&<p>Loading values…</p>}
 {!suggest&&review&&view==='menu'&&<>
  <div className={styles.chooserHeading}><h3>What would you like to update?</h3><fieldset className={styles.vatControl} disabled={busy}><legend className={styles.srOnly}>Saved values VAT display</legend><PricingVatToggle included={valueVat} onChange={changeValueVat}/></fieldset></div>
  <div className={styles.menuActions}>
   <button type="button" className={styles.valueChoice} onClick={()=>open('override')}>
    <span className={styles.choiceHeading}><ValueIcon kind="value"/><strong>Change current value</strong><ChoiceArrow/></span>
    <span className={styles.choiceAmount}>{ownerMoney(review.asset.value)}<span>{vatLabel}</span></span>
    <small>What your asset is worth today.</small>
   </button>
   <button type="button" className={styles.valueChoice} data-tone="blue" onClick={()=>{setCorrectionId(undefined);if(!replacement)setReplacement(String(review.asset.replacementPrice??''));open('replacement')}}>
    <span className={styles.choiceHeading}><ValueIcon kind="replacement"/><strong>Change replacement price</strong><ChoiceArrow/></span>
    <span className={styles.choiceAmount}>{ownerMoney(review.asset.replacementPrice)}<span>{vatLabel}</span></span>
    <small>Cost of a new equivalent asset.</small>
   </button>
  </div>
  <div className={styles.supportActions}>
   <button type="button" className={styles.supportButton} onClick={()=>open('history')}><ValueIcon kind="history"/><span><strong>History</strong><small>View value changes and decisions.</small></span><ChoiceArrow/></button>
   {!review.asset.manual&&review.asset.baseline&&<button type="button" className={styles.supportButton} onClick={()=>open('reset')}><ValueIcon kind="refresh"/><span><strong>Return to Aim4price value</strong><small>Use today’s calculated value.</small></span><ChoiceArrow/></button>}
  </div>
  <p className={styles.note}>{review.asset.manual?'Manual value · editable with permission.':review.asset.baseline?'Automatic depreciation continues from your approved starting value.':'Aim4price value · automatic depreciation.'}</p>
 {replacementRequests.map(r=><div className={styles.request} key={r.id}><strong>Replacement price: {money(r.proposedReplacementPriceExVat)} · {r.actorName||r.dealerName}</strong><p>{r.reason||'No reason supplied.'}</p>{r.email_error&&<><small>Email unavailable; review remains available here.</small><button className={assetStyles.secondaryButton} disabled={busy} onClick={()=>void send('retryNotification',{notificationType:'replacement',notificationId:r.id})}>Retry notification</button></>}<button className={assetStyles.primaryButton} onClick={()=>{setCorrectionId(r.id);setReplacement(String(r.proposedReplacementPriceExVat??''));open('replacement');}}>Review replacement suggestion</button></div>)}{pending.length>0?<><div className={styles.reviewHeading}><strong>Suggestions to review</strong><p>Accept or decline a suggested value. Nothing changes until you approve it.</p></div>{pending.map(r=><div className={styles.request} key={r.id}><strong>{money(r.amount)} · {r.actor_name}</strong><p>{r.reason}</p>{r.email_error&&<><small>Email unavailable; this suggestion remains available for review here.</small><button className={assetStyles.secondaryButton} disabled={busy} onClick={()=>void send('retryNotification',{notificationType:'current',notificationId:r.id})}>Retry notification</button></>}<button className={assetStyles.primaryButton} onClick={()=>{open('review');setSelected(r)}}>Review suggestion</button></div>)}</>:null}</>}
 {suggest&&<>
  <div className={styles.suggestionValues}>
   <div className={styles.currentValue}><span>{replacementSuggestion?'Replacement price':'Current value'} · excl. VAT</span><strong>{money(current).replace(/[,\s]/g,' ')}</strong></div>
   <label className={styles.proposedValue}><span>{manual?'New':'Suggested'} {replacementSuggestion?'replacement price':'value'}</span><div className={styles.suggestionInputRow}><ModalSelect label="Suggested value VAT" buttonLabel="Suggested value VAT" className={styles.vatSelect} value={suggestionVat?'included':'excluded'} options={[{value:'excluded',label:'Excl. VAT'},{value:'included',label:'Incl. VAT'}]} onChange={mode=>{const next=mode==='included';if(amount)setAmount(String(pricingVatAmount(suggestedAmount,next)));setSuggestionVat(next);}}/><div className={styles.currencyInput}><span aria-hidden="true">R</span><input aria-label="Suggested value" type="number" min="0" max="1000000000000" value={amount} disabled={busy} placeholder="Enter amount" onChange={e=>{setAmount(e.target.value);changed()}}/></div></div></label>
  </div>
  <label className={`${styles.field} ${styles.suggestionReason}`}><span>Reason for this value</span><textarea ref={reasonRef} aria-invalid={reasonInvalid} aria-describedby={reasonInvalid?'value-reason-error':undefined} onBlur={()=>setReasonTouched(true)} maxLength={1500} rows={3} value={reason} disabled={busy} placeholder="For example: recent inspection, condition or comparable equipment." onChange={e=>{setReason(e.target.value);changed()}}/>{reasonInvalid&&<small id="value-reason-error" className={styles.reasonError}>Add a short reason.</small>}</label>
  <p className={`${styles.note} ${styles.approvalNote}`}>{manual?(replacementSuggestion?'This manual asset’s replacement price will update immediately. Current value stays unchanged.':'You have permission to update this manual value. Confirming saves it immediately and records the change in history.'):(replacementSuggestion?'The owner must approve this price and choose its effect on current value.':'The owner must approve your suggestion before the current value changes.')}</p>
 </>}
 {!suggest&&view==='override'&&<>
  <div className={styles.fields}>
   <div className={styles.field}><label htmlFor="current-value-input">New current value</label>
    <div className={styles.amountControl} data-value-input-surface>
     <span aria-hidden="true">R</span><input id="current-value-input" aria-label={`New current value ${valueVat?'including':'excluding'} VAT`} type="number" min="0" max={pricingVatAmount(1000000000000,valueVat)} step="any" placeholder="Enter amount" value={displayedAmount} disabled={busy} onChange={e=>{const value=e.target.value;setAmountDraft(value);setAmount(value===''?'':String(pricingInputExVat(Number(value),valueVat)));changed()}}/>
     <fieldset className={styles.vatControl} disabled={busy}><legend className={styles.srOnly}>Current value VAT</legend><PricingVatToggle included={valueVat} onChange={changeValueVat}/></fieldset>
    </div>
   </div>
   <label className={styles.field}>Reason<textarea ref={reasonRef} aria-invalid={reasonInvalid} aria-describedby={reasonInvalid?'value-reason-error':undefined} onBlur={()=>setReasonTouched(true)} rows={2} placeholder="Why are you changing this value?" maxLength={1500} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);changed()}}/>{reasonInvalid&&<small id="value-reason-error" className={styles.reasonError}>Add a short reason.</small>}</label>
  </div>
  <p className={styles.note}>{review?.asset.manual?'This is a manual value. Automatic depreciation needs a supported Aim4price valuation first.':'Automatic depreciation continues from this new value, starting today.'}</p>
 </>}
 {!suggest&&view==='review'&&selected&&<><div className={styles.request}><strong>{selected.actor_name} suggested {money(selected.amount)}</strong><p>{selected.reason}</p><small>Value when submitted: {money(selected.submitted_value)}. The current value above is the latest saved value.</small></div><label className={styles.field}>Decision reason<textarea ref={reasonRef} aria-invalid={reasonInvalid} aria-describedby={reasonInvalid?'value-reason-error':undefined} onBlur={()=>setReasonTouched(true)} value={reason} maxLength={1500} disabled={busy} onChange={e=>{setReason(e.target.value);changed()}}/>{reasonInvalid&&<small id="value-reason-error" className={styles.reasonError}>Add a short reason.</small>}</label><p className={styles.note}>{review?.asset.manual?'Approval updates the manual value.':'Approval sets a new starting value. Automatic depreciation continues from it.'}</p></>}
 {!suggest&&view==='replacement'&&!preview&&<>{replacementRequest&&<div className={styles.request}><strong>{replacementRequest.actorName||replacementRequest.dealerName} suggested {money(replacementRequest.proposedReplacementPriceExVat)}</strong><p>{replacementRequest.reason||'No reason supplied.'}</p><button className={assetStyles.secondaryButton} disabled={busy} onClick={()=>void send('declineReplacement')}>Decline suggestion</button></div>}<div className={styles.fields}><div className={styles.field}><label htmlFor="replacement-price-input">New replacement price</label><div className={styles.amountControl} data-value-input-surface><span aria-hidden="true">R</span><input id="replacement-price-input" aria-label={`New replacement price ${valueVat?'including':'excluding'} VAT`} type="number" min="1" step="any" value={displayedReplacement} disabled={busy} onChange={e=>{const value=e.target.value;setReplacementDraft(value);setReplacementExVat(value===''?'':String(pricingInputExVat(Number(value),valueVat)));setPreview(null);changed()}}/><fieldset className={styles.vatControl} disabled={busy}><legend className={styles.srOnly}>Replacement price VAT</legend><PricingVatToggle included={valueVat} onChange={changeValueVat}/></fieldset></div></div><label className={styles.field}>Reason<textarea ref={reasonRef} aria-invalid={reasonInvalid} aria-describedby={reasonInvalid?'value-reason-error':undefined} onBlur={()=>setReasonTouched(true)} rows={2} placeholder="Why are you changing this value?" maxLength={1500} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);changed()}}/>{reasonInvalid&&<small id="value-reason-error" className={styles.reasonError}>Add a short reason.</small>}</label></div><p className={styles.note}>Review the new price, then choose whether to keep or recalculate the current value.</p></>}
 {replacementReview&&preview&&<div className={styles.replacementReview}>
  <div className={styles.chooserHeading}><h3>Choose how to apply this price</h3><fieldset className={styles.vatControl} disabled={busy}><legend className={styles.srOnly}>Preview VAT display</legend><PricingVatToggle included={valueVat} onChange={changeValueVat}/></fieldset></div>
  <div className={styles.replacementChange}><ValueIcon kind="replacement"/><div><span>Replacement price · {vatLabel}</span><strong>{ownerMoney(preview.previousReplacementPrice)} <span aria-label="changes to">→</span> {ownerMoney(preview.replacementPrice)}</strong></div></div>
  <div className={styles.summary}>
   <div><span><ValueIcon kind="value"/>Keep current value</span><strong>{ownerMoney(preview.currentValue)}</strong><small>Replacement price updates only.</small></div>
   <div><span><ValueIcon kind="refresh"/>Recalculated value</span><strong>{preview.recalculatedValue===null?'Manual value':ownerMoney(preview.recalculatedValue)}</strong><small>{preview.recalculatedValue===null?'Update this manual value separately.':'Uses the new replacement price.'}</small></div>
  </div>
  <p className={styles.note}>Choose whether to keep or recalculate your asset value.</p>
 </div>}
 {!suggest&&view==='reset'&&<><p className={styles.note}>Remove the approved starting value and return to today’s Aim4price calculation. The previous decision stays in history.</p><label className={styles.field}>Reason<textarea ref={reasonRef} aria-invalid={reasonInvalid} aria-describedby={reasonInvalid?'value-reason-error':undefined} onBlur={()=>setReasonTouched(true)} value={reason} maxLength={1500} onChange={e=>{setReason(e.target.value);changed();}}/>{reasonInvalid&&<small id="value-reason-error" className={styles.reasonError}>Add a short reason.</small>}</label>{preview&&<p>Current value: <strong>{money(preview.currentValue)}</strong> → Aim4price value: <strong>{money(preview.recalculatedValue)}</strong></p>}</>}
 {!suggest&&view==='restore'&&restoreEntry&&<><p>Restore manual value to <strong>{money(restoreEntry.before_data.amount)}</strong>?</p><p className={styles.note}>This creates a new history entry. Replacement price stays unchanged.</p><label className={styles.field}>Reason<textarea ref={reasonRef} aria-invalid={reasonInvalid} aria-describedby={reasonInvalid?'value-reason-error':undefined} onBlur={()=>setReasonTouched(true)} value={reason} maxLength={1500} onChange={e=>{setReason(e.target.value);changed();}}/>{reasonInvalid&&<small id="value-reason-error" className={styles.reasonError}>Add a short reason.</small>}</label></>}
 {initialRequestId&&review&&(!selected||selected.status!=='pending')&&<p role="status" className={styles.approvalNote}>{selected?`Already ${selected.status==='approved'?'approved':'declined'}${selected.decided_by_name?` by ${selected.decided_by_name}`:''}${selected.decided_at?` on ${new Date(selected.decided_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}`:''}. No further action is needed.`:'This suggestion is no longer available.'}</p>}
 {initialRequestId&&selected&&selected.status!=='pending'&&<div className={styles.request}><strong>{selected.actor_name} suggested {money(selected.amount)}</strong><p>{selected.reason}</p>{selected.decision_reason&&<p>Decision: {selected.decision_reason}</p>}</div>}
 {!suggest&&!initialRequestId&&view==='history'&&<div className={styles.history}>{review?.history.slice(activeHistoryPage,activeHistoryPage+1).map(h=><div className={styles.request} key={h.id}><strong>{h.action} · {h.actor_name}</strong><p>{money(h.before_data.amount)} → {money(h.after_data.amount)}</p><p>{h.after_data.reason}</p>{h.after_data.suggestionReason&&<p>Suggested reason: {h.after_data.suggestionReason}</p>}<small>{new Date(h.created_at).toLocaleString('en-ZA')}</small><div className={styles.actions}>{review.asset.manual&&typeof h.before_data.amount==='number'&&<button className={assetStyles.secondaryButton} onClick={()=>{setRestoreEntry(h);open('restore');}}>Restore previous manual value</button>}{typeof h.before_data.replacementPrice==='number'&&h.before_data.replacementPrice>0&&<button className={assetStyles.secondaryButton} onClick={()=>{setReplacement(String(h.before_data.replacementPrice));open('replacement');}}>Review previous replacement price</button>}</div></div>)}{decided.slice(Math.max(0,activeHistoryPage-(review?.history.length||0)),Math.max(0,activeHistoryPage-(review?.history.length||0)+1)).map(r=><div className={styles.request} key={r.id}><strong>{r.status} · {money(r.amount)} · {r.actor_name}</strong><p>{r.reason}</p></div>)}{historyCount>1&&<nav className={styles.pagination} aria-label="Value history pages"><button type="button" className={assetStyles.secondaryButton} disabled={activeHistoryPage===0} onClick={()=>setHistoryPage(activeHistoryPage-1)}>Previous</button><span role="status">{activeHistoryPage+1} of {historyCount}</span><button type="button" className={assetStyles.secondaryButton} disabled={activeHistoryPage>=historyCount-1} onClick={()=>setHistoryPage(activeHistoryPage+1)}>Next</button></nav>}{!review?.history.length&&!review?.requests.some(r=>r.status!=='pending')&&<div className={styles.empty}><strong>No value changes yet</strong><p>Changes and decisions will appear here with who made them and why.</p></div>}</div>}

 </div></LeadActionDialog>;
}
