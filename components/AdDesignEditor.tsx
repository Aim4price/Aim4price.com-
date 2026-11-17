'use client';

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from './WebsitePortal';
import { AD_DESIGN_FIELDS, AD_DESIGN_SIZES, MAX_DESIGN_ELEMENTS, createStarterAdDesign, createAdCustomDesign, createAdDesignElement, normalizeAdCustomDesign, resizeAdDesign, resizeAdElementFromCorner, type AdCustomDesign, type AdDesignElement, type AdDesignField } from '../lib/ad-custom-design';
import { downloadMarketplaceAd, renderMarketplaceAdCanvas, type MarketplaceAdContent } from '../lib/marketplace-ad-renderer';
import StudioIcon from './StudioIcon';
import styles from './AdDesignEditor.module.css';

type EditorIconName = 'text' | 'rectangle' | 'circle' | 'layers' | 'undo' | 'redo' | 'minus' | 'fit' | 'hand' | 'select' | 'horizontal' | 'vertical';
function EditorIcon({ name }: { name: EditorIconName }) {
  const paths: Record<EditorIconName, string> = {
    text: 'M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3', rectangle: 'M4 5h16v14H4Z',
    circle: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0', layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
    undo: 'M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14', redo: 'm16 4 5 5-5 5M21 9H11a7 7 0 0 0 0 14',
    minus: 'M5 12h14', fit: 'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h8v8H8Z',
    hand: 'M8 12V5a2 2 0 0 1 4 0v7-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2Z',
    select: 'm5 3 14 10-7 1-3 7L5 3Z', horizontal: 'M12 3v18M5 8h14v8H5Z', vertical: 'M3 12h18M8 5h8v14H8Z',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function elementLabel(e: AdDesignElement) {
  return e.field ? AD_DESIGN_FIELDS[e.field] : e.kind === 'text' ? e.text || 'Text' : e.kind === 'photo' ? e.image ? 'Uploaded image' : `Asset photo ${e.photoIndex + 1}` : e.kind.charAt(0).toUpperCase() + e.kind.slice(1);
}

function NumberField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  useEffect(() => setDraft(String(Math.round(value))), [value]);
  return <label>{label}<input type="number" min={min} max={max} value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => {
    const next = draft.trim() && Number.isFinite(Number(draft)) ? Math.max(min, Math.min(max, Number(draft))) : value;
    setDraft(String(Math.round(next))); onCommit(next);
  }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} /></label>;
}

