import {REPORT_THEME_CSS} from './report-theme';
import {LOCATION_HISTORY_REPORT_CSS} from './location-history-report-styles';
import {createXlsxWorkbook, type XlsxCellValue} from './simple-xlsx';
import type {summarizeTracking} from './asset-tracking-math';
export type MovementReport = ReturnType<typeof summarizeTracking>;
type Options = {title:string;serial:string;assetId:string;from:string;to:string;generatedAt:Date;logoUrl?:string};
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const movementDate=(v:string|Date)=>new Date(v).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'});
const evidence='GPS estimates from recorded positions. Moving time is not engine or working hours; stopped does not mean the engine is off. Lines connect readings, so turns between readings may be missed. Gaps and separate sessions are not joined. Stops are observed stationary periods of at least 15 minutes; their true start/end may lie outside the selected period. All dates and times use South African time (SAST).';
const location=(p:{latitude:number;longitude:number})=>`https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
export function buildMovementWorkbook(r:MovementReport,o:Options){
 const headers=['Captured at (SAST)','Latitude','Longitude','Accuracy (m)','Estimated speed (km/h)','Google Maps'];
 const rows:XlsxCellValue[][]=[headers.map(value=>({value,style:'tableHeader'})),...r.readings.map(p=>[movementDate(p.capturedAt),{value:p.latitude,style:'coordinate'},{value:p.longitude,style:'coordinate'},p.accuracy,p.speedKmh,{value:'Open location',style:'link',hyperlink:location(p)}] as XlsxCellValue[])];
 return createXlsxWorkbook([
  {name:'Summary',columns:[30,100],rows:[[{value:'Asset Movement Report',style:'title'}],['Asset',o.title],['Serial / VIN',o.serial||'Not recorded'],['Period (SAST)',`${o.from} to ${o.to}`],['Generated (SAST)',movementDate(o.generatedAt)],['Distance (km)',r.distanceKm],['Moving minutes',r.movingSeconds/60],['Stationary minutes',r.stationarySeconds/60],['Average moving speed (km/h)',r.averageMovingKmh],['Unobserved minutes',r.gapSeconds/60],['Recorded positions',r.readings.length],['About this report',evidence]],rowHeights:{12:90}},
  {name:'Readings',rows,columns:[28,18,18,18,28,24],freezeRow:1,autoFilter:{fromRow:1,fromColumn:1,toRow:rows.length,toColumn:6}},
  {name:'Original readings',columns:[28,28,38,38,38,18,18,18,24,38],rows:[['Captured (SAST)','Uploaded (SAST)','Reading ID','Device ID','Recording ID','Latitude','Longitude','Accuracy (m)','Reading role','Recovered by device ID'],...r.points.map(p=>[movementDate(p.capturedAt),p.receivedAt?movementDate(p.receivedAt):'Not available',p.sampleId||'',p.deviceId||'',p.sessionId,p.latitude,p.longitude,p.accuracy,p.context?'Start context (retained)':'Record reading',p.recoveredByDeviceId||''])],freezeRow:1},
  {name:'Coverage gaps',columns:[28,28,20,45],rows:[['From (SAST)','To (SAST)','Unobserved minutes','Reason'],...(r.gaps||[]).map(g=>[movementDate(g.from),movementDate(g.to),g.seconds/60,g.reason])],freezeRow:1},
  {name:'Stops',columns:[28,28,22,18,18],rows:[['Observed from (SAST)','Observed to (SAST)','Observed minutes','Latitude','Longitude'],...r.stops.map(s=>[movementDate(s.from),movementDate(s.to),s.seconds/60,s.latitude,s.longitude])],freezeRow:1}
 ]);
}
/** Fixed tile coordinates and SVG routes keep dots aligned in browser printing. */
function routeMap(r:MovementReport){
 if(!r.readings.length)return '<p>No tracking readings in this period.</p>';
 const width=1000,height=300;
 const project=(p:{latitude:number;longitude:number})=>{const lat=Math.max(-85.05112878,Math.min(85.05112878,p.latitude)),sin=Math.sin(lat*Math.PI/180);return {x:(p.longitude+180)/360,y:.5-Math.log((1+sin)/(1-sin))/(4*Math.PI)};};
 const projected=r.readings.map(project);
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const p of projected){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
 let zoom=17;while(zoom>1&&((maxX-minX)*256*2**zoom>width-100||(maxY-minY)*256*2**zoom>height-100))zoom--;
 const world=256*2**zoom,left=(minX+maxX)/2*world-width/2,top=(minY+maxY)/2*world-height/2;
 const xy=(p:{latitude:number;longitude:number})=>{const q=project(p);return [(q.x*world-left).toFixed(2),(q.y*world-top).toFixed(2)];};
 let tiles='';for(let x=Math.floor(left/256);x<=Math.floor((left+width)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((top+height)/256);y++){if(y<0||y>=2**zoom)continue;const wrapped=((x%2**zoom)+2**zoom)%2**zoom;tiles+=`<img class="tile" alt="" src="https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png" style="width:${256/width*100}%;height:${256/height*100}%;left:${(x*256-left)/width*100}%;top:${(y*256-top)/height*100}%"/>`;}
 const lines=r.segments.filter(s=>s.length>1).map(s=>`<polyline data-route-segment fill="none" stroke="#176d50" stroke-width="3" points="${s.map(p=>xy(p).join(',')).join(' ')}"/>`).join('');
 const dots=r.readings.map(p=>{const [x,y]=xy(p);return `<circle data-reading cx="${x}" cy="${y}" r="2.6" fill="#176d50" stroke="white" stroke-width=".8"><title>${esc(movementDate(p.capturedAt))}</title></circle>`;}).join('');
 const stopPins=r.stops.map((s,i)=>{const [x,y]=xy(s);return `<g data-stop><circle cx="${x}" cy="${y}" r="10" fill="#ac6e1b" stroke="white" stroke-width="2"/><text x="${x}" y="${Number(y)+3}" text-anchor="middle" fill="white" font-size="9">${i+1}</text></g>`;}).join('');
 const ends=[r.readings[0],r.readings.at(-1)!].map((p,i)=>{const [x,y]=xy(p);return `<g><circle cx="${x}" cy="${y}" r="6" fill="${i?'#2561a1':'#176d50'}" stroke="white" stroke-width="2"/><text x="${x}" y="${Number(y)+(i?23:-14)}" text-anchor="middle" font-size="12" font-weight="bold" stroke="white" stroke-width="3" paint-order="stroke" fill="#193b30">${i?'End':'Start'}</text></g>`;}).join('');
 return `<div class="map" style="aspect-ratio:${width}/${height}">${tiles}<svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recorded route with GPS dots, start, end and stops">${lines}${dots}${stopPins}${ends}</svg><small class="attribution">© OpenStreetMap contributors</small></div>`;
}
export function buildMovementHtml(r:MovementReport,o:Options){
 const stats=[[`${r.distanceKm.toFixed(2)} km`,'Recorded distance'],[`${(r.movingSeconds/3600).toFixed(2)} h`,'Moving time'],[`${(r.stationarySeconds/3600).toFixed(2)} h`,'Stationary time'],[`${r.averageMovingKmh.toFixed(1)} km/h`,'Average moving speed']];
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(o.title)} | Movement report</title><style>${LOCATION_HISTORY_REPORT_CSS}\n${REPORT_THEME_CSS}\n</style></head><body>
 <div class="screenBar"><span>Movement report · Save as PDF from the print window</span><div class="screenActions"><button id="close">Close</button><button id="print">Save PDF / Print</button></div></div>
 <main class="assetMapReportPage"><header class="topbar"><div class="logoWrap">${o.logoUrl?`<img class="logo" src="${esc(o.logoUrl)}" alt="Account logo"/>`:'<div class="brand">Aim4price</div>'}</div><div class="documentTitle"><strong>Asset Movement Report</strong><span>Recorded routes and observed stops</span></div><div class="headerMeta"><div><span>Generated</span><strong>${esc(movementDate(o.generatedAt))} SAST</strong></div><div><span>Period</span><strong>${esc(o.from)} to ${esc(o.to)}</strong></div></div></header>
 <section class="hero"><div class="identity"><p class="kicker">Location history · Movement</p><h1>${esc(o.title)}</h1><p>Serial / VIN: ${esc(o.serial||'Not recorded')}</p><p>${r.readings.length.toLocaleString()} recorded positions · ${Math.round(r.gapSeconds/60)} minutes unobserved between readings</p></div><div class="summary">${stats.map(([value,label])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div></section>
 <section class="mapPanel"><div class="sectionHead"><h2>Recorded route</h2><span>${esc(o.from)} to ${esc(o.to)} · SAST</span></div>${routeMap(r)}</section>
 ${r.gapSeconds>0?'<p><strong>Partial tracking coverage.</strong> Distance and time cover recorded portions only.</p>':''}
 <p id="map-warning" hidden>Map imagery could not fully load. The route dots remain visible; use the coordinate links below or retry printing with a connection.</p>
 <div class="legend"><b>Green line and dots: recorded movement</b><span>Start / End: first and last readings</span><span>Amber numbers: stops of 15 minutes or longer</span></div>
 ${r.readings.length?`<p>Start: <a href="${location(r.readings[0])}">${esc(movementDate(r.readings[0].capturedAt))}</a> · End: <a href="${location(r.readings.at(-1)!)}">${esc(movementDate(r.readings.at(-1)!.capturedAt))}</a></p>`:''}
 <section class="history"><div class="sectionHead"><h2>Observed stops</h2><span>Duration within selected dates</span></div><table><thead><tr><th>Stop</th><th>From (SAST)</th><th>To (SAST)</th><th>Duration</th><th>Location</th></tr></thead><tbody>${r.stops.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(movementDate(s.from))}</td><td>${esc(movementDate(s.to))}</td><td>${Math.round(s.seconds/60)} min</td><td><a href="${location(s)}">${s.latitude.toFixed(6)}, ${s.longitude.toFixed(6)}</a></td></tr>`).join('')||'<tr><td colspan="5">No observed stops of 15 minutes or longer in this period.</td></tr>'}</tbody></table></section>
 <footer class="footer"><div><strong>Powered by Aim4price.com</strong><p>${evidence}</p></div><div><strong>Asset ID</strong><p>${esc(o.assetId)}</p></div></footer></main>
 <script>(function(){var printing=false;async function printReport(){if(printing)return;printing=true;var b=document.getElementById('print');b.disabled=true;b.textContent='Preparing…';if(document.fonts)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]);await Promise.race([Promise.all(Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});}))),new Promise(r=>setTimeout(r,6000))]);var missing=Array.from(document.querySelectorAll('.tile')).filter(i=>!i.complete||!i.naturalWidth);missing.forEach(i=>i.style.visibility='hidden');document.getElementById('map-warning').hidden=!missing.length;b.disabled=false;b.textContent='Save PDF / Print';printing=false;window.print();}document.getElementById('print').onclick=printReport;document.getElementById('close').onclick=()=>window.close();window.addEventListener('load',()=>setTimeout(printReport,250),{once:true});})();</script></body></html>`;
}
