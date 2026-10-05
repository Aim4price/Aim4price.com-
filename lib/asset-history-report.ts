import {MAINTENANCE_REPORT_FONT_CSS} from './maintenance-report-style';
import {NextResponse,type NextRequest} from 'next/server';
import {listUnifiedAssetHistory,type HistoryItem} from './asset-history';
import {label,display,matchesHistorySearch} from './asset-history-presentation';
import {buildAssetSheetReportHtml} from './report-print';
import {renderReportHtmlToPdf} from './report-pdf';
import {normaliseReportPdfFileName} from './report-pdf-request';
import {getAssetRegisterReportLogoUrl} from './asset-registers';
import {resolveReportLogoUrlForHtml} from './report-logo';
import {resolveAssetUsage} from './asset-usage';
import type {AssetRegisterItem} from './asset-register-db';

// Applied only to history exports; the approved valuation template stays unchanged.
const HISTORY_REPORT_SPACING_CSS=`
.assetReportOverview{margin-top:16px}
.assetReportIdentity{padding:17px 18px}
.assetReportTitle{line-height:1.2}
.assetReportIdentity .assetReportMeta{margin-top:11px;line-height:1.6}
.assetReportValuationCard{padding:17px 16px}
.assetHistoryReport .assetReportSection{margin-top:18px!important;padding:16px 16px 14px;break-inside:avoid}
.assetHistoryReport .assetReportSection h2{margin:0 0 8px;line-height:1.4}
.assetHistoryReport .assetReportMeta{margin:0 0 14px;line-height:1.6}
.assetHistoryReport .assetReportTable{line-height:1.6}
.assetHistoryReport .assetReportTable th,.assetHistoryReport .assetReportTable td{padding:10px 11px!important;vertical-align:top;overflow-wrap:anywhere}
.assetHistoryReport .assetReportTable td:first-child{font-weight:600}
.assetHistoryReport .assetReportTable tr{break-inside:avoid}
.assetHistoryReport .assetReportTable thead{display:table-header-group}
.assetHistoryReport + .assetReportFooter{margin-top:20px}
`;

type Options=NonNullable<Parameters<typeof listUnifiedAssetHistory>[2]>;
export function buildAssetHistoryReportHtml(asset:AssetRegisterItem,items:HistoryItem[],options:Options,logoUrl:string,search:string,generatedAt=new Date()){
 const usage=resolveAssetUsage(asset);
 const permitted=(key:string)=>options.owner||options.detailFields?.includes(key);
 const details=[permitted('serial_number')&&asset.serialNumber?`Serial / VIN: ${asset.serialNumber}`:'',permitted('year_model')&&asset.yearModel?`Year Model: ${asset.yearModel}`:'',permitted('hours')&&usage.value!=null?`Usage: ${display(usage.value)} ${usage.metric==='percentage'?'%':usage.metric}`:'',permitted('condition')&&asset.condition?`Condition: ${asset.condition}`:''].filter(Boolean).join(' • ');
 return buildAssetSheetReportHtml({logoUrl,generatedAt:generatedAt.toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}),assetBadge:'Asset history',heroTitle:asset.title||'Asset',heroMeta:details,valueLabel:'Recorded changes',value:String(items.length),valueNote:'',statusLabel:items[0]?new Date(items[0].createdAt).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'}):'No activity',facts:[],footerNote:'Recorded asset activity. Original changes and subsequent corrections are retained. Dates and times are shown in South African time (SAST).',activity:{scope:`${options.category?label(options.category):'All activity'}${search?` · Search: ${search}`:''}`,events:items.map(item=>({title:item.action,metadata:`${new Date(item.createdAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})} · ${item.actorName} · ${item.source}`,changes:Object.keys({...item.before,...item.after}).map(key=>({label:label(key),before:key in item.before?display(item.before[key],key):'—',after:key in item.after?display(item.after[key],key):'—'}))}))}}).replace('</head>',`<style>${MAINTENANCE_REPORT_FONT_CSS}${HISTORY_REPORT_SPACING_CSS}</style></head>`);
}
/** Called only after the normal owner/lead/link history authorization has succeeded. */
export async function assetHistoryPdfResponse(request:NextRequest,ownerId:string,asset:AssetRegisterItem,options:Options){
 const items:HistoryItem[]=[];let before:string|undefined;
 const search=(request.nextUrl.searchParams.get('search')||'').trim().slice(0,500);
 // Apply the same visibility rules to every page, never only the loaded browser rows.
 for(let page=0;;page++){
  if(page>=100)throw new Error('History report is too large. Choose a category and retry.');
  const result=await listUnifiedAssetHistory(ownerId,asset.id,{...options,before});
  items.push(...result.items.filter(item=>matchesHistorySearch(item,search)));
  if(!result.nextBefore)break;before=result.nextBefore;
 }
 const rawLogo=await getAssetRegisterReportLogoUrl(ownerId).catch(()=> '');
 const logo=await resolveReportLogoUrlForHtml(rawLogo,request.url);
 const html=buildAssetHistoryReportHtml(asset,items,options,logo,search);
 const pdf=await renderReportHtmlToPdf(html,{baseUrl:request.url,cookie:request.headers.get('cookie')||''});
 const filename=normaliseReportPdfFileName(`Asset history - ${asset.title||'asset'}`).replace(/[^\x20-\x7e]/g,'_');
 return new NextResponse(pdf,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
