'use client';
import {useEffect, useId, useRef, useState} from 'react';
import DropdownOverlay from './DropdownOverlay';
import styles from './AssetConditionPicker.module.css';
const options = [{value:'',label:'Select condition'}, {value:'excellent',label:'Excellent'}, {value:'good',label:'Good'}, {value:'fair',label:'Fair'}, {value:'used',label:'Used'}, {value:'serious',label:'Requires attention'}];
export default function AssetConditionPicker({value='',onChange}:{value?:string;onChange:(value:string)=>void}) {
  const [open,setOpen]=useState(false),[focused,setFocused]=useState(0);
  const anchor=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),id=useId();
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!anchor.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
  useEffect(()=>{if(open)menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[focused]?.focus();},[open,focused]);
  function choose(index:number){onChange(options[index].value);setOpen(false);anchor.current?.focus();}
  return <div className={styles.picker}>
    <button ref={anchor} type="button" className={styles.trigger} aria-label="Condition" aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>{setFocused(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(!open);}} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setFocused(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(true);}}}>
      <span>{options.find(option=>option.value===value)?.label||'Select condition'}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {open&&<DropdownOverlay anchorRef={anchor} maxHeight={340} className={styles.menu} id={id} role="listbox" aria-label="Condition"><div ref={menu} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);anchor.current?.focus();}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setFocused(index=>(index+(event.key==='ArrowDown'?1:options.length-1))%options.length);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();setFocused(event.key==='Home'?0:options.length-1);}else if(event.key==='Tab')setOpen(false);}}>
      {options.map((option,index)=><button type="button" role="option" aria-selected={value===option.value} tabIndex={index===focused?0:-1} key={option.value} onClick={()=>choose(index)}>{option.label}<span aria-hidden="true">{value===option.value?'✓':''}</span></button>)}
    </div></DropdownOverlay>}
  </div>;
}
