import {safeHistoryPhoto} from './asset-history-report-shared';
import {resolveAssetRegisterUploadBytes} from './asset-register-uploads';
/** Call only with photos from the asset already authorised by the report route. */
export async function historyReportPhotos(photos:string[],requestUrl:string,embed=false):Promise<string[]> {
 const origin=new URL(requestUrl).origin;
 const urls=Array.from(new Set(photos.map(safeHistoryPhoto).filter(Boolean)));
 let embeddedBytes=0;
 const result:string[]=[];
 for(const raw of urls){
  const url=raw.startsWith('/')?new URL(raw,origin).href:raw;
  const parsed=url.startsWith('data:')?null:new URL(url);
  if(embed&&parsed?.origin===origin&&parsed.pathname.startsWith('/api/asset-register/uploads/')){
   try {
    const id=decodeURIComponent(parsed.pathname.slice('/api/asset-register/uploads/'.length));
    const resolved=await resolveAssetRegisterUploadBytes(id);
    if(resolved.status==='ready'&&/^image\/(png|jpeg|jpg|webp|gif)$/i.test(resolved.upload.mimeType)&&embeddedBytes+resolved.upload.data.length<=24*1024*1024){
     embeddedBytes+=resolved.upload.data.length;
     result.push(`data:${resolved.upload.mimeType};base64,${resolved.upload.data.toString('base64')}`);continue;
    }
   }catch{/* Preserve the original reference and show a visible fallback if unavailable. */}
  }
  result.push(url);
 }
 return result;
}
