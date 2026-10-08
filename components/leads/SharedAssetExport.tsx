'use client';

import { useState } from 'react';
import { createPortal } from '../WebsitePortal';
import LeadActionDialog from './LeadActionDialog';
import { exportFilename, exportZip, saveExport } from '../../lib/shared-file-download';
import styles from './SharedAssetExport.module.css';

export type ExportAttachment = { url: string; name: string };
type Props = { title: string; photos: string[]; details?: string; attachments?: ExportAttachment[] };

export default function SharedAssetExport(props: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4M9 14l6 4"/></svg>
      Share / Download
    </button>
    {open && createPortal(<ExportDialog key={JSON.stringify([props.title, props.photos, props.details, props.attachments])} {...props} onClose={() => setOpen(false)}/>, document.body)}
  </>;
}

function ExportDialog({ title, photos, details, attachments = [], onClose }: Props & { onClose: () => void }) {
  const items = [
    ...Array.from(new Set(photos)).map((url, index) => ({ url, name: `Photo ${index + 1}`, photo: true })),
    ...attachments.map(item => ({ ...item, photo: false })),
  ];
  const [selected, setSelected] = useState<number[]>([]);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [download, setDownload] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [canShare, setCanShare] = useState(false);
  function reset() { setFiles([]); setDownload(null); setNotice(''); }
  async function prepare() {
    setBusy(true); reset();
    try {
      const prepared: File[] = [];
      let bytes = 0;
      for (const index of selected) {
        const item = items[index];
        const url = new URL(item.url, window.location.href);
        if (!['https:', 'http:', 'blob:', 'data:'].includes(url.protocol)) throw Error('This file cannot be downloaded.');
        if (url.username || url.password) throw Error('This file URL is not supported.');
        const response = await fetch(url.href, { credentials: url.origin === window.location.origin ? 'same-origin' : 'omit', cache: 'no-store' });
        if (!response.ok) throw Error(`${item.name} is unavailable. Refresh the enquiry and try again.`);
        if (Number(response.headers.get('content-length')) > 100 * 1024 * 1024 - bytes) throw Error('Choose fewer files at a time (up to 100 MB).');
        const blob = await response.blob();
        if (!blob.size || /text\/html|application\/json/.test(blob.type)) throw Error(`${item.name} could not be downloaded. Please sign in again or refresh the enquiry.`);
        bytes += blob.size;
        if (bytes > 100 * 1024 * 1024) throw Error('Choose fewer files at a time (up to 100 MB).');
        const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','application/pdf':'pdf'} as Record<string,string>)[blob.type];
        const name = item.photo ? `${title}-photo-${index + 1}.${ext || 'jpg'}` : `${index + 1}-${item.name}${ext && !item.name.toLowerCase().endsWith('.' + ext) ? '.' + ext : ''}`;
        prepared.push(new File([blob], exportFilename(name), { type: blob.type || 'application/octet-stream' }));
      }
      if (includeDetails && details) prepared.push(new File([`${title}\n\n${details}\n\nExported from Aim4price on ${new Date().toLocaleDateString('en-ZA')}.\nThis is a downloaded copy; it will not update automatically.\n`], 'asset-details.txt', { type: 'text/plain' }));
      if (!prepared.length) throw Error('Choose at least one item.');
      setDownload(prepared.length === 1 ? prepared[0] : await exportZip(prepared));
      setFiles(prepared);
      let supported = false;
      try { supported = !!navigator.share && !!navigator.canShare?.({ files: prepared }); } catch { /* Download remains available. */ }
      setCanShare(supported);
      setNotice(supported ? 'Your files are ready. Choose Download or Share outside Aim4price.' : 'Your files are ready. Download them, then attach them in WhatsApp or email. This browser does not support sharing these files directly.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not prepare the files. Please try again.');
    } finally { setBusy(false); }
  }
  async function share() {
    setBusy(true);
    try { await navigator.share({ files, title }); setNotice('Files handed to your device’s share menu.'); }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setNotice('Sharing is unavailable. Download the files and attach them in WhatsApp or email.'); }
    finally { setBusy(false); }
  }
  return <LeadActionDialog title="Share / Download" assetTitle={title} busy={busy} onClose={onClose} className={styles.dialog} footer={<>
    {download ? <><button className={styles.primary} disabled={busy} onClick={() => saveExport(download, files.length === 1 ? files[0].name : `${title}.zip`)}>Download {files.length > 1 ? 'ZIP' : 'file'}</button><button className={styles.secondary} disabled={busy || !canShare} onClick={() => void share()}>Share outside Aim4price</button></> : <button className={styles.primary} disabled={busy || (!selected.length && !includeDetails)} onClick={() => void prepare()}>{busy ? 'Preparing files…' : 'Prepare selected files'}</button>}
  </>}>
    <p className={styles.intro}>Choose what to download or send outside Aim4price. Only the information available to you is included.</p>
    <div className={styles.selection}>
      <button type="button" disabled={busy} onClick={() => { reset(); setSelected(items.map((_, i) => i)); setIncludeDetails(!!details); }}>Select all</button>
      <button type="button" disabled={busy} onClick={() => { reset(); setSelected([]); setIncludeDetails(false); }}>Clear selection</button>
      <span>{selected.length + Number(includeDetails)} selected</span>
    </div>
    <div className={styles.items}>
      {details && <label className={styles.item}><input type="checkbox" checked={includeDetails} disabled={busy} onChange={event => { reset(); setIncludeDetails(event.target.checked); }}/><span><strong>Asset details</strong><small>Text file with the visible asset information</small></span></label>}
      {items.map((item, index) => <label className={styles.item} key={item.url + index}><input type="checkbox" checked={selected.includes(index)} disabled={busy} onChange={() => { reset(); setSelected(current => current.includes(index) ? current.filter(i => i !== index) : [...current, index]); }}/>{item.photo && <img src={item.url} alt=""/>}<span><strong>{item.name}</strong><small>{item.photo ? 'Original photo' : 'Shared file'}</small></span></label>)}
    </div>
    {!items.length && !details && <p>No files are available to download.</p>}
    <p className={styles.hint}>Downloaded or forwarded copies can be kept by their recipients, even if access to this enquiry is later revoked.</p>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </LeadActionDialog>;
}
