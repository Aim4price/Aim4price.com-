'use client';

import {useEffect, useState} from 'react';
import {websiteLogicalRect, websiteVisibleViewport} from '../lib/website-canvas';
import styles from './valuation-flow-focus.module.css';

type Box = {top:number;left:number;width:number;height:number};

/** A visual guide only: real inputs, menus and navigation retain their normal events. */
export default function ValuationFlowFocus({enabled, activeSelector}: {enabled:boolean;activeSelector:string}) {
  const [box,setBox] = useState<Box|null>(null);
  useEffect(()=>{
    if (!enabled) {setBox(null);return;}
    const wizard=document.getElementById('valuation-wizard-card');
    if (!wizard) return;
    let frame=0;

    const visible=(el:Element)=>el.getClientRects().length>0;
    const measure=()=>{
      // Existing dialogs own their backdrop; never stack a second dimmer over them.
      const modal=Array.from(document.querySelectorAll('dialog[open], [data-website-overlay][role="dialog"], [data-website-overlay] [role="dialog"], [data-valuation-focus-modal]')).some(visible);
      if(modal){setBox(null);return;}
      const next=wizard.querySelector<HTMLElement>(activeSelector);
      // Derive focus from the current DOM, not the last focus event. React reuses
      // the footer across steps, so remembered focus can spotlight a disabled
      // Continue button on an entirely different question.
      const active=document.activeElement;
      const focused=active instanceof HTMLElement && wizard.contains(active)
        && !active.closest('[data-valuation-focus-navigation]')
        ? active.closest<HTMLElement>('fieldset, label, [data-valuation-focus-group]') : null;
      const content=wizard.querySelector<HTMLElement>('[data-valuation-focus-content]');
      const target=focused && visible(focused) ? focused : next && visible(next) ? next : content ?? wizard;
      const r=websiteLogicalRect(target.getBoundingClientRect());
      const viewport=websiteVisibleViewport();
      const left=Math.max(4,r.left-8),top=Math.max(4,r.top-8);
      const width=Math.max(0,Math.min(viewport.width-4,r.right+8)-left);
      const height=Math.max(0,Math.min(viewport.height-4,r.bottom+8)-top);
      setBox(width&&height?{left,top,width,height}:null);
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
    const mutation=new MutationObserver(schedule);
    mutation.observe(wizard,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-expanded']});
    const overlays=new MutationObserver(schedule);
    overlays.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    const resize=new ResizeObserver(schedule);resize.observe(wizard);
    window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
    document.addEventListener('focusin',schedule);
    document.addEventListener('focusout',schedule);
    schedule();
    return()=>{cancelAnimationFrame(frame);mutation.disconnect();overlays.disconnect();resize.disconnect();window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);document.removeEventListener('focusin',schedule);document.removeEventListener('focusout',schedule);};
  },[enabled,activeSelector]);
  return enabled&&box ? <div data-valuation-flow-focus aria-hidden="true" className={styles.spotlight} style={box}/> : null;
}
