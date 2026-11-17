"use client";
import { useEffect, useId, useState } from "react";
import { createPortal } from "./WebsitePortal";
import ShareModalCloseButton from "./asset-register/ShareModalCloseButton";
import { useLeadDialog } from "./leads/useLeadDialog";
import { PartsMessageIcon } from "./PartsEnquireButton";
import styles from "../app/dealer/parts/parts.module.css";

export type PartsEnquiryDealer = { business_name: string; town?: string; phone?: string; email?: string; uploaded_at?: string; description?: string; owned?: boolean };
export type PartsEnquiryItem = { partNumber: string; quantity: string };
export type PartsEnquiryRequest = { items: { partNumber: string; quantity: number }[]; message: string; text: string };
function Icon({kind}: {kind: "message" | "phone" | "mail" | "whatsapp"}) {
  if (kind === "message") return <PartsMessageIcon/>;
  if (kind === "whatsapp") return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z"/><path strokeWidth="1.35" d="M8.5 7.5h1.2l1.1 2.6-1.2 1a8 8 0 0 0 3.3 3.3l1-1.2 2.6 1.1v1.2c0 .8-.7 1.4-1.5 1.2a11.2 11.2 0 0 1-7.7-7.7c-.2-.8.4-1.5 1.2-1.5Z"/></svg>;
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={kind === "phone" ? "M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c-9 3-20-8-16-16Z" : "M3 5h18v14H3Z M3 5l9 7 9-7"}/></svg>;
}
const date = (value: string) => new Date(value).toLocaleDateString("en-ZA", {day:"numeric",month:"short",year:"numeric"});

