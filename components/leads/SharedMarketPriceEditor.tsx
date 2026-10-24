'use client';
import {useEffect,useState} from 'react';
import SaleabilityModal from '../SaleabilityModal';
import LeadActionDialog from './LeadActionDialog';
import type {GeneralSaleabilityInput,SaleabilityRefinementAnswers} from '../../lib/saleability';
import type {SaleabilityContext} from '../../lib/asset-saleability';
import type {SharedMarketAssessment} from '../../lib/shared-market-assessment';
type Details={assetId:string;title:string;valuationExVat:number;basis:string;input:GeneralSaleabilityInput;context:SaleabilityContext};
export default function SharedMarketPriceEditor({endpoint,assetTitle,onClose,onSaved}:{endpoint:string;assetTitle:string;onClose:()=>void;onSaved:(assessment:SharedMarketAssessment)=>void}) {
 const [details,setDetails]=useState<Details|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load market price.');setDetails(data);}).catch(error=>{if(!controller.signal.aborted)setError(error.message);});return()=>controller.abort();},[endpoint]);
 async function save(answers:SaleabilityRefinementAnswers){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basis:details!.basis,answers})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save market price.');onSaved(data.assessment);
 }
 if(!details)return <LeadActionDialog title="Market Price" assetTitle={assetTitle} onClose={onClose}><p role={error?'alert':'status'}>{error||'Loading market price…'}</p></LeadActionDialog>;
 return <SaleabilityModal open assetTitle={details.title} valuationExVat={details.valuationExVat} input={details.input} context={details.context} assetId={details.assetId} basis={details.basis} previewEndpoint={endpoint} onSave={save} onClose={onClose}/>;
}
