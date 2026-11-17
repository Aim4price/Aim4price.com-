'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AD_DESIGN_FIELDS, AD_DESIGN_SIZES, MAX_DESIGN_ELEMENTS, createStarterAdDesign, createAdCustomDesign, createAdDesignElement, normalizeAdCustomDesign, resizeAdDesign, type AdCustomDesign, type AdDesignElement, type AdDesignField } from '../lib/ad-custom-design';
import { downloadMarketplaceAd, renderMarketplaceAdCanvas, type MarketplaceAdContent } from '../lib/marketplace-ad-renderer';
import StudioIcon from './StudioIcon';
import styles from './AdDesignEditor.module.css';

type Props = { value?: AdCustomDesign | null; content: MarketplaceAdContent; disabled?: boolean; onChange: (design: AdCustomDesign) => void };
export default function AdDesignEditor(props: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" disabled={props.disabled} className={styles.launch} onClick={() => setOpen(true)}><StudioIcon name="palette" />{props.value ? 'Open design editor' : 'Create your own'}</button>
    {open && createPortal(<DesignWorkspace {...props} onClose={() => setOpen(false)} />, document.body)}
  </>;
}
function DesignWorkspace({ value, content, onChange, onClose }: Props & { onClose: () => void }) {
  const initial = useRef(normalizeAdCustomDesign(value) ?? createAdCustomDesign());
  const [design, setDesign] = useState(initial.current);
  const current = useRef(design); current.current = design;
  const history = useRef<AdCustomDesign[]>([]), future = useRef<AdCustomDesign[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [guides, setGuides] = useState({ x: false, y: false });
  const dialog = useRef<HTMLDialogElement>(null), canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), upload = useRef<HTMLInputElement>(null);
  const gesture = useRef<{ before: AdCustomDesign; element: AdDesignElement; clientX: number; clientY: number; scale: number; resize: boolean } | null>(null);
  const [width, height] = AD_DESIGN_SIZES[design.size];
  const element = design.elements.find(e => e.id === selected);
  const dirty = JSON.stringify(design) !== JSON.stringify(initial.current);
  const previewContent = { ...content, brand: { ...content.brand, customDesign: design } };
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  useEffect(() => {
    let active = true;
    setRendering(true);
    // Use the same canvas renderer for editing, saved templates and exports.
    const timer = window.setTimeout(() => {
      const scratch = document.createElement('canvas');
      void renderMarketplaceAdCanvas(scratch, { ...content, brand: { ...content.brand, customDesign: design } }, { useBestPhotoFit: false }).then(() => {
        if (!active || !canvas.current) return;
        canvas.current.width = scratch.width; canvas.current.height = scratch.height;
        canvas.current.getContext('2d')?.drawImage(scratch, 0, 0);
      }).catch(() => { if (active) setError('The preview could not be drawn. Please try again.'); })
        .finally(() => { if (active) setRendering(false); });
    }, 30);
    return () => { active = false; window.clearTimeout(timer); };
  }, [design, content]);
  function commit(next: AdCustomDesign) {
    if (next.elements.reduce((n, e) => n + e.image.length, 0) > 2_000_000) { setError('The saved images are too large. Use a smaller image before duplicating.'); return; }
    const clean = normalizeAdCustomDesign(next)!;
    if (JSON.stringify(clean) === JSON.stringify(current.current)) return;
    history.current = [...history.current.slice(-39), current.current]; future.current = [];
    current.current = clean; setDesign(clean); setError('');
  }
  function undo(redo = false) {
    const from = redo ? future : history, to = redo ? history : future;
    const next = from.current.pop();
    if (next) { to.current.push(current.current); current.current = next; setDesign(next); setSelected(''); }
  }
  function patch(changes: Partial<AdDesignElement>) {
    commit({ ...design, elements: design.elements.map(e => e.id === selected ? { ...e, ...changes } : e) });
  }
  function add(kind: AdDesignElement['kind'], field?: AdDesignField, image = '') {
    if (design.elements.length >= MAX_DESIGN_ELEMENTS) { setError('This design can contain up to 40 elements.'); return; }
    const next = createAdDesignElement(kind, field); next.image = image;
    next.x += (design.elements.length % 8) * 24; next.y += (design.elements.length % 8) * 24;
    if (kind === 'photo' && !image) next.photoIndex = Math.min(3, design.elements.filter(e => e.kind === 'photo' && !e.image).length);
    commit({ ...design, elements: [...design.elements, next] }); setSelected(next.id);
  }
  function remove() { commit({ ...design, elements: design.elements.filter(e => e.id !== selected) }); setSelected(''); }
  function duplicate() {
    if (!element || design.elements.length >= MAX_DESIGN_ELEMENTS) return;
    const next = { ...element, id: createAdDesignElement(element.kind).id, x: element.x + 24, y: element.y + 24 };
    commit({ ...design, elements: [...design.elements, next] }); setSelected(next.id);
  }
  function layer(forward: boolean) {
    const elements = [...design.elements], index = elements.findIndex(e => e.id === selected), target = index + (forward ? 1 : -1);
    if (index < 0 || target < 0 || target >= elements.length) return;
    [elements[index], elements[target]] = [elements[target], elements[index]]; commit({ ...design, elements });
  }
  function start(event: PointerEvent, e: AdDesignElement, resize = false) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); setSelected(e.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { before: current.current, element: e, clientX: event.clientX, clientY: event.clientY, scale: width / (stage.current?.getBoundingClientRect().width || width), resize };
  }
  function move(event: PointerEvent) {
    const g = gesture.current; if (!g) return;
    const dx = (event.clientX - g.clientX) * g.scale, dy = (event.clientY - g.clientY) * g.scale;
    const e = { ...g.element }; let gx = false, gy = false;
    if (g.resize) { e.width = Math.max(24, Math.min(width - e.x, e.width + dx)); e.height = Math.max(24, Math.min(height - e.y, e.height + dy)); }
    else {
      e.x = Math.max(0, Math.min(width - e.width, e.x + dx)); e.y = Math.max(0, Math.min(height - e.height, e.y + dy));
      if (Math.abs(e.x + e.width / 2 - width / 2) < 10) { e.x = (width - e.width) / 2; gx = true; }
      if (Math.abs(e.y + e.height / 2 - height / 2) < 10) { e.y = (height - e.height) / 2; gy = true; }
    }
    const next = { ...g.before, elements: g.before.elements.map(item => item.id === e.id ? e : item) };
    current.current = next; setDesign(next); setGuides({ x: gx, y: gy });
  }
  function end(cancel = false) {
    const g = gesture.current; if (!g) return;
    gesture.current = null; setGuides({ x: false, y: false });
    if (cancel) { current.current = g.before; setDesign(g.before); }
    else if (JSON.stringify(g.before) !== JSON.stringify(current.current)) { history.current = [...history.current.slice(-39), g.before]; future.current = []; setDesign({ ...current.current }); }
  }
  function close() { if (!dirty || window.confirm('Discard the changes made in this editor?')) onClose(); }
  async function uploadImage(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10_000_000) { setError('Choose a PNG, JPEG or WebP image smaller than 10 MB.'); return; }
    setBusy(true); setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const scratch = document.createElement('canvas'), scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      scratch.width = Math.max(1, Math.round(bitmap.width * scale)); scratch.height = Math.max(1, Math.round(bitmap.height * scale));
      scratch.getContext('2d')!.drawImage(bitmap, 0, 0, scratch.width, scratch.height); bitmap.close();
      const image = scratch.toDataURL('image/webp', .82);
      if (image.length + design.elements.reduce((n, e) => n + e.image.length, 0) > 2_000_000) throw new Error('Your saved images are too large. Remove an image or upload a smaller one.');
      add('photo', undefined, image);
    } catch (e) { setError(e instanceof Error ? e.message : 'This image could not be opened.'); }
    finally { setBusy(false); if (upload.current) upload.current.value = ''; }
  }
  async function download() {
    setBusy(true); setError('');
    try {
      const output = document.createElement('canvas');
      await renderMarketplaceAdCanvas(output, previewContent, { useBestPhotoFit: false });
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(b => b ? resolve(b) : reject(new Error('PNG could not be created.')), 'image/png'));
      downloadMarketplaceAd(blob, 'my-advert-design.png');
    } catch { setError('The PNG could not be downloaded. Check your images and try again.'); }
    finally { setBusy(false); }
  }
  const numberControl = (label: string, key: 'x' | 'y' | 'width' | 'height' | 'fontSize', max: number) => element && <label>{label}<input type="number" min={key === 'x' || key === 'y' ? 0 : key === 'fontSize' ? 12 : 24} max={max} value={Math.round(element[key])} onChange={e => { if (e.target.value !== '') patch({ [key]: Number(e.target.value) }); }} /></label>;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="design-title" onCancel={e => { e.preventDefault(); close(); }} onKeyDown={e => {
    if ((e.target as HTMLElement).matches('input, textarea, select')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); }
  }}>
    <header className={styles.header}><div><h2 id="design-title">Make it your own</h2><p>Arrange your advert. Save the layout and reuse it for any asset.</p></div><button type="button" aria-label="Close design editor" onClick={close}>×</button></header>
    <div className={styles.toolbar}>
      <div className={styles.choices} aria-label="Advert size">{Object.keys(AD_DESIGN_SIZES).map(size => <button type="button" key={size} aria-pressed={design.size === size} onClick={() => commit(resizeAdDesign(design, size as AdCustomDesign['size']))}>{size.charAt(0).toUpperCase() + size.slice(1)}</button>)}</div>
      <button type="button" onClick={() => {
        if (design.elements.length && !window.confirm('Replace this canvas with a starter layout? You can undo this.')) return;
        commit(resizeAdDesign(createStarterAdDesign(content.brand.primaryColor, content.brand.accentColor), design.size)); setSelected('');
      }}>Starter layout</button>
      <label className={styles.color}>Background<input type="color" value={design.background} onChange={e => commit({ ...design, background: e.target.value })} /></label>
      <button type="button" disabled={!history.current.length} onClick={() => undo()}>Undo</button><button type="button" disabled={!future.current.length} onClick={() => undo(true)}>Redo</button>
    </div>
    <div className={styles.workspace}>
      <aside className={styles.panel}><h3>Add an element</h3><div className={styles.addGrid}>
        <button type="button" onClick={() => add('text')}><StudioIcon name="details" />Text</button>
        <button type="button" onClick={() => add('photo')}><StudioIcon name="image" />Asset photo</button>
        <button type="button" onClick={() => add('logo')}><StudioIcon name="image" />Logo</button>
        <button type="button" disabled={busy} onClick={() => upload.current?.click()}><StudioIcon name="image" />Upload image</button>
        <button type="button" onClick={() => add('rectangle')}>▭ Rectangle</button><button type="button" onClick={() => add('circle')}>○ Circle</button>
      </div><input ref={upload} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e => void uploadImage(e.target.files?.[0])} />
      <h3>Asset & contact details</h3><p>These fields fill in when you create an advert.</p><div className={styles.fields}>{Object.entries(AD_DESIGN_FIELDS).map(([key, label]) => <button type="button" key={key} onClick={() => add('text', key as AdDesignField)}>+ {label}</button>)}</div>
      <h3>Layers</h3><p>Top items appear in front. Select any layer to edit it.</p><div className={styles.layers}>{[...design.elements].reverse().map(e => <button type="button" key={e.id} aria-pressed={e.id === selected} onClick={() => setSelected(e.id)}>{e.field ? AD_DESIGN_FIELDS[e.field] : e.kind === 'text' ? e.text || 'Text' : e.kind === 'photo' ? e.image ? 'Uploaded image' : `Asset photo ${e.photoIndex + 1}` : e.kind}</button>)}</div></aside>
      <main className={styles.workarea}>
        <p className={styles.hint}>Drag to move · Drag the corner to resize · Arrow keys for fine adjustments</p>
        <div className={styles.stage} ref={stage} style={{ aspectRatio: `${width}/${height}`, maxWidth: design.size === 'portrait' ? 520 : design.size === 'square' ? 640 : 960 }} onPointerDown={e => { if (e.target === e.currentTarget || e.target === canvas.current) setSelected(''); }}>
          <canvas ref={canvas} width={width} height={height} aria-label="Custom advert preview" />
          {!design.elements.length ? <div className={styles.empty}><StudioIcon name="palette" /><strong>Your advert starts here</strong><span>Add a photo, a price or some text from the panel.</span></div> : null}
          {design.elements.map(e => <div key={e.id} role="button" tabIndex={0} aria-label={`Move ${e.field ? AD_DESIGN_FIELDS[e.field] : e.kind}`} aria-pressed={selected === e.id} className={`${styles.element} ${selected === e.id ? styles.selected : ''}`} style={{ left: `${e.x / width * 100}%`, top: `${e.y / height * 100}%`, width: `${e.width / width * 100}%`, height: `${e.height / height * 100}%` }} onFocus={() => setSelected(e.id)} onPointerDown={event => start(event, e)} onPointerMove={move} onPointerUp={() => end()} onPointerCancel={() => end(true)} onLostPointerCapture={() => end()} onKeyDown={event => {
            const delta = event.shiftKey ? 10 : 1;
            const arrows: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
            if (arrows[event.key]) { event.preventDefault(); const [x, y] = arrows[event.key]; patch({ x: e.x + x, y: e.y + y }); }
            if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(); }
          }}>{selected === e.id ? <span className={styles.resize} aria-hidden="true" onPointerDown={event => start(event, e, true)} /> : null}</div>)}
          {guides.x ? <i className={styles.guideX} /> : null}{guides.y ? <i className={styles.guideY} /> : null}
        </div>
        <p className={styles.hint} role="status">{rendering ? 'Updating preview…' : `${width} × ${height} px · ${design.elements.length} elements`}</p>
      </main>
      <aside className={styles.panel}><h3>{element ? 'Edit selected element' : 'Element settings'}</h3>{element ? <>
        {element.field ? <p><strong>{AD_DESIGN_FIELDS[element.field]}</strong> updates for each advert.</p> : null}
        {element.kind === 'text' ? <>
          {!element.field ? <label>Wording<textarea value={element.text} maxLength={1000} rows={3} onChange={e => patch({ text: e.target.value })} /></label> : null}
          {numberControl('Text size', 'fontSize', 240)}
          <div className={styles.choices} aria-label="Font">{(['Arial', 'Georgia', 'Montserrat'] as const).map(font => <button type="button" key={font} aria-pressed={element.font === font} onClick={() => patch({ font })}>{font}</button>)}</div>
          <button type="button" aria-pressed={element.bold} onClick={() => patch({ bold: !element.bold })}>Bold</button>
          <div className={styles.choices} aria-label="Text alignment">{(['left', 'center', 'right'] as const).map(align => <button type="button" key={align} aria-pressed={element.align === align} onClick={() => patch({ align })}>{align}</button>)}</div>
          <p>Long wording automatically reduces to fit the box.</p>
        </> : null}
        {['text', 'rectangle', 'circle'].includes(element.kind) ? <label className={styles.color}>Colour<input type="color" value={element.color} onChange={e => patch({ color: e.target.value })} /></label> : null}
        {element.kind === 'photo' || element.kind === 'logo' ? <>
          {element.kind === 'photo' && !element.image ? <div className={styles.choices} aria-label="Photo slot">{[0, 1, 2, 3].map(i => <button type="button" key={i} aria-pressed={element.photoIndex === i} onClick={() => patch({ photoIndex: i })}>Photo {i + 1}</button>)}</div> : null}
          {element.kind === 'logo' ? <p>Your logo comes from the template’s Details step.</p> : null}
          <div className={styles.choices}><button type="button" aria-pressed={element.fit === 'cover'} onClick={() => patch({ fit: 'cover' })}>Fill frame</button><button type="button" aria-pressed={element.fit === 'contain'} onClick={() => patch({ fit: 'contain' })}>Fit image</button></div>
          <label>Horizontal crop<input type="range" min={0} max={100} value={element.cropX} onChange={e => patch({ cropX: Number(e.target.value) })} /></label><label>Vertical crop<input type="range" min={0} max={100} value={element.cropY} onChange={e => patch({ cropY: Number(e.target.value) })} /></label>
        </> : null}
        <div className={styles.numbers}>{numberControl('Left', 'x', width - element.width)}{numberControl('Top', 'y', height - element.height)}{numberControl('Width', 'width', width)}{numberControl('Height', 'height', height)}</div>
        <div className={styles.choices}><button type="button" onClick={() => patch({ x: (width - element.width) / 2 })}>Centre horizontally</button><button type="button" onClick={() => patch({ y: (height - element.height) / 2 })}>Centre vertically</button></div>
        <div className={styles.choices}><button type="button" onClick={() => layer(true)}>Bring forward</button><button type="button" onClick={() => layer(false)}>Send backward</button></div>
        <div className={styles.choices}><button type="button" disabled={design.elements.length >= MAX_DESIGN_ELEMENTS} onClick={duplicate}>Duplicate</button><button type="button" className={styles.delete} onClick={remove}>Delete</button></div>
      </> : <p>Select an element on the advert or in Layers to change its appearance.</p>}</aside>
    </div>
    <footer className={styles.footer}><div>{error ? <p role="alert" className={styles.error}>{error}</p> : <p>Sample asset details are for preview. Choose “Use design”, then save your template.</p>}</div><button type="button" disabled={busy || !design.elements.length} onClick={() => void download()}><StudioIcon name="download" />Download preview</button><button type="button" className={styles.primary} disabled={busy || !design.elements.length} onClick={() => { onChange(normalizeAdCustomDesign(design)!); onClose(); }}>Use design</button></footer>
  </dialog>;
}
