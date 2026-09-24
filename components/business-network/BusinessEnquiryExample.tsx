'use client';
import { useState } from 'react';
import SharedAssetCards from '../asset-register/SharedAssetCards';
import styles from '../asset-register/GuestLead.module.css';

// No lead token, real contact details, API calls or file inputs in this demo.
const exampleShare = {
  createdAt: '2026-01-01T12:00:00.000Z',
  assets: [{ title: 'Example Toyota Hilux', serialNumber: 'DEMO-001', yearModel: 2022, usage: '85 000 km', condition: 'Good', valueExVat: 320000, replacementPriceExVat: 475000, photoUrls: ['/brand/home-asset-hilux.webp'], publicUrl: null }],
};
export default function BusinessEnquiryExample({ senderName = '' }: { senderName?: string }) {
  const [notice, setNotice] = useState('');
  const returnUrl = `/business-network/accept${senderName ? `?from=${encodeURIComponent(senderName)}` : ''}`;
  return <>
    <div className={styles.panel}><a href={returnUrl}>← Back to the free listing</a></div>
    <SharedAssetCards example share={exampleShare} request={<section className={styles.panel}>
      <h2>Example request from X Farms</h2>
      <p>Please quote for the next service on this bakkie. Let me know when you can assist.</p>
    </section>} actions={<section className={styles.panel}>
      <h2>Try the options</h2>
      <div className={styles.actions}>
        <button type="button" onClick={() => setNotice('In a real enquiry, this opens your email app with the owner’s address and a reference to the shared asset.')}>Reply by email</button>
        <button type="button" onClick={() => setNotice('In a real enquiry, this opens WhatsApp to the contact number the owner has chosen to share.')}>Reply on WhatsApp</button>
        <button type="button" onClick={() => setNotice('When the owner allows uploads, you can submit an invoice or quote against this asset. The owner reviews it before adding it to their records. This example does not upload files.')}>Send an invoice or quote</button>
        <button type="button" onClick={() => setNotice('Shared reports stay protected. On a real enquiry, the business confirms its identity and needs the appropriate access before opening them.')}>View a shared report 🔒</button>
      </div>
      {notice && <p role="status">{notice}</p>}
      <small>Demo only. No messages or documents are sent.</small>
      <a href={returnUrl}>Add my free business listing →</a>
    </section>}/>
  </>;
}
