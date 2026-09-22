'use client';
import { useEffect, useState } from 'react';
import styles from './AssetShareLinkControl.module.css';
export default function AssetShareLinkControl({ assetIds, includePhotos, onChange }: {
  assetIds: string[]; includePhotos: boolean; onChange: (url: string) => void;
}) {
  const [token, setToken] = useState('');
  const [included, setIncluded] = useState(false);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const url = token ? `${window.location.origin}/asset-share/${token}` : '';
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ photos: includePhotos ? '1' : '0' });
    assetIds.forEach(id => params.append('assetId', id));
    fetch(`/api/asset-share-links?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Links are unavailable.'); return data; })
      .then(data => { setToken(data.share?.token || ''); setCreatedAt(data.share?.created_at || ''); })
      .catch(error => { if (!controller.signal.aborted) setStatus(error.message || 'Links are unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
    // Parent keys this control by the asset selection and photo choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function create() {
    setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/asset-share-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetIds, includePhotos }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the link.');
      setToken(data.share.token); setCreatedAt(data.share.created_at); setIncluded(true);
      onChange(`${window.location.origin}/asset-share/${data.share.token}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not create the link.'); }
    finally { setBusy(false); }
  }
  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setStatus('Link copied.');
    } catch { setStatus('Select and copy the link above.'); }
  }
  async function revoke() {
    setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/asset-share-links', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (!response.ok) throw new Error('Could not disable the link. Please try again.');
      setToken(''); setIncluded(false); onChange(''); setStatus('Link disabled. Previously sent links will no longer open.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not disable the link.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.panel} aria-label="Asset page link">
    <div><h4>Asset page link</h4><p>A simple, read-only snapshot. Anyone with the link can view it without signing in. No automatic expiry; you can disable it here.</p><p>{includePhotos ? 'Includes the selected asset photos.' : 'Asset details only. Turn on Include photos to add photos.'} Reports remain separate attachments.</p></div>
    {token ? <>
      <label className={styles.toggle}><input type="checkbox" checked={included} disabled={busy} onChange={event => { setIncluded(event.target.checked); onChange(event.target.checked ? url : ''); }} />Include link in message</label>
      <small>Snapshot saved {new Date(createdAt).toLocaleDateString('en-ZA')}. Disable and create a new link to share updated details.</small>
      <input className={styles.url} aria-label="Asset page URL" value={url} readOnly onFocus={event => event.target.select()} />
      <div className={styles.actions}><a href={url} target="_blank" rel="noreferrer">Preview</a><button type="button" disabled={busy} onClick={() => void copyLink()}>Copy link</button><button type="button" disabled={busy} onClick={() => void revoke()}>Disable link</button></div>
    </> : <button type="button" disabled={busy} onClick={() => void create()}>{busy ? 'Checking link…' : 'Create asset link'}</button>}
    {status && <small role="status">{status}</small>}
  </section>;
}
