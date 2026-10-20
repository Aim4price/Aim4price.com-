import {assetPhotoSection,assetPhotoSheet,assetReferenceDetails,HISTORY_PRINT_SCRIPT,type HistoryAssetReference} from './asset-history-report-shared';
import {REPORT_THEME_CSS} from './report-theme';
import {LOCATION_HISTORY_REPORT_CSS} from './location-history-report-styles';
import {createXlsxWorkbook,type XlsxCellValue} from './simple-xlsx';
export type LocationReportEntry={id:string;latitude:number;longitude:number;note:string;actor:string;accuracy:number|null;recordedAt:string|Date;capturedAt:string|Date|null;source:string};
type ReportOptions=HistoryAssetReference & {title:string;serial:string;assetId:string;from:string|null;to:string|null;generatedAt:Date;logoUrl?:string};
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const date=(value:string|Date)=>new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'medium'});
const maps=(entry:LocationReportEntry)=>`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`;
const evidence='Recorded observations only. Manual pins and device readings do not independently verify asset presence or establish continuous tracking. Capture times are supplied by the device; recorded times are stored by the system.';
const period=(options:ReportOptions)=>`${options.from||'First record'} to ${options.to||'Latest record'}`;
export function buildLocationHistoryWorkbook(items:LocationReportEntry[],options:ReportOptions){
 const headers=['Pin','Recorded at (SAST)','Captured at (SAST, device supplied)','Latitude','Longitude','Source','Reported accuracy (m)','Recorded by','Location note','Google Maps','Record ID'];
 const rows:XlsxCellValue[][]=[headers.map(value=>({value,style:'tableHeader'})),...items.map((item,index):XlsxCellValue[]=>[
  {value:index+1,style:'integer'},date(item.recordedAt),item.capturedAt?date(item.capturedAt):'',{value:item.latitude,style:'coordinate'},{value:item.longitude,style:'coordinate'},item.source,{value:item.accuracy,style:'decimal'},item.actor,item.note,{value:'Open location',style:'link',hyperlink:maps(item)},item.id
 ])];
 return createXlsxWorkbook([
  {name:'Report summary',columns:[25,95],rows:[[{value:'Location history report',style:'title'}],[{value:'Aim4price | Asset Map Tracking',style:'subtitle'}],[],['Asset',options.title],['Serial / VIN',options.serial||'Not recorded'],['Registration / plate',options.registration||'Not recorded'],['Year model',options.year||'Not recorded'],['Asset ID',options.assetId],['Period (South Africa)',period(options)],['Generated (SAST)',date(options.generatedAt)],['Location records',{value:items.length,style:'integer'}],[],['About this report',evidence]],merges:[{fromRow:1,fromColumn:1,toRow:1,toColumn:2},{fromRow:2,fromColumn:1,toRow:2,toColumn:2}],rowHeights:{13:65},tabColor:'197454'},
  {name:'Location records',rows,columns:[8,27,32,17,17,32,24,30,48,22,40],freezeRow:1,autoFilter:{fromRow:1,fromColumn:1,toRow:rows.length,toColumn:headers.length},orientation:'landscape',tabColor:'197454'},assetPhotoSheet(options)
 ]);
}
/** Static map tiles print without Leaflet transforms or browser zoom affecting pin positions. */
function renderMap(items:LocationReportEntry[], satellite=false){
 if(!items.length)return '<p>No recorded positions in this period.</p>';
 const width=satellite?720:320,height=satellite?330:180;
 const projected=items.map(item=>{const latitude=Math.max(-85.05112878,Math.min(85.05112878,item.latitude)),sin=Math.sin(latitude*Math.PI/180);return {x:(item.longitude+180)/360,y:.5-Math.log((1+sin)/(1-sin))/(4*Math.PI)};});
 const xs=projected.map(p=>p.x),ys=projected.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 let zoom=satellite?17:13;while(zoom>1&&((maxX-minX)*256*2**zoom>width-100||(maxY-minY)*256*2**zoom>height-100))zoom--;
 const world=256*2**zoom,left=(minX+maxX)/2*world-width/2,top=(minY+maxY)/2*world-height/2;
 let tiles='';for(let x=Math.floor(left/256);x<=Math.floor((left+width)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((top+height)/256);y++){if(y<0||y>=2**zoom)continue;const wrapped=((x%2**zoom)+2**zoom)%2**zoom;tiles+=`<img class="tile" alt="" src="${satellite?`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${wrapped}`:`https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png`}" style="width:${256/width*100}%;height:${256/height*100}%;left:${((x*256-left)/width*100).toFixed(5)}%;top:${((y*256-top)/height*100).toFixed(5)}%"/>`;}
 const pins=projected.map((p,index)=>`<a class="pin ${index===0?'latest':''}" style="left:${((p.x*world-left)/width*100).toFixed(5)}%;top:${((p.y*world-top)/height*100).toFixed(5)}%;z-index:${items.length-index}" href="${escape(maps(items[index]))}" title="Location ${index+1}">${index+1}</a>`).reverse().join('');
 return `<div class="map" style="aspect-ratio:${width}/${height}" aria-label="${satellite?'Latest recorded position satellite map':'Recorded locations overview map'}">${tiles}${pins}<small class="attribution">${satellite?'Imagery © Esri, Maxar, Earthstar Geographics':'© OpenStreetMap contributors'}</small></div>`;
}
export function buildLocationHistoryHtml(items:LocationReportEntry[],options:ReportOptions){
 const rows=items.map((item,index)=>`<tr><td><b class="number">${index+1}</b></td><td><strong>${escape(date(item.recordedAt))}</strong>${item.capturedAt?`<small>Captured: ${escape(date(item.capturedAt))}</small>`:''}</td><td><strong>${escape(item.source)}</strong><small>${escape(item.actor)}</small>${item.accuracy!==null?`<small>Reported accuracy: ${escape(item.accuracy)} m</small>`:''}</td><td><a href="${escape(maps(item))}">${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}</a><small>${escape(item.note)}</small><small class="recordId">Record ID: ${escape(item.id)}</small></td></tr>`).join('');
 const latest=items[0];
 const generatedDate=options.generatedAt.toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg',day:'numeric',month:'long',year:'numeric'});
 const generatedTime=options.generatedAt.toLocaleTimeString('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit',hour12:false});
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escape(options.title)} | Location history</title><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"/><style>
 ${LOCATION_HISTORY_REPORT_CSS}
 ${REPORT_THEME_CSS}
 </style></head><body>
 <div class="screenBar"><span>Save or print this report.</span><div class="screenActions"><button id="close" type="button">Close</button><button id="print" type="button">Save PDF / Print</button></div></div>
 <main class="assetMapReportPage">
 <header class="topbar">
   <div class="logoWrap">${options.logoUrl?`<img class="logo" src="${escape(options.logoUrl)}" alt="Account logo"/>`:'<div class="brand">Aim4price</div>'}</div>
   <div class="documentTitle"><strong>Asset Location History Report</strong><span>Aim4price recorded location history</span></div>
   <div class="headerMeta"><div><span>Generated</span><strong>${escape(generatedDate)}</strong></div><div><span>Time</span><strong>${escape(generatedTime)} SAST</strong></div><div><span>Scope</span><strong>${escape(options.title)}</strong></div></div>
 </header>
 <section class="hero"><div class="identity"><p class="kicker">Asset Map Tracking</p><h1>${escape(options.title)}</h1><p><strong>Serial / VIN:</strong> ${escape(options.serial||'Not recorded')}</p><p><strong>Period:</strong> ${escape(period(options))}</p>${assetReferenceDetails(options)}</div>
 <aside class="summary"><div><span>Recorded positions</span><strong>${items.length.toLocaleString()}</strong></div><div><span>Latest in this period</span><strong>${latest?escape(date(latest.recordedAt)):'No records'}</strong></div><div><span>Time zone</span><strong>South Africa (SAST)</strong></div><div><span>Map key</span><strong>Pin 1 = latest record</strong></div></aside></section>
 <div class="mapGrid"><section class="mapPanel"><div class="sectionHead"><h2>Latest Recorded Position</h2><span>Satellite close-up · Pin 1</span></div>${renderMap(items.slice(0,1),true)}</section>
 <aside class="mapSide"><section class="sideCard"><h2>Recorded Locations Overview</h2>${renderMap(items)}<p class="mapHint">All recorded positions in the selected period.</p></section>
 <section class="sideCard"><h2>Latest Record Details</h2>${latest?`<dl><div><dt>Coordinates</dt><dd><a href="${escape(maps(latest))}">${latest.latitude.toFixed(6)}, ${latest.longitude.toFixed(6)}</a></dd></div><div><dt>Source</dt><dd>${escape(latest.source)}</dd></div><div><dt>Recorded by</dt><dd>${escape(latest.actor||'Not recorded')}</dd></div><div><dt>Reported accuracy</dt><dd>${latest.accuracy===null?'Not recorded':`${escape(latest.accuracy)} m`}</dd></div></dl>`:'<p>No location records in this period.</p>'}</section></aside></div>
 <p id="map-warning" hidden>Map imagery could not fully load. Use the recorded coordinates and location links below.</p>
 <div class="legend"><b>Green: latest observation</b><span>Blue: earlier observations</span><span>Pin numbers match the history below. Overlapping positions may share a pin location.</span></div>
 <section class="history"><div class="sectionHead"><h2>Location History</h2><span>Newest first · All times SAST</span></div><table><colgroup><col style="width:6%"/><col style="width:25%"/><col style="width:29%"/><col style="width:40%"/></colgroup><thead><tr><th>Pin</th><th>Recorded / captured</th><th>Source / recorded by</th><th>Coordinates / location note</th></tr></thead><tbody>${rows||'<tr><td colspan="4">No location records in this period.</td></tr>'}</tbody></table></section>
 ${assetPhotoSection(options,options.title)}
 <footer class="footer"><div><strong>Powered by Aim4price.com</strong><p>${escape(evidence)}</p></div><div><strong>Aim4price Asset Intelligence</strong><p>Asset ID: ${escape(options.assetId)}</p></div></footer></main><script>
 ${HISTORY_PRINT_SCRIPT}
 </script></body></html>`;
}
