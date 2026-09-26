'use client';
import {useRouter} from 'next/navigation';
import type {LeadAccess,LeadDetails,LeadReport} from '../../lib/guest-leads';
import {buildWhatsAppShareUrl} from '../../lib/asset-external-share';
import LeadDocuments from './LeadDocuments';
import styles from './GuestLead.module.css';
export default function GuestLeadActions({token,details,reports,access}:{token:string;details:LeadDetails;reports:LeadReport[];access:LeadAccess}){
 const router=useRouter();
 const open=access==='owner'||access==='active';
 return <section className={styles.panel}>
 {details.allowReply&&<div className={styles.actions}><a href={`mailto:${encodeURIComponent(details.replyEmail)}?subject=${encodeURIComponent('Re: Aim4price asset request')}`}>Reply by email</a>{details.replyPhone&&<a target="_blank" rel="noreferrer" href={buildWhatsAppShareUrl({subject:'Asset enquiry',body:`Hello ${details.replyName}, regarding your Aim4price asset request.`},details.replyPhone)}>Reply on WhatsApp</a>}</div>}
 <details className={styles.manage}><summary>Manage · shared reports ({reports.length})</summary>
 <p>Only reports chosen by the owner appear here. Access does not allow you to edit the owner’s assets.</p>
 {access==='owner'&&<p>You are previewing your own lead. The recipient needs verified, active access to open reports.</p>}
 {reports.map(report=><div key={report.id} className={styles.report}><strong>{report.label}</strong>{open?<a href={`/api/asset-share-links/${token}/reports/${report.id}`} target="_blank" rel="noreferrer">Open report</a>:<span>🔒 Account access required</span>}</div>)}
 {!reports.length&&<p>The owner has not shared any reports with this enquiry.</p>}
 {reports.length>0&&!open&&<><p>Sign in with the verified Aim4price account matching the email selected by the owner. Directory acceptance alone does not unlock reports.</p><div className={styles.actions}><a href={`/auth?returnTo=${encodeURIComponent(`/asset-share/${token}`)}`}>Sign in</a><a href={`/auth?returnTo=${encodeURIComponent(`/asset-share/${token}`)}`}>Create an account</a><button type="button" onClick={()=>router.refresh()}>Check access again</button></div></>}

 </details>
 {(access==='owner'||details.allowSubmissions)&&<LeadDocuments token={token} owner={access==='owner'}/>}
 </section>;
}