/** The same contact choices and quantity editor for network and shared parts. */
export default function PartsEnquiryDialog({dealer, listName, parts, owned = false, desktop = false, ledgerHref, busy, error, combinedMessageLimit, onClose, onSend}: {
  dealer: PartsEnquiryDealer; listName?: string; parts: PartsEnquiryItem[]; owned?: boolean; desktop?: boolean;
  ledgerHref?: string; busy: boolean; error?: string; combinedMessageLimit?: number;
  onClose: () => void; onSend: (request: PartsEnquiryRequest) => void;
}) {
  const [requestedParts,setRequestedParts] = useState(parts);
  const [enquiryCompose,setEnquiryCompose] = useState(false);
  const [enquiryPage,setEnquiryPage] = useState(0);
  const [enquiry,setEnquiry] = useState("Please confirm price and availability for these parts.");
  const quantityErrorId = useId();
  const ref = useLeadDialog(onClose, busy);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = old; };
  }, []);
  const enquiryValid = requestedParts.length > 0 && requestedParts.every(r=>/^\d+$/.test(r.quantity) && Number(r.quantity)>0 && Number(r.quantity)<=999999999);
  const partsText = requestedParts.map(r=>`${r.partNumber} — quantity ${r.quantity}`).join('\n');
  const enquiryText = partsText + '\n\n' + enquiry;
  const messageLimit = combinedMessageLimit ? Math.max(0,combinedMessageLimit-partsText.length-2) : 2000;
  return createPortal(<div className={styles.backdrop} data-website-overlay>
    <section ref={ref} className={`${styles.modal} ${styles.enquiryModal}`} role="dialog" aria-modal="true" aria-label="Parts enquiry">
      <div className={styles.closeWrap}><ShareModalCloseButton onClick={onClose} disabled={busy}/></div>
      <header className={`${styles.dialogHeader} ${styles.enquiryHeader}`}>
        <div><h2>Parts enquiry</h2>{listName && <p>{listName}</p>}</div>
      </header>
      <div className={styles.enquiryBody}>
        <section className={styles.enquiryRequest} aria-label="Requested parts">
          <div className={styles.enquirySectionHeading}><h3>Requested parts</h3><span>{requestedParts.length} {requestedParts.length === 1 ? "part" : "parts"}</span></div>
          <div className={styles.enquiryRequestCard}>
            <section className={styles.enquiryDealer} aria-label="Dealer details">
              <h3>{dealer.business_name}</h3>
              <div className={styles.enquiryDealerMeta}>
                {dealer.town && <span>{dealer.town}</span>}
                {dealer.uploaded_at && <span>Updated {date(dealer.uploaded_at)}</span>}
              </div>
            </section>
            <div className={styles.enquiryTableWrap}>
              <table className={styles.enquiryTable}>
                <thead><tr><th scope="col">Part number</th><th scope="col">Quantity</th></tr></thead>
                <tbody>{requestedParts.slice(enquiryPage * 2, enquiryPage * 2 + 2).map((r,i)=>{
                  const valid = /^\d+$/.test(r.quantity) && Number(r.quantity)>0 && Number(r.quantity)<=999999999;
                  return <tr key={r.partNumber}>
                    <td><strong>{r.partNumber}</strong>{requestedParts.length === 1 && dealer.description && <small>{dealer.description}</small>}</td>
                    <td><input aria-label={`Requested quantity for ${r.partNumber}`} aria-invalid={!valid} aria-describedby={!valid ? quantityErrorId : undefined} inputMode="numeric" value={r.quantity} onChange={e=>setRequestedParts(requestedParts.map((p,n)=>n===enquiryPage * 2 + i?{...p,quantity:e.target.value}:p))}/></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>
          {requestedParts.length > 2 && <nav className={styles.enquiryPagination} aria-label="Requested parts pages">
            <button disabled={enquiryPage === 0} onClick={()=>setEnquiryPage(p=>p-1)}>Previous</button>
            <span>{enquiryPage + 1} / {Math.ceil(requestedParts.length / 2)}</span>
            <button disabled={(enquiryPage + 1) * 2 >= requestedParts.length} onClick={()=>setEnquiryPage(p=>p+1)}>Next</button>
          </nav>}
          {!enquiryValid && <p id={quantityErrorId} role="alert" className={styles.error}>Enter a positive whole quantity for each part.</p>}
        </section>
        {enquiryCompose && !owned && <label className={styles.enquiryMessage}>
          Message to dealer
          <textarea value={enquiry} maxLength={messageLimit} rows={3} onChange={e=>setEnquiry(e.target.value)} />
        </label>}
        {!enquiryCompose && <section className={styles.enquiryChannels} aria-label="Contact dealer">
          <div className={styles.enquirySectionHeading}><h3>Contact dealer</h3></div>
          <div className={styles.enquiryContactGrid}>
            <button type="button" className={styles.enquiryContact} data-tone="green" disabled={owned || desktop}
              onClick={()=>setEnquiryCompose(true)}>
              <span className={styles.enquiryContactIcon}><Icon kind="message" /></span><span><strong>Aim4price</strong><small>{owned ? "Your own list" : desktop ? "Account holder only" : "Send to dealer’s Leads"}</small></span>
            </button>
            {dealer.phone && <a className={styles.enquiryContact} href={"tel:" + dealer.phone.replace(/[^+0-9]/g, "")}>
              <span className={styles.enquiryContactIcon}><Icon kind="phone" /></span><span><strong>Call</strong><small>{dealer.phone}</small></span>
            </a>}
            {dealer.email && <a className={styles.enquiryContact} data-tone="blue" onClick={e=>{if(!enquiryValid)e.preventDefault();}} aria-disabled={!enquiryValid}
              href={`mailto:${encodeURIComponent(dealer.email)}?subject=${encodeURIComponent("Parts enquiry: " + listName)}&body=${encodeURIComponent(enquiryText)}`}>
              <span className={styles.enquiryContactIcon}><Icon kind="mail" /></span><span><strong>Email</strong><small>{dealer.email}</small></span>
            </a>}
            {dealer.phone && <a className={styles.enquiryContact} data-tone="green" target="_blank" rel="noopener noreferrer" onClick={e=>{if(!enquiryValid)e.preventDefault();}} aria-disabled={!enquiryValid}
              href={"https://wa.me/" + dealer.phone.replace(/\D/g, "").replace(/^0/, "27") + "?text=" + encodeURIComponent(enquiryText)}>
              <span className={styles.enquiryContactIcon}><Icon kind="whatsapp" /></span><span><strong>WhatsApp</strong><small>Message dealer</small></span>
            </a>}
          </div>
          <p className={styles.enquiryHint}>Confirm price and availability with the dealer.</p>
        </section>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      {(enquiryCompose || ledgerHref) && <footer className={styles.enquiryFooter}>
        {ledgerHref && <a className={styles.enquiryLedger} href={ledgerHref}>Open client cost ledger <span aria-hidden="true">→</span></a>}
        {enquiryCompose && <button disabled={busy} onClick={()=>setEnquiryCompose(false)}>Back</button>}
        {enquiryCompose && !owned && <button className={styles.primary} disabled={desktop || busy || !enquiry.trim() || enquiry.length > messageLimit || !enquiryValid} onClick={()=>onSend({items:requestedParts.map(r=>({partNumber:r.partNumber,quantity:Number(r.quantity)})),message:enquiry,text:enquiryText})}><Icon kind="message" />{busy ? "Sending…" : "Send via Aim4price"}</button>}
      </footer>}
    </section>
  </div>,document.body);
}
