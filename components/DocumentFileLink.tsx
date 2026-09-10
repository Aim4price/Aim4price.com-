'use client';

import { useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { appRealmForPath } from '../lib/app-realm';

/** Fetch with the current workspace credentials before opening a private file. */
export default function DocumentFileLink({ href = '', children, fuelDocument = false, fuelSource, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { fuelDocument?: boolean; fuelSource?: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function open(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const download = Boolean(props.download);
    const tab = download ? null : window.open('about:blank', '_blank');
    if (!download && !tab) { setError('Allow pop-ups to open this document.'); return; }
    if (tab) { tab.opener = null; tab.document.body.textContent = 'Opening document…'; }
    setBusy(true);
    try {
      const source = new URL(href, window.location.origin);
      // Historic links can contain a previous host. Internal document paths are
      // resolved against the active site; credentials never go to another host.
      const url = fuelDocument
        ? new URL('/api/fuel/documents/download', window.location.origin)
        : new URL(source.pathname + source.search, window.location.origin);
      if (fuelDocument) {
        const original = new URL(href, window.location.origin);
        original.searchParams.delete('accountantShareId');
        original.searchParams.delete('accountantRegisterId');
        url.searchParams.set('source', fuelSource || (href.startsWith('/') ? original.pathname + original.search + original.hash : original.toString()));
      }
      const current = new URL(window.location.href);
      for (const key of ['accountantShareId', 'accountantRegisterId']) {
        const value = source.searchParams.get(key) || current.searchParams.get(key);
        if (value) url.searchParams.set(key, value);
      }
      const response = await fetch(url, { credentials: 'include', cache: 'no-store',
        headers: { 'x-aim4price-client-realm': appRealmForPath(window.location.pathname) || 'website' } });
      if (!response.ok) throw new Error(response.status === 401
        ? 'Please sign in again to open this document.'
        : response.status === 503 ? 'The file store is temporarily unavailable. Please try again.'
          : 'This document could not be opened. Its original file may be missing or you may no longer have access.');
      const blob = await response.blob();
      if (!blob.size || /text\/html|application\/json/i.test(blob.type)) throw new Error('The document link did not return a file. Please try again.');
      const blobUrl = URL.createObjectURL(blob);
      if (tab) tab.location.replace(blobUrl);
      else {
        const link = document.createElement('a');
        link.href = blobUrl;
        const disposition = response.headers.get('content-disposition') || '';
        const name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || disposition.match(/filename="([^"]+)"/i)?.[1];
        try { link.download = typeof props.download === 'string' ? props.download : decodeURIComponent(name || 'document'); }
        catch { link.download = 'document'; }
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (cause) {
      tab?.close();
      setError(cause instanceof Error ? cause.message : 'Could not open this document.');
    } finally { setBusy(false); }
  }

  return <>
    <a {...props} rel="noopener" referrerPolicy="same-origin" href={href} onClick={open} aria-disabled={busy}>{busy ? 'Opening…' : children}</a>
    {error ? <span role="alert">{error}</span> : null}
  </>;
}
