import {listReceivedSharedEnquiries} from '../../lib/guest-leads';
import styles from './GuestLead.module.css';
export default async function SharedEnquiryInbox(){
 const enquiries=await listReceivedSharedEnquiries();
 if(!enquiries.length)return null;
 return <section className={styles.panel}><h2>Shared asset enquiries</h2><p>Enquiries addressed to your verified account email. Open the same page shared by the owner to view reports and send documents where enabled.</p>{enquiries.map(enquiry=><div className={styles.report} key={enquiry.token}><div><strong>{enquiry.sender}</strong><p>{enquiry.request}</p><small>{new Date(enquiry.created_at).toLocaleDateString('en-ZA')}</small></div><a href={`/asset-share/${enquiry.token}`}>Open enquiry</a></div>)}</section>;
}
