/** Observe mounted, visible modals, including portals and native <dialog> elements. */
export function observeModalPresence(onChange:(open:boolean)=>void):()=>void {
 const selector='[aria-modal="true"], [role="dialog"], [role="alertdialog"], dialog[open], [data-website-overlay]';
 let previous:boolean|undefined;
 const sync=()=>{
  const open=Array.from(document.querySelectorAll<HTMLElement>(selector)).some(element=>{
   if(element.closest('[hidden], [aria-hidden="true"], dialog:not([open])'))return false;
   if(!element.getClientRects().length)return false;
   const style=getComputedStyle(element);
   return style.visibility!=='hidden'&&style.visibility!=='collapse'&&style.display!=='none';
  });
  if(open!==previous){previous=open;onChange(open);}
 };
 const observer=new MutationObserver(sync);
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','open','aria-hidden','aria-modal','role','data-website-overlay']});
 // Media queries can hide a mounted dialog without changing any DOM attributes.
 window.addEventListener('resize',sync);
 document.addEventListener('toggle',sync,true);
 document.addEventListener('close',sync,true);
 sync();
 return ()=>{observer.disconnect();window.removeEventListener('resize',sync);document.removeEventListener('toggle',sync,true);document.removeEventListener('close',sync,true);};
}
