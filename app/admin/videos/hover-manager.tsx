'use client';

import { useEffect, useRef, useState } from 'react';
import { hoverCards, maxRecordingBytes, type HoverAudience } from '../../../lib/hover-video-policy';
import styles from './videos.module.css';

export type HoverRecordings = Record<HoverAudience, Record<string,string>>;

export default function HoverManager({recordings, onChange, busy, setBusy}: {
  recordings: HoverRecordings;
  onChange: (next: HoverRecordings) => void;
  busy: boolean;
  setBusy: (busy:boolean) => void;
}) {
  const [audience, setAudience] = useState<HoverAudience>('dealer');
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
  const card = hoverCards.find(item => item.key === selected);
  const id = recordings[audience][selected];
  function select(key:string) {
    setSelected(key); setFile(null); setMessage('');
  }
  function choose(candidate?:File) {
    if (!candidate || busy) return;
    if (!candidate.size || candidate.size > maxRecordingBytes || !/\.(mp4|webm)$/i.test(candidate.name)) {
      setFile(null); setMessage('Choose an MP4 or WebM recording up to 25 MB.'); return;
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
      const response = await fetch('/api/admin/hover-videos?' + params, {method:'POST', body:remove ? null : file});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Unable to save the recording.');
      const next = {...recordings[audience]};
      if (result.id) next[selected] = result.id;
      else delete next[selected];
      onChange({...recordings, [audience]:next}); setFile(null);
      setMessage(remove ? 'Recording removed.' : 'Recording published to this card.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the recording.');
    } finally { setBusy(false); }
  }
  return <section>
    <div className={styles.switcher} aria-label="Workspace audience">
      {(['dealer','business'] as const).map(role => <button key={role} disabled={busy} aria-pressed={audience === role}
        onClick={() => { setAudience(role); select(''); }}>{role === 'dealer' ? 'Dealer' : 'Business'}</button>)}
    </div>
    <div className={styles.hoverGrid}>{hoverCards.map(item => <button key={item.key} disabled={busy}
      aria-pressed={selected === item.key} onClick={() => select(item.key)}>
      <strong>{item.label}</strong><span>{recordings[audience][item.key] ? 'Published' : 'Add recording'}</span>
    </button>)}</div>
    {card && <section ref={editor} className={styles.editor} key={audience + selected}>
      <div className={styles.title}><h2>{card.label}</h2><span className={styles.badge}>{audience === 'dealer' ? 'Dealer' : 'Business'}</span></div>
      <label className={styles.drop} onDragOver={event => event.preventDefault()} onDrop={event => {
        event.preventDefault(); choose(event.dataTransfer.files[0]);
      }}>
        Drop a recording or choose a file <span>MP4 or WebM · Up to 25 MB</span>
        <input type="file" accept=".mp4,.webm,video/mp4,video/webm" disabled={busy} onChange={event => { choose(event.target.files?.[0]); event.target.value=''; }}/>
      </label>
      {(preview || id) && <video key={preview || id} controls playsInline preload="metadata" src={preview || '/api/hover-videos/' + id + '?admin=1'}/>}
      <div className={styles.actions}>
        {file && <button className={styles.primary} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Publish recording'}</button>}
        {id && !file && <button disabled={busy} onClick={() => { if (window.confirm('Remove the recording from this card?')) void save(true); }}>Remove recording</button>}
      </div>
      {message && <p role="status">{message}</p>}
    </section>}
  </section>;
}
