'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExternalLeadAccess } from '../../lib/external-lead-access';
import { EXTERNAL_SHARE_OPTIONS, type ExternalSharePermission, type ExternalSharePermissions } from '../../lib/external-share-permissions';
import { buildWhatsAppShareUrl } from '../../lib/asset-external-share';
import type { LeadReport } from '../../lib/guest-leads';
import ExternalAccessRequests from './ExternalAccessRequests';
import LeadDocuments from './LeadDocuments';
import assetStyles from '../../app/asset-register/page.module.css';
import dialogStyles from '../AccountDialog.module.css';
import styles from './ExternalLeadActions.module.css';
export type ExternalLeadActionData = {
    token: string;
    permissions: ExternalSharePermissions;
    reports: LeadReport[];
    access: ExternalLeadAccess;
    reply?: {
        email: string;
        phone: string;
        name: string;
    };
};
export default function ExternalLeadActions({ token, permissions, reports, access, reply, assetIndex, serialNumber, replacementPrice }: ExternalLeadActionData & {
    assetIndex: number;
    serialNumber: string;
    replacementPrice: number | null;
}) {
    const router = useRouter();
    const [action, setAction] = useState<ExternalSharePermission | null>(null);
    const [draft, setDraft] = useState(''), [vat, setVat] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    const open = access === 'active' || access === 'owner';
    const returnTo = `/asset-share/${token}`;
    const choose = (key: ExternalSharePermission) => { setAction(key); setNotice(''); setVat(false); setDraft(key === 'serialNumber' ? serialNumber : String(replacementPrice ?? '')); };
    const selected = EXTERNAL_SHARE_OPTIONS.find(option => option.key === action);
    if (!action)
        return <>
    <div className={`${assetStyles.optionsGrid} ${assetStyles.ownerCommandGrid} ${dialogStyles.actions} ${styles.grid}`}>
      {EXTERNAL_SHARE_OPTIONS.filter(option => permissions[option.key]).map(option => <button key={option.key} type="button" className={`${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`} onClick={() => choose(option.key)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d={option.key === 'replacementPrice' ? 'M12 7v10m3-8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9' : option.key === 'serialNumber' ? 'M7 9h10M7 13h7M7 17h5' : option.key === 'documents' ? 'M12 7v10M8 13l4 4 4-4' : 'M8 8h8M8 12h8M8 16h5'}/></svg>
        <span><strong>{option.label}</strong><small>{option.key === 'reports' ? 'View selected reports.' : option.key === 'documents' ? 'For review' : 'Send for owner approval.'}</small></span>
      </button>)}
    </div>
    {reply && <div className={styles.actions}>{reply.email && <a className={styles.secondary} href={`mailto:${encodeURIComponent(reply.email)}?subject=${encodeURIComponent('Re: Aim4price asset enquiry')}`}>Email owner</a>}{reply.phone && <a className={styles.secondary} href={buildWhatsAppShareUrl({ subject: 'Asset enquiry', body: `Hello ${reply.name}, regarding your Aim4price asset enquiry.` }, reply.phone)} target="_blank" rel="noreferrer">WhatsApp owner</a>}</div>}
    {!Object.values(permissions).some(Boolean) && <p className={styles.hint}>The sender shared read-only asset details. No additional actions are enabled.</p>}
    {access === 'owner' && <><p className={styles.hint}>Owner preview. Recipients can only use the actions you selected.</p><ExternalAccessRequests token={token}/></>}
  </>;
    return <section className={styles.panel}>
    <button type="button" className={styles.back} onClick={() => { setAction(null); setNotice(''); }}>Back to Manage</button>
    <h3>{selected?.label}</h3>
    {!open ? <div className={styles.gate}>
      <h4>{access === 'request-access' ? 'Request access from the sender' : access === 'sign-in' ? 'Create your free Business account' : access === 'wrong-recipient' ? 'Use the invited account' : access === 'verify-email' ? 'Verify your email' : access === 'suspended' ? 'Account access is paused' : 'Business verification required'}</h4>
      <p>{access === 'request-access' ? 'Your business is verified. Ask the sender to approve your account for this enquiry. A forwarded link does not grant access to reports or updates.' : access === 'sign-in' ? 'Create an account or sign in. Aim4price must verify your business, and the sender must approve access to this enquiry. No subscription is required for a basic Business account.' : access === 'wrong-recipient' ? 'This link was shared with a different email. Switch to the invited account, or ask the sender for a new invitation.' : access === 'verify-email' ? 'Verify your email from your Business workspace, then return to this enquiry.' : access === 'suspended' ? 'Contact Aim4price to review your account status.' : 'Aim4price needs to verify your business. Add your business details and supporting information in your workspace.'}</p>
      <div className={styles.actions}>
        {access === 'request-access' ? <button type="button" className={styles.primary} disabled={busy} onClick={async()=>{setBusy(true);setNotice('');try{const r=await fetch(`/api/asset-share-links/${token}/access`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to request access.');setNotice('Access requested. The sender can approve you from Manage on this enquiry.');}catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}}>Request access</button> : access === 'sign-in' ? <><a className={styles.primary} href={`/business/join?returnTo=${encodeURIComponent(returnTo)}`}>Create free account</a><a className={styles.secondary} href={`/auth?returnTo=${encodeURIComponent(returnTo)}#login`}>Sign in</a></> : access === 'wrong-recipient' ? <button type="button" className={styles.primary} disabled={busy} onClick={async () => { setBusy(true); try {
            const r = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            if (!r.ok)
                throw Error('Unable to sign out.');
            location.assign(`/auth?returnTo=${encodeURIComponent(returnTo)}#login`);
        }
        catch (e) {
            setNotice(e instanceof Error ? e.message : 'Please try again.');
            setBusy(false);
        } }}>Switch account</button> : <a className={styles.primary} href={`/business?returnTo=${encodeURIComponent(returnTo)}`}>Open Business workspace</a>}
        <button type="button" className={styles.secondary} onClick={() => router.refresh()}>Check access again</button>
      </div>
    </div> : action === 'reports' ? <div className={styles.reports}>{reports.map(report => <a className={styles.secondary} key={report.id} href={`/api/asset-share-links/${token}/reports/${report.id}`} target="_blank" rel="noreferrer">{report.label}</a>)}{!reports.length && <p>No reports were attached.</p>}</div> : action === 'documents' ? <LeadDocuments token={token} owner={access === 'owner'}/> : access === 'owner' ? <p className={styles.hint}>The recipient enters a proposed {action === 'serialNumber' ? 'serial number' : 'replacement price'} here. You review and approve it from the asset register before anything changes.</p> : <form className={styles.form} onSubmit={async (e) => { e.preventDefault(); if (busy)
            return; setBusy(true); setNotice(''); try {
            const value = action === 'serialNumber' ? draft : Math.round(Number(draft) / (vat ? 1.15 : 1) * 100) / 100;
            const r = await fetch(`/api/asset-share-links/${token}/corrections`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetIndex, field: action === 'serialNumber' ? 'serialNumber' : 'replacementPriceExVat', value }) });
            const d = await r.json();
            if (!r.ok)
                throw Error(d.error || 'Unable to send the update.');
            setNotice('Sent to the owner for approval. The asset has not been changed.');
        }
        catch (e) {
            setNotice(e instanceof Error ? e.message : 'Please try again.');
        }
        finally {
            setBusy(false);
        } }}>
      <p className={styles.hint}>Your proposed update goes to the owner for approval.</p>
      <label>{action === 'serialNumber' ? 'Correct serial number' : `Replacement price · ZAR ${vat ? 'incl.' : 'excl.'} VAT`}<input required value={draft} onChange={e => setDraft(e.target.value)} type={action === 'serialNumber' ? 'text' : 'number'} maxLength={200} min={action === 'serialNumber' ? undefined : '0.01'} max={action === 'serialNumber' ? undefined : 999999999999} step={action === 'serialNumber' ? undefined : '0.01'}/></label>
      {action === 'replacementPrice' && <label className={styles.check}><input type="checkbox" checked={vat} onChange={e => { const incl = e.target.checked; setVat(incl); if (draft && Number.isFinite(Number(draft)))
            setDraft(String(Math.round(Number(draft) * (incl ? 1.15 : 1 / 1.15) * 100) / 100)); }}/>Amount includes VAT (15%)</label>}
      <button className={styles.primary} disabled={busy}>{busy ? 'Sending…' : 'Send for approval'}</button>
    </form>}
    {notice && <p role="status" className={styles.hint}>{notice}</p>}
  </section>;
}
