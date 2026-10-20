'use client';

import {useEffect, useRef, useState} from 'react';
import {websiteLogicalRect, websiteVisibleViewport} from '../lib/website-canvas';
import styles from './valuation-result-tour.module.css';

const storageKey = 'aim4price:result-tour:v1';
const steps = [
  {target:'value', title:'Your estimated value', text:'Your Aim4price estimate, based on the asset details you entered.'},
  {target:'replacement', title:'Replacement price', text:'Check what a comparable new asset would cost today. This directly affects your estimate.'},
  {target:'saleability', title:'Saleability', text:'Explore how demand and your selling circumstances may affect the estimated selling price. This is separate from your Aim4price value.'},
  {target:'settings', title:'Fine-tune your estimate', text:'Review usage, condition and valuation settings to better reflect your asset.'},
];
type Box = {top:number; left:number; width:number; height:number};

export default function ValuationResultTour() {
  const [seen, setSeen] = useState(false);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [available, setAvailable] = useState(steps);
  const [box, setBox] = useState<Box|null>(null);
  const [position, setPosition] = useState({top:16,left:16});
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {try {setSeen(localStorage.getItem(storageKey) === 'seen');} catch {}}, []);

  function close() {
    setActive(false); setSeen(true);
    try {localStorage.setItem(storageKey, 'seen');} catch {}
    dialog.current?.close();
    trigger.current?.focus({preventScroll:true});
  }

  function start() {
    const visible = steps.filter(step => document.querySelector<HTMLElement>(`[data-value-tour="${step.target}"]`)?.getClientRects().length);
    if (!visible.length) return;
    setAvailable(visible); setIndex(0); setBox(null); setActive(true);
  }

  useEffect(() => {
    if (!active) return;
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    return () => el.close();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const target = document.querySelector<HTMLElement>(`[data-value-tour="${available[index].target}"]`);
    if (!target) {setActive(false); return;}
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({behavior:reduced ? 'instant' : 'smooth', block:'center'});
    let frame = 0;
    function measure() {
      const r = websiteLogicalRect(target!.getBoundingClientRect());
      const viewport = websiteVisibleViewport();
      const w = viewport.width, h = viewport.height;
      const ch = card.current?.offsetHeight ?? 210;
      const cw = Math.min(360,w-32);
      const top = r.bottom + 16 + ch <= h-16 ? r.bottom+16
        : r.top-16-ch >= 16 ? r.top-16-ch : h-ch-16;
      setBox({top:Math.max(8,r.top-6),left:Math.max(8,r.left-6),width:Math.min(w-16,r.width+12),height:Math.max(0,Math.min(h-8,r.bottom+6)-Math.max(8,r.top-6))});
      setPosition({top:Math.max(16,top),left:Math.max(16,Math.min(w-cw-16,r.left))});
    }
    const schedule = () => {cancelAnimationFrame(frame); frame=requestAnimationFrame(measure);};
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(target);
    if (card.current) observer.observe(card.current);
    window.addEventListener('resize',schedule);
    window.addEventListener('scroll',schedule,true);
    return () => {observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);};
  }, [active,index,available]);

  return <>
    <div className={styles.launch}>
      <button ref={trigger} type="button" onClick={start} aria-haspopup="dialog">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01"/></svg>
        {seen ? 'Show me around' : 'New to this result? Show me around'}
      </button>
    </div>
    <dialog ref={dialog} className={styles.overlay} aria-labelledby="value-tour-title" aria-describedby="value-tour-description" onCancel={event=>{event.preventDefault();close();}}>
      {active ? <>
        <div className={styles.spotlight} style={box ?? {inset:0}} aria-hidden="true"/>
        <div ref={card} className={styles.card} style={position}>
          <div className={styles.top}><span>{index+1} of {available.length}</span><button type="button" onClick={close} aria-label="Close walkthrough">×</button></div>
          <h2 id="value-tour-title">{available[index].title}</h2>
          <p id="value-tour-description" aria-live="polite">{available[index].text}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.skip} onClick={close}>Skip</button>
            {index > 0 ? <button type="button" onClick={()=>setIndex(index-1)}>Back</button> : null}
            <button type="button" className={styles.next} onClick={()=>index===available.length-1 ? close() : setIndex(index+1)}>{index===available.length-1 ? 'Done' : 'Next'}</button>
          </div>
        </div>
      </> : null}
    </dialog>
  </>;
}
