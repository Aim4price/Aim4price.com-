import type {XlsxSheet} from './simple-xlsx';
export type HistoryAssetReference = {registration?:string;brand?:string;model?:string;category?:string;assetCode?:string;year?:number|null;photos?:string[]};
export const reportEscape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function safeHistoryPhoto(value:string):string {
 const url=value.trim();
 if(/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(url))return url;
 if(url.startsWith('/')&&!url.startsWith('//')&&!url.includes('\\'))return url;
 try {const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password?parsed.href:'';}catch{return '';}
}
export const historyPhotos=(o:HistoryAssetReference)=>Array.from(new Set((o.photos||[]).map(safeHistoryPhoto).filter(Boolean)));
export function assetReferenceDetails(o:HistoryAssetReference){
 const details=[['Registration / plate',o.registration],['Year model',o.year],['Make',o.brand],['Model',o.model],['Category',o.category],['Asset reference',o.assetCode]];
 return `<div class="assetDetails">${details.filter(([,value])=>value).map(([label,value])=>`<p><strong>${label}:</strong> ${reportEscape(value)}</p>`).join('')}</div>`;
}
export function assetPhotoSection(o:HistoryAssetReference,title:string){
 const photos=historyPhotos(o);
 return `<section class="photoSection"><div class="sectionHead"><h2>Asset photo reference</h2><span>${photos.length?`${photos.length} register photo${photos.length===1?'':'s'}`:'No photos on this asset'}</span></div><p class="referenceNote">Current asset-register photos for identification. They do not confirm the asset’s condition or presence at a recorded location.</p>${photos.length?`<div class="photoGrid">${photos.map((url,i)=>`<figure><div class="photoFrame"><img class="assetPhoto" src="${reportEscape(url)}" alt="${reportEscape(title)} — reference photo ${i+1}"/><span class="photoUnavailable" hidden>Photo unavailable</span></div><figcaption>Photo ${i+1} · ${reportEscape(title)}</figcaption></figure>`).join('')}</div>`:''}<p class="photoWarning" hidden>Some reference photos could not load. Reopen this report with a connection before saving.</p></section>`;
}
export function assetPhotoSheet(o:HistoryAssetReference):XlsxSheet {
 const photos=historyPhotos(o).filter(url=>!url.startsWith('data:'));
 return {name:'Asset photos',columns:[14,100],rows:[[{value:'Asset photo reference',style:'title'}],['Reference','Current register photos for identification, not evidence of location or condition at the time.'],...photos.map((url,i)=>[`Photo ${i+1}`,{value:'Open reference photo',style:'link' as const,hyperlink:url}]),...(!photos.length?[['Photos','No linked reference photos available.']]:[])],rowHeights:{2:45},tabColor:'197454'};
}
export const HISTORY_PRINT_SCRIPT=`(function(){var printing=false;async function printReport(){if(printing)return;printing=true;var b=document.getElementById('print');b.disabled=true;b.textContent='Preparing…';if(document.fonts)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]);await Promise.race([Promise.all(Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});}))),new Promise(r=>setTimeout(r,8000))]);var missing=Array.from(document.querySelectorAll('.tile')).filter(i=>!i.complete||!i.naturalWidth);missing.forEach(i=>i.style.visibility='hidden');document.getElementById('map-warning').hidden=!missing.length;var photos=Array.from(document.querySelectorAll('.assetPhoto'));photos.forEach(i=>{var failed=!i.complete||!i.naturalWidth;i.hidden=failed;i.nextElementSibling.hidden=!failed;});var warning=document.querySelector('.photoWarning');if(warning)warning.hidden=!photos.some(i=>i.hidden);b.disabled=false;b.textContent='Save PDF / Print';printing=false;window.print();}document.getElementById('print').onclick=printReport;document.getElementById('close').onclick=()=>window.close();window.addEventListener('load',()=>setTimeout(printReport,250),{once:true});})();`;
