'use client';
import {useEffect,useState} from 'react';
import AssetValueDialog from '../asset-register/AssetValueDialog';
import LeadActionDialog from './LeadActionDialog';
export default function SharedAssetValueDialog({endpoint,assetTitle,field,onClose,onSaved}:{endpoint:string;assetTitle:string;field:'current'|'replacement';onClose:()=>void;onSaved?:()=>void}) {
 const [data,setData]=useState<{asset:{id:string;replacementPriceExVat:number|null};permissions:Record<string,boolean>}|null>(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();fetch(endpoint+'/details',{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load asset values.');setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[endpoint]);
 if(!data)return <LeadActionDialog title="Asset values" assetTitle={assetTitle} onClose={onClose}><p role={error?'alert':'status'}>{error||'Loading values…'}</p></LeadActionDialog>;
 const owner=data.permissions.owner,allowed=owner||data.permissions[field==='current'?'suggestValue':'replacementPrice'];
 if(!allowed)return <LeadActionDialog title="Asset values" assetTitle={assetTitle} onClose={onClose}><p>The owner has not enabled this value change.</p></LeadActionDialog>;
 const link=endpoint.match(/^\/api\/asset-share-links\/([^/]+)\/assets\/([^/]+)$/),lead=endpoint.match(/^\/api\/asset-leads\/([^/]+)$/);
 return <AssetValueDialog endpoint={owner?`/api/asset-register/${data.asset.id}/value`:endpoint+'/value'} assetTitle={assetTitle} suggest={!owner} initialView={owner?(field==='current'?'override':'replacement'):undefined} replacementSuggestion={!owner&&field==='replacement'?{readEndpoint:endpoint+'/details',endpoint:link?`/api/asset-share-links/${link[1]}/corrections`:'/api/dealer/asset-corrections',sourceId:link?`${link[1]}:${link[2]}`:lead?.[1]||'',assetId:link?.[2],current:data.asset.replacementPriceExVat}:undefined} onClose={onClose} onSaved={onSaved}/>;
}
