'use client';

import {useEffect, useRef, useState} from 'react';
import {websiteLogicalRect, websiteVisibleViewport} from '../lib/website-canvas';
import styles from './valuation-result-tour.module.css';

const steps = [
  {target:'value', title:'Your estimated fair value', text:'This is the Aim4price fair-value estimate based on your asset details. It is a guide, not a guaranteed selling price.', action:'Value feel too high or too low? Check the replacement price, age, usage and condition before you save.'},
  {target:'replacement', title:'Start with the right replacement price', text:'Use what a comparable new asset would cost today, with the correct VAT basis. This is the starting point for depreciation.', action:'After this guide, choose Adjust price if this amount needs correcting.'},
  {target:'saleability', title:'Fair value and selling price can differ', text:'Buyer demand, time available to sell and selling circumstances affect the likely market price. Saleability estimates that effect separately from fair value.', action:'After this guide, choose Refine to explore your estimated selling price. The actual sale price may differ.'},
  {target:'settings', title:'Check the details behind the value', text:'If the estimate feels wrong, review the inputs so they accurately reflect your asset.', action:'Use the steps above to edit age, usage or condition. Use Estimate settings to review the calculation assumptions.'},
];
type Box = {top:number; left:number; width:number; height:number};

export default function ValuationResultTour() {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [available, setAvailable] = useState(steps);
  const [box, setBox] = useState<Box|null>(null);
  const [position, setPosition] = useState({top:16,left:16});
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Each new result gets the full introduction, including returning visitors.
  useEffect(() => { start(); }, []);

  function close() {
    setActive(false);
    dialog.current?.close();
    trigger.current?.focus({preventScroll:true});
  }

  function start() {
    const visible = steps.filter(step => document.querySelector<HTMLElement>(`[data-value-tour="${step.target}"]`)?.getClientRects().length);
    if (!visible.length) return;
    const tailored=visible.map(step => step.target==='settings' && document.querySelector('[data-value-tour="settings"][data-value-tour-readonly="true"]')
      ? {...step, title:'Check your asset details', action:'After this guide, use the steps above to correct the year, usage or condition. Then calculate your estimate again.'}
      : step);
    setAvailable(tailored); setIndex(0); setBox(null); setActive(true);
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
      const ch = card.current?.offsetHeight ?? 300;
      const cw = Math.min(360,w-32);
      const gap = 20;
      const clampTop = (top:number) => Math.max(16, Math.min(h-ch-16, top));
      let left = Math.max(16, Math.min(w-cw-16, r.left));
      let top:number;
      let spotlightBottom = Math.min(h-8,r.bottom+6);
      // Prefer the side: keep the value, details and action being explained clear.
      if (r.right+gap+cw <= w-16) {
        left=r.right+gap; top=clampTop(r.top+(r.height-ch)/2);
      } else if (r.left-gap-cw >= 16) {
        left=r.left-gap-cw; top=clampTop(r.top+(r.height-ch)/2);
      } else if (r.bottom+gap+ch <= h-16) {
        top=r.bottom+gap;
      } else if (r.top-gap-ch >= 16) {
        top=r.top-gap-ch;
      } else {
        // On short screens dock the explanation and keep the spotlight above it.
        top=Math.max(16,h-ch-16);
        spotlightBottom=Math.min(spotlightBottom,top-gap);
      }
      const spotlightTop=Math.max(8,r.top-6);
      setBox({top:spotlightTop,left:Math.max(8,r.left-6),width:Math.min(w-16,r.width+12),height:Math.max(0,spotlightBottom-spotlightTop)});
      setPosition({top,left});
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
        <span className={styles.launchIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5.5C9 3.5 5.5 3.5 2.5 4.5v14c3-1 6.5-1 9.5 1 3-2 6.5-2 9.5-1v-14c-3-1-6.5-1-9.5 1Z"/><path d="M12 5.5v14M6 8h2.5M6 11h2.5M15.5 8H18M15.5 11H18"/></svg></span>
        <span>Explain my value</span>
      </button>
    </div>
    <dialog ref={dialog} className={styles.overlay} aria-labelledby="value-tour-title" aria-describedby="value-tour-description" onCancel={event=>event.preventDefault()} onKeyDown={event=>{
      if(event.key !== 'Tab') return;
      const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    }}>
      {active ? <>
        <div className={styles.spotlight} style={box ?? {inset:0}} aria-hidden="true"/>
        <div ref={card} className={styles.card} style={position}>
          <div className={styles.top}><span>{index+1} of {available.length}</span><span>Quick guide</span></div>
          <h2 id="value-tour-title">{available[index].title}</h2>
          <div id="value-tour-description" aria-live="polite"><p>{available[index].text}</p><p className={styles.hint}>{available[index].action}</p></div>
          <div className={styles.actions}>
            {index > 0 ? <button type="button" onClick={()=>setIndex(index-1)}>Back</button> : null}
            <button type="button" className={styles.next} onClick={()=>index===available.length-1 ? close() : setIndex(index+1)}>{index===available.length-1 ? 'Done' : 'Next'}</button>
          </div>
        </div>
      </> : null}
    </dialog>
  </>;
}