type Props = { value?: AdCustomDesign | null; content: MarketplaceAdContent; disabled?: boolean; onChange: (design: AdCustomDesign) => void };
export default function AdDesignEditor(props: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" disabled={props.disabled} className={styles.launch}
      aria-label={props.value ? 'Open design editor' : 'Create your own'} onClick={() => setOpen(true)}>
      <span className={styles.launchIcon} aria-hidden="true"><StudioIcon name="palette" /></span>
      <span className={styles.launchCopy}>
        <strong>{props.value ? 'Open design editor' : 'Create your own'}</strong>
        <span>{props.value ? 'Move, resize and style your advert.' : 'Start blank or customise a starter layout.'}</span>
      </span>
      <span className={styles.launchArrow} aria-hidden="true"><StudioIcon name="next" /></span>
    </button>
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
  const [toolPanel, setToolPanel] = useState<'add' | 'layers'>('add');
  const [addCategory, setAddCategory] = useState<'basics' | 'asset' | 'business'>('basics');
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'arrange'>('appearance');
  const [panMode, setPanMode] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const libraryScroll = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null), settings = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number; ratio: number } | null>(null);
  const zoomAnchor = useRef<{ x: number; y: number } | null>(null);
  const previousView = useRef<{ scale: number; width: number; height: number; viewWidth: number; viewHeight: number } | null>(null);
  const [guides, setGuides] = useState({ x: false, y: false });
  const dialog = useRef<HTMLDialogElement>(null), canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null), upload = useRef<HTMLInputElement>(null);
  const gesture = useRef<{ before: AdCustomDesign; element: AdDesignElement; clientX: number; clientY: number; scale: number; resize: false | 'nw' | 'ne' | 'sw' | 'se' } | null>(null);
  const [width, height] = AD_DESIGN_SIZES[design.size];
  const fitScale = Math.max(.01, Math.min((viewSize.width - 64) / width, (viewSize.height - 64) / height, 1));
  const scale = zoom ?? fitScale;
  const element = design.elements.find(e => e.id === selected);
  const dirty = JSON.stringify(design) !== JSON.stringify(initial.current);
  const previewContent = { ...content, brand: { ...content.brand, customDesign: design } };
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const node = viewport.current; if (!node) return;
    const observer = new ResizeObserver(() => setViewSize({ width: node.clientWidth, height: node.clientHeight }));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const node = viewport.current, old = previousView.current;
    if (node && old && zoom !== null) {
      // Keep the point at the centre of the view in place as the user zooms.
      const x = zoomAnchor.current?.x ?? (node.scrollLeft + old.viewWidth / 2 - Math.max(32, (old.viewWidth - old.width * old.scale) / 2)) / old.scale;
      const y = zoomAnchor.current?.y ?? (node.scrollTop + old.viewHeight / 2 - Math.max(32, (old.viewHeight - old.height * old.scale) / 2)) / old.scale;
      node.scrollLeft = x * scale + Math.max(32, (viewSize.width - width * scale) / 2) - viewSize.width / 2;
      node.scrollTop = y * scale + Math.max(32, (viewSize.height - height * scale) / 2) - viewSize.height / 2;
    } else if (node) { node.scrollLeft = 0; node.scrollTop = 0; }
    zoomAnchor.current = null;
    previousView.current = { scale, width, height, viewWidth: viewSize.width, viewHeight: viewSize.height };
  }, [scale, zoom, width, height, viewSize]);
  useEffect(() => { settings.current?.scrollTo({ top: 0 }); }, [selected, settingsTab]);
  useEffect(() => { libraryScroll.current?.scrollTo({ top: 0 }); }, [toolPanel, addCategory]);
  function changeZoom(delta: number) {
    const node = viewport.current;
    if (node) zoomAnchor.current = {
      x: (node.scrollLeft + node.clientWidth / 2 - Math.max(32, (node.clientWidth - width * scale) / 2)) / scale,
      y: (node.scrollTop + node.clientHeight / 2 - Math.max(32, (node.clientHeight - height * scale) / 2)) / scale,
    };
    setZoom(Math.max(.1, Math.min(2, Math.round((scale + delta) * 100) / 100)));
  }
  function fitView() { setZoom(null); viewport.current?.scrollTo({ left: 0, top: 0 }); }
  function starter() {
    if (design.elements.length && !window.confirm('Replace this canvas with a starter layout? You can undo this.')) return;
    commit(resizeAdDesign(createStarterAdDesign(content.brand.primaryColor, content.brand.accentColor), design.size)); setSelected(''); setSettingsTab('appearance'); fitView();
  }
  function selectLayer(e: AdDesignElement) {
    setSelected(e.id); setPanMode(false);
    const node = viewport.current; if (!node) return;
    node.scrollTo({ left: (e.x + e.width / 2) * scale + Math.max(32, (node.clientWidth - width * scale) / 2) - node.clientWidth / 2,
      top: (e.y + e.height / 2) * scale + Math.max(32, (node.clientHeight - height * scale) / 2) - node.clientHeight / 2 });
  }
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
    if (next) { to.current.push(current.current); current.current = next; setDesign(next); setSelected(id => next.elements.some(e => e.id === id) ? id : ''); }
  }
  function patch(changes: Partial<AdDesignElement>) {
    commit({ ...design, elements: design.elements.map(e => e.id === selected ? { ...e, ...changes } : e) });
  }
  function add(kind: AdDesignElement['kind'], field?: AdDesignField, image = '') {
    if (design.elements.length >= MAX_DESIGN_ELEMENTS) { setError('This design can contain up to 40 elements.'); return; }
    const next = createAdDesignElement(kind, field); next.image = image; next.font = 'Montserrat';
    if (kind === 'photo' && !design.elements.some(e => e.kind === 'photo')) { next.width = Math.round(width * .6); next.height = Math.round(height * .6); }
    if (kind === 'circle') next.height = next.width;
    next.width = Math.min(next.width, width); next.height = Math.min(next.height, height);
    next.x = (width - next.width) / 2 + (design.elements.length % 5) * 16;
    next.y = (height - next.height) / 2 + (design.elements.length % 5) * 16;
    if (kind === 'photo' && !image) next.photoIndex = Math.min(3, design.elements.filter(e => e.kind === 'photo' && !e.image).length);
    commit({ ...design, elements: [...design.elements, next] }); setSelected(next.id); setPanMode(false); setSettingsTab('appearance');
    requestAnimationFrame(() => selectLayer(next));
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
  function start(event: PointerEvent, e: AdDesignElement, resize: false | 'nw' | 'ne' | 'sw' | 'se' = false) {
    if (event.button !== 0 || panMode) return;
    event.preventDefault(); event.stopPropagation(); setSelected(e.id);
    (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-design-element]')?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { before: current.current, element: current.current.elements.find(item => item.id === e.id) ?? e, clientX: event.clientX, clientY: event.clientY, scale: width / (stage.current?.getBoundingClientRect().width || width), resize };
  }
  function move(event: PointerEvent) {
    const g = gesture.current; if (!g) return;
    const dx = (event.clientX - g.clientX) * g.scale, dy = (event.clientY - g.clientY) * g.scale;
    let e = { ...g.element }; let gx = false, gy = false;
    if (g.resize) { e = resizeAdElementFromCorner(e, g.resize, dx, dy, width, height); }
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
  const numberControl = (label: string, key: 'x' | 'y' | 'width' | 'height' | 'fontSize', max: number) => element && <NumberField key={`${element.id}-${key}`} label={label} min={key === 'x' || key === 'y' ? 0 : key === 'fontSize' ? 12 : 24} max={max} value={element[key]} onCommit={value => patch({ [key]: value })} />;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="design-title" onCancel={e => { e.preventDefault(); close(); }} onKeyDown={e => {
    if ((e.target as HTMLElement).matches('input, textarea, select')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); changeZoom(.1); }
      if (e.key === '-') { e.preventDefault(); changeZoom(-.1); }
      if (e.key === '0') { e.preventDefault(); fitView(); }
    }
  }}>
    <header className={styles.header}>
      <div className={styles.titleGroup}><span className={styles.titleIcon}><StudioIcon name="palette" /></span><div><h2 id="design-title">Make it your own</h2></div></div>
      <div className={styles.history} role="group" aria-label="Edit history"><button type="button" title="Undo (Ctrl+Z)" disabled={!history.current.length} onClick={() => undo()}><EditorIcon name="undo" />Undo</button><button type="button" title="Redo (Ctrl+Shift+Z)" disabled={!future.current.length} onClick={() => undo(true)}><EditorIcon name="redo" />Redo</button></div>
      <button type="button" data-modal-close="true" aria-label="Close design editor" onClick={close}>×</button>
    </header>
    <div className={styles.toolbar}>
      <div className={styles.toolbarGroup}><span className={styles.controlLabel}>Format</span><div className={styles.segmented} role="group" aria-label="Advert size">{Object.keys(AD_DESIGN_SIZES).map(size => <button type="button" key={size} aria-pressed={design.size === size} onClick={() => { commit(resizeAdDesign(design, size as AdCustomDesign['size'])); fitView(); }}>{size.charAt(0).toUpperCase() + size.slice(1)}</button>)}</div></div>
      <label className={styles.color}>Background<input type="color" value={design.background} onChange={e => commit({ ...design, background: e.target.value })} /></label>
      <button type="button" onClick={starter}><StudioIcon name="layout" />Starter layout</button>
      <div className={styles.viewControls}>
        <div className={styles.segmented} role="group" aria-label="Canvas tool"><button type="button" aria-label="Select elements" title="Select and move elements" aria-pressed={!panMode} onClick={() => setPanMode(false)}><EditorIcon name="select" /></button><button type="button" aria-label="Pan canvas" title="Drag to move around the canvas" aria-pressed={panMode} onClick={() => setPanMode(true)}><EditorIcon name="hand" /></button></div>
        <div className={styles.zoomControls} role="group" aria-label="Canvas zoom"><button type="button" aria-label="Zoom out" title="Zoom out (Ctrl+−)" disabled={scale <= .1} onClick={() => changeZoom(-.1)}><EditorIcon name="minus" /></button><output aria-label="Zoom level">{Math.round(scale * 100)}%</output><button type="button" aria-label="Zoom in" title="Zoom in (Ctrl++)" disabled={scale >= 2} onClick={() => changeZoom(.1)}><StudioIcon name="plus" /></button><button type="button" title="Fit the whole advert (Ctrl+0)" aria-pressed={zoom === null} onClick={fitView}><EditorIcon name="fit" />Fit</button></div>
      </div>
    </div>
    <div className={styles.workspace}>
      <aside className={styles.library} aria-label="Design tools">
        <div className={styles.panelTabs} role="group" aria-label="Tool panel"><button type="button" aria-pressed={toolPanel === 'add'} onClick={() => setToolPanel('add')}><StudioIcon name="plus" />Add elements</button><button type="button" aria-pressed={toolPanel === 'layers'} onClick={() => setToolPanel('layers')}><EditorIcon name="layers" />Layers</button></div>
        {toolPanel === 'add' ? <div className={styles.categoryTabs} role="group" aria-label="Element categories">{(['basics', 'asset', 'business'] as const).map(category => <button type="button" key={category} aria-pressed={addCategory === category} onClick={() => setAddCategory(category)}>{category === 'basics' ? 'Basics' : category === 'asset' ? 'Asset' : 'Business'}</button>)}</div> : null}
        <div ref={libraryScroll} className={styles.panelScroll}>
        {toolPanel === 'add' ? <>
          {addCategory === 'basics' ? <section className={styles.section}><h3>Add an element</h3><p>Click to add. Drag into place.</p><div className={styles.addGrid}>
            <button type="button" onClick={() => add('text')}><EditorIcon name="text" />Text</button>
            <button type="button" onClick={() => add('photo')}><StudioIcon name="image" />Asset photo</button>
            <button type="button" onClick={() => add('logo')}><StudioIcon name="star" />Logo</button>
            <button type="button" aria-label="Upload image" disabled={busy} onClick={() => upload.current?.click()}><StudioIcon name="image-add" />Upload</button>
            <button type="button" onClick={() => add('rectangle')}><EditorIcon name="rectangle" />Rectangle</button><button type="button" onClick={() => add('circle')}><EditorIcon name="circle" />Circle</button>
          </div></section> : null}
          {addCategory === 'asset' ? <section className={styles.section}><h3>Asset details</h3><p>These fill in for each advert.</p><div className={styles.fields}>{(['title','price','year','usage','condition'] as const).map(key => <button type="button" key={key} onClick={() => add('text', key)}><StudioIcon name={key === 'price' ? 'price' : 'plus'} />{AD_DESIGN_FIELDS[key]}</button>)}</div></section> : null}
          {addCategory === 'business' ? <section className={styles.section}><h3>Business & contact</h3><p>Use the details from your template.</p><div className={styles.fields}>{(['business','contact','phone','email','website'] as const).map(key => <button type="button" key={key} onClick={() => add('text', key)}><StudioIcon name="plus" />{AD_DESIGN_FIELDS[key]}</button>)}</div></section> : null}
        </> : <section className={styles.section}><h3>Layers <span className={styles.count}>{design.elements.length}</span></h3><p>Top items appear in front. Select one to edit it.</p><div className={styles.layers}>{[...design.elements].reverse().map(e => <button type="button" key={e.id} title={elementLabel(e)} aria-pressed={e.id === selected} onClick={() => selectLayer(e)}><span className={styles.layerIcon}>{e.kind === 'text' ? <EditorIcon name="text" /> : e.kind === 'rectangle' || e.kind === 'circle' ? <EditorIcon name={e.kind} /> : <StudioIcon name="image" />}</span><span>{elementLabel(e)}</span></button>)}</div>{!design.elements.length ? <div className={styles.panelEmpty}><EditorIcon name="layers" /><strong>Your elements will appear here</strong><p>Add a photo or text to get started.</p><button type="button" onClick={() => setToolPanel('add')}>Add elements</button></div> : null}</section>}
        </div><input ref={upload} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e => void uploadImage(e.target.files?.[0])} />
      </aside>
      <main className={styles.workarea} aria-label="Advert workspace">
        <div ref={viewport} className={`${styles.viewport} ${panMode ? styles.panning : ''}`} tabIndex={0} aria-label="Scrollable advert canvas" onPointerDown={event => {
          if (!panMode || event.button !== 0) return;
          event.preventDefault(); const node = event.currentTarget; node.setPointerCapture(event.pointerId);
          pan.current = { x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop, ratio: node.clientWidth / node.getBoundingClientRect().width };
        }} onPointerMove={event => { const p = pan.current; if (p) { event.currentTarget.scrollLeft = p.left - (event.clientX - p.x) * p.ratio; event.currentTarget.scrollTop = p.top - (event.clientY - p.y) * p.ratio; } }} onPointerUp={() => { pan.current = null; }} onPointerCancel={() => { pan.current = null; }} onLostPointerCapture={() => { pan.current = null; }}>
        <div className={styles.stageSurround} style={{ width: `max(100%, ${width * scale + 64}px)`, height: `max(100%, ${height * scale + 64}px)` }}>
        <div className={styles.stage} ref={stage} style={{ width: width * scale, height: height * scale }} onPointerDown={e => { if (e.target === e.currentTarget || e.target === canvas.current) setSelected(''); }}>
          <canvas ref={canvas} width={width} height={height} aria-label="Custom advert preview" />
          {!design.elements.length ? <div className={`${styles.empty} ${width * scale < 400 || height * scale < 240 ? styles.emptyCompact : ''} ${width * scale < 280 || height * scale < 120 ? styles.emptyTiny : ''}`}><StudioIcon name="palette" /><strong>Your advert starts here</strong><span>Add your first element from the left, or begin with a starter layout.</span><button type="button" className={styles.primary} onClick={starter}><StudioIcon name="layout" />Start with a layout</button></div> : null}
          {design.elements.map(e => <div key={e.id} data-design-element={e.id} role="button" tabIndex={panMode ? -1 : 0} aria-label={`Move ${e.field ? AD_DESIGN_FIELDS[e.field] : e.kind}`} aria-pressed={selected === e.id} className={`${styles.element} ${selected === e.id ? styles.selected : ''}`} style={{ left: `${e.x / width * 100}%`, top: `${e.y / height * 100}%`, width: `${e.width / width * 100}%`, height: `${e.height / height * 100}%` }} onFocus={() => setSelected(e.id)} onDoubleClick={() => { if (e.kind === 'text' && !e.field) { setSettingsTab('appearance'); requestAnimationFrame(() => settings.current?.querySelector('textarea')?.focus()); } }} onPointerDown={event => start(event, e)} onPointerMove={move} onPointerUp={() => end()} onPointerCancel={() => end(true)} onLostPointerCapture={() => end()} onKeyDown={event => {
            const delta = event.shiftKey ? 10 : 1;
            const arrows: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
            if (arrows[event.key]) { event.preventDefault(); const [x, y] = arrows[event.key]; patch({ x: e.x + x, y: e.y + y }); }
            if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(); }
          }}>{selected === e.id ? (['se', 'sw', 'ne', 'nw'] as const).map(corner => <span key={corner} data-resize-corner={corner} className={`${styles.resize} ${styles[corner]}`} aria-hidden="true" onPointerDown={event => start(event, e, corner)} />) : null}</div>)}
          {guides.x ? <i className={styles.guideX} /> : null}{guides.y ? <i className={styles.guideY} /> : null}
        </div></div></div>
        <div className={styles.canvasStatus}><span>{panMode ? 'Drag the canvas to move around' : 'Drag to move · Corners to resize'}</span><span role="status">{rendering ? 'Updating preview…' : `${width} × ${height} px`}</span></div>
      </main>
      <aside className={styles.inspector} aria-label="Element settings">
        <div className={styles.inspectorHeader}><div className={styles.settingsHeading}><StudioIcon name="styles" /><h3 title={element ? elementLabel(element) : undefined}>{element ? elementLabel(element) : 'Element settings'}</h3></div>
        {element ? <><div className={styles.elementActions}><button type="button" disabled={design.elements.length >= MAX_DESIGN_ELEMENTS} onClick={duplicate}><StudioIcon name="copy" />Duplicate</button><button type="button" className={styles.delete} onClick={remove}><StudioIcon name="delete" />Delete</button></div>
        <div className={styles.inspectorTabs} role="group" aria-label="Element controls"><button type="button" aria-pressed={settingsTab === 'appearance'} onClick={() => setSettingsTab('appearance')}>Appearance</button><button type="button" aria-pressed={settingsTab === 'arrange'} onClick={() => setSettingsTab('arrange')}>Arrange</button></div></> : null}</div>
        <div ref={settings} className={styles.panel}>
        {element ? <>
        {settingsTab === 'appearance' ? <>
        <section className={styles.section}>
        {element.field ? <p className={styles.autoField}><StudioIcon name="check" />Fills in for each advert</p> : null}
        {element.kind === 'text' ? <>
          {!element.field ? <label>Wording<textarea value={element.text} maxLength={1000} rows={2} onChange={e => patch({ text: e.target.value })} /></label> : null}
          <details className={styles.fontPicker}><summary><span>Font</span><strong>{element.font}</strong><StudioIcon name="chevron" /></summary><div className={styles.fontOptions} role="group" aria-label="Font">{(['Arial', 'Georgia', 'Montserrat'] as const).map(font => <button type="button" key={font} style={{ fontFamily: font }} aria-pressed={element.font === font} onClick={event => { patch({ font }); const picker = event.currentTarget.closest('details'); if (picker) { picker.open = false; picker.querySelector('summary')?.focus(); } }}>{font}{element.font === font ? <StudioIcon name="check" /> : null}</button>)}</div></details>
          <div className={styles.typeTools}>{numberControl('Text size', 'fontSize', 240)}<button type="button" aria-pressed={element.bold} onClick={() => patch({ bold: !element.bold })}>Bold</button></div>
          <div className={styles.alignment} role="group" aria-label="Text alignment">{(['left', 'center', 'right'] as const).map(align => <button type="button" key={align} aria-pressed={element.align === align} onClick={() => patch({ align })}>{align === 'center' ? 'Centre' : align === 'left' ? 'Left' : 'Right'}</button>)}</div>
          <p>Text adjusts to fit its box.</p>
        </> : null}
        {['text', 'rectangle', 'circle'].includes(element.kind) ? <><div className={styles.colourPresets} role="group" aria-label="Quick colours">{[['Brand', content.brand.primaryColor], ['Accent', content.brand.accentColor], ['White', '#ffffff'], ['Dark', '#173f31']].map(([label, color]) => <button type="button" key={label} aria-label={`${label} colour`} title={label} aria-pressed={element.color === color} onClick={() => patch({ color })}><span style={{ background: color }} />{label}</button>)}</div><label className={styles.color}>Colour<input type="color" value={element.color} onChange={e => patch({ color: e.target.value })} /></label></> : null}
        {element.kind === 'photo' || element.kind === 'logo' ? <>
          {element.kind === 'photo' && !element.image ? <><p>Uses the photo from each advert.</p><div className={styles.photoSlots} role="group" aria-label="Photo slot">{[0, 1, 2, 3].map(i => <button type="button" key={i} aria-pressed={element.photoIndex === i} onClick={() => patch({ photoIndex: i })}>Photo {i + 1}</button>)}</div></> : null}
          {element.kind === 'logo' ? <p>Your logo comes from the template’s Details step.</p> : null}
          <div className={styles.choices}><button type="button" aria-pressed={element.fit === 'cover'} onClick={() => patch({ fit: 'cover' })}>Fill frame</button><button type="button" aria-pressed={element.fit === 'contain'} onClick={() => patch({ fit: 'contain' })}>Fit image</button></div>
          <label>Horizontal crop<input type="range" min={0} max={100} value={element.cropX} onChange={e => patch({ cropX: Number(e.target.value) })} /></label><label>Vertical crop<input type="range" min={0} max={100} value={element.cropY} onChange={e => patch({ cropY: Number(e.target.value) })} /></label>
        </> : null}
        </section></> : <>
        <section className={styles.section}><h3>Position on advert</h3><div className={styles.arrangeGrid}><button type="button" title="Centre horizontally" onClick={() => patch({ x: (width - element.width) / 2 })}><EditorIcon name="horizontal" />Centre horizontally</button><button type="button" title="Centre vertically" onClick={() => patch({ y: (height - element.height) / 2 })}><EditorIcon name="vertical" />Centre vertically</button></div>
        <div className={styles.layerActions}><button type="button" title="Bring forward one layer" disabled={design.elements.at(-1)?.id === selected} onClick={() => layer(true)}>Forward</button><button type="button" disabled={design.elements[0]?.id === selected} onClick={() => layer(false)} title="Send backward one layer">Backward</button></div></section>
        <section className={styles.section}><h3>Size & position</h3><div className={styles.numbers}>{numberControl('Left', 'x', width - element.width)}{numberControl('Top', 'y', height - element.height)}{numberControl('Width', 'width', width)}{numberControl('Height', 'height', height)}</div><p>Arrow keys move 1 px. Shift + arrow moves 10 px.</p></section></>}
      </> : <div className={styles.panelEmpty}><StudioIcon name="edit" /><strong>Select an element</strong><p>Click any element to style or arrange it.</p><div className={styles.quickTips}><span><b>1</b> Add an element</span><span><b>2</b> Drag it into place</span><span><b>3</b> Make it yours here</span></div></div>}</div></aside>
    </div>
    <footer className={styles.footer}><div>{error ? <p role="alert" className={styles.error}>{error}</p> : <p>Preview uses sample details. Choose “Use design”, then save your template.</p>}</div><button type="button" disabled={busy || !design.elements.length} onClick={() => void download()}><StudioIcon name="download" />Download preview</button><button type="button" className={styles.primary} disabled={busy || !design.elements.length} onClick={() => { onChange(normalizeAdCustomDesign(design)!); onClose(); }}><StudioIcon name="check" />Use design</button></footer>
  </dialog>;
}
