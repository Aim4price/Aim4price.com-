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
    let focused:HTMLElement|null=null;
    const visible=(el:Element)=>el.getClientRects().length>0;
    const measure=()=>{
      // Existing dialogs own their backdrop; never stack a second dimmer over them.
      const modal=Array.from(document.querySelectorAll('dialog[open], [data-website-overlay][role="dialog"], [data-website-overlay] [role="dialog"], [data-valuation-focus-modal]')).some(visible);
      if(modal){setBox(null);return;}
      const next=wizard.querySelector<HTMLElement>(activeSelector);
      const target=focused?.isConnected && visible(focused) ? focused : next && visible(next) ? next : wizard;
      const r=websiteLogicalRect(target.getBoundingClientRect());
      const viewport=websiteVisibleViewport();
      const left=Math.max(4,r.left-8),top=Math.max(4,r.top-8);
      const width=Math.max(0,Math.min(viewport.width-4,r.right+8)-left);
      const height=Math.max(0,Math.min(viewport.height-4,r.bottom+8)-top);
      setBox(width&&height?{left,top,width,height}:null);
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
    const focus=(event:FocusEvent)=>{
      const el=event.target;
      // Keep radio/choice groups together, including their label and help text.
      focused=el instanceof HTMLElement && wizard.contains(el)
        ? el.closest<HTMLElement>('fieldset, label, [data-valuation-focus-group]') : null;
      schedule();
    };
    const mutation=new MutationObserver(schedule);
    mutation.observe(wizard,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-expanded']});
    const overlays=new MutationObserver(schedule);
    overlays.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    const resize=new ResizeObserver(schedule);resize.observe(wizard);
    window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
    document.addEventListener('focusin',focus);
    schedule();
    return()=>{cancelAnimationFrame(frame);mutation.disconnect();overlays.disconnect();resize.disconnect();window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);document.removeEventListener('focusin',focus);};
  },[enabled,activeSelector]);
  return enabled&&box ? <div data-valuation-flow-focus aria-hidden="true" className={styles.spotlight} style={box}/> : null;
}
