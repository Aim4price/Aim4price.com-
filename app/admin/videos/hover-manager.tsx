'use client';

import { useEffect, useRef, useState } from 'react';
import { hoverCards, maxScreenshotBytes, type HoverAudience } from '../../../lib/card-screenshot-policy';
import styles from './videos.module.css';

export type CardScreenshots = Record<HoverAudience, Record<string,string>>;

export default function HoverManager({screenshots, onChange, busy, setBusy}: {
  screenshots: CardScreenshots;
  onChange: (next: CardScreenshots) => void;
  busy: boolean;
  setBusy: (busy:boolean) => void;
}) {
  const [audience, setAudience] = useState<HoverAudience>('owner');
  const [selected, setSelected] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const editor = useRef<HTMLElement>(null);
  useEffect(() => { if (selected) editor.current?.scrollIntoView({block:'nearest'}); }, [selected]);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const card = hoverCards[audience].find(item => item.key === selected);
  const id = screenshots[audience][selected];
  function select(key:string) {
    setSelected(key); setFile(null); setMessage('');
  }
  function choose(candidate?:File) {
    if (!candidate || busy) return;
    if (!candidate.size || candidate.size > maxScreenshotBytes || !/\.(png|jpe?g)$/i.test(candidate.name)) {
      setFile(null); setMessage('Choose a PNG or JPEG screenshot up to 5 MB.'); return;
    }
    setMessage(''); setFile(candidate);
  }
  async function save(remove = false) {
    if (busy || (!remove && !file)) return;
    setBusy(true); setMessage('');
    const params = new URLSearchParams({audience, card:selected});
    if (id) params.set('previous', id);
    if (remove) params.set('action', 'remove');
    try {
      const response = await fetch('/api/admin/card-screenshots?' + params, {method:'POST', body:remove ? null : file});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Unable to save the screenshot.');
      const next = {...screenshots[audience]};
      if (result.id) next[selected] = result.id;
      else delete next[selected];
      onChange({...screenshots, [audience]:next}); setFile(null);
      setMessage(remove ? 'Screenshot removed.' : 'Screenshot published to this card.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the screenshot.');
    } finally { setBusy(false); }
  }
  return <section>
    <div className={styles.switcher} aria-label="Workspace audience">
      {(['owner','business'] as const).map(role => <button key={role} disabled={busy} aria-pressed={audience === role}
        onClick={() => { setAudience(role); select(''); }}>{role === 'owner' ? 'Owner' : 'Business'}</button>)}
    </div>
    <div className={styles.hoverGrid}>{hoverCards[audience].map(item => <button key={item.key} disabled={busy}
      aria-pressed={selected === item.key} onClick={() => select(item.key)}>
      <strong>{item.label}</strong><span>{screenshots[audience][item.key] ? 'Published' : 'Add screenshot'}</span>
    </button>)}</div>
    {card && <section ref={editor} className={styles.editor} key={audience + selected}>
      <div className={styles.title}><h2>{card.label}</h2><span className={styles.badge}>{audience === 'owner' ? 'Owner' : 'Business'}</span></div>
      <label className={styles.drop} onDragOver={event => event.preventDefault()} onDrop={event => {
        event.preventDefault(); choose(event.dataTransfer.files[0]);
      }}>
        Drop a screenshot or choose a file <span>PNG or JPEG · Up to 5 MB</span>
        <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" disabled={busy} onChange={event => { choose(event.target.files?.[0]); event.target.value=''; }}/>
      </label>
      {(preview || id) && <img className={styles.screenshot} alt={card.label + ' screenshot preview'} src={preview || '/workspace/screenshots/' + id + '?admin=1'}/>}
      <div className={styles.actions}>
        {file && <button className={styles.primary} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Publish screenshot'}</button>}
        {id && !file && <button disabled={busy} onClick={() => { if (window.confirm('Remove the screenshot from this card?')) void save(true); }}>Remove screenshot</button>}
      </div>
      {message && <p role="status">{message}</p>}
    </section>}
  </section>;
}
