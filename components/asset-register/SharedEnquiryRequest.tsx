import styles from './SharedEnquiryRequest.module.css';
export default function SharedEnquiryRequest({sender,request,recipient}: {sender:string;request:string;recipient?:string}) {
  return <section className={styles.bar} aria-label={`Request from ${sender}`}>
    <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M7 8h10M7 12h7"/></svg></span>
    <div className={styles.copy}><h2>Request from <strong>{sender}</strong></h2><p>{request}</p></div>
    {recipient && <span className={styles.recipient}><small>Shared with</small><strong>{recipient}</strong></span>}
  </section>;
}
