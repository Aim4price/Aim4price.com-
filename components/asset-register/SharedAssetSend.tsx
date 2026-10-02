'use client';
import {useState} from 'react';
import {createPortal} from '../WebsitePortal';
import type {ExternalLeadActionData} from './ExternalLeadActions';
import LeadNoteDialog from '../leads/LeadNoteDialog';
import LeadActionDialog from '../leads/LeadActionDialog';
import SharedEnquiryAccess from '../SharedEnquiryAccess';
import assetStyles from '../../app/asset-register/page.module.css';
import leadStyles from '../../app/leads/page.module.css';
export default function SharedAssetSend({enquiry,assetId,assetTitle}:{enquiry:ExternalLeadActionData;assetId:string;assetTitle:string}){
 const [open,setOpen]=useState(false),[note,setNote]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[drag,setDrag]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false),[requestId,setRequestId]=useState('');
 const close=()=>{if(!busy)setOpen(false);};
 function choose(file:File|null){if(file&&(file.size>12*1024*1024||!file.name.toLowerCase().endsWith('.pdf'))){setError('Choose a PDF quote up to 12 MB.');return;}setError('');setFile(file);}
 async function send(){if(busy)return;setBusy(true);setError('');try{const form=new FormData();form.set('note',note);form.set('requestId',requestId);if(file)form.set('attachment',file);const r=await fetch(`/api/asset-share-links/${enquiry.token}/assets/${assetId}/notes`,{method:'POST',body:form});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not send your note.');setSent(true);}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 const allowed=['active','owner'].includes(enquiry.access);
 return <><button type="button" className={`${assetStyles.optionsButton} ${assetStyles.sharedNoteActionButton} ${leadStyles.leadQuickActionButton}`} title="Send a note or quote" aria-label="Send a note or quote" onClick={()=>{setNote('');setFile(null);setError('');setSent(false);setRequestId(crypto.randomUUID());setOpen(true);}}><svg className={assetStyles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 20h4L20 8l-4-4L4 16zM13 7l4 4"/></svg><span>Send</span></button>
 {open&&createPortal(!allowed?<LeadActionDialog title="Send note or quote" assetTitle={assetTitle} onClose={close}><SharedEnquiryAccess returnTo={`/asset-share/${enquiry.token}?open=1`} access={enquiry.access} embedded/></LeadActionDialog>:!enquiry.reply&&enquiry.access!=='owner'?<LeadActionDialog title="Send note or quote" assetTitle={assetTitle} onClose={close}><p>The owner has not enabled replies for this link.</p></LeadActionDialog>:sent?<LeadActionDialog title="Note sent" assetTitle={assetTitle} onClose={close}><p role="status">Your note and any attached quote are now in the owner’s Asset Register.</p><button type="button" onClick={close}>Done</button></LeadActionDialog>:<LeadNoteDialog assetTitle={assetTitle} noteDraft={note} setNoteDraft={setNote} noteAttachmentFile={file} setNoteAttachmentFile={setFile} isSavingNote={busy} isNoteAttachmentDragging={drag} setIsNoteAttachmentDragging={setDrag} handleLeadNoteAttachmentChange={e=>choose(e.target.files?.[0]||null)} handleLeadNoteAttachmentDrop={e=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files[0]||null);}} closeNoteModal={close} onSend={()=>void send()} error={error}/>,document.body)}</>;
}
