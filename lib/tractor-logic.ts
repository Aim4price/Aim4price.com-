import { departmentBands, listings, tractors, type ConditionKey, type DepartmentAgBand, type TractorCatalogRow, type TractorType } from './tractor-data';
export type Result = {
  model: TractorCatalogRow;
  aim4priceValueExVat: number | null;
  marketLow: number | null;
  marketHigh: number | null;
  marketMid: number | null;
  marketCount: number;
  marketSources: typeof listings;
  departmentValueExVat: number | null;
  departmentBand: DepartmentAgBand | null;
  coverageBand: 'green' | 'amber' | 'red';
  previewValueExVat: number | null;
  previewLabel: 'Market midpoint' | 'Aim4price Value' | 'Department Guideline';
};
const CONDITION_FACTORS: Record<ConditionKey, number> = { excellent:.95, good:.85, fair:.75, used:.65, serious:.55 };
export const conditionLabel = (key: ConditionKey) => ({ excellent:'Excellent', good:'Good', fair:'Fair', used:'Used', serious:'Requires Attention' }[key]);
export function money(value:number|null){ if(value===null||!Number.isFinite(value)) return 'N/A'; return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(value); }
export function range(low:number|null, high:number|null){ return low===null||high===null ? 'N/A' : `${money(low)} - ${money(high)}`; }
function lifetime(type: TractorType, kw:number){ if(type==='orchard') return 10000; if(kw<=25) return 8000; if(kw<=75) return 12000; return 14000; }
function ageDep(year:number){ const age=Math.max(0,new Date().getFullYear()-year); let dep=0; if(age>=1) dep+=20; if(age>=2) dep+=15; if(age>=3) dep+=10; if(age>=4) dep+=(age-3)*2.5; return Math.min(dep,100); }
function usageDep(type: TractorType, hours:number, kw:number){ return Math.min((hours / lifetime(type, kw))*100, 100); }
function aim4(model: TractorCatalogRow, year:number, hours:number, condition:ConditionKey){ const dep=Math.round((ageDep(year)+usageDep(model.tractorType,hours,model.powerKw))/2); const after=model.aim4priceReplacementExVat*(1-dep/100)*CONDITION_FACTORS[condition]; return Math.round(Math.max(after, model.aim4priceReplacementExVat*0.05)); }
function deptBand(model: TractorCatalogRow){ const exact=departmentBands.find(b=>b.tractorType===model.tractorType&&b.drive===model.drive&&b.powerKw===model.powerKw); if(exact) return exact; const family=departmentBands.filter(b=>b.tractorType===model.tractorType&&b.drive===model.drive); return family.sort((a,b)=>Math.abs(a.powerKw-model.powerKw)-Math.abs(b.powerKw-model.powerKw))[0] ?? null; }
function deptValue(model: TractorCatalogRow, hours:number){ const band=deptBand(model); if(!band) return { value:null, band:null as DepartmentAgBand|null }; const salvage=band.replacementPriceExVat*0.10; return { value: Math.round(Math.max(band.replacementPriceExVat - hours*band.depreciationPerHourExVat, salvage)), band }; }
function market(model: TractorCatalogRow, year:number, hours:number){ const exact=listings.filter(l=>l.brandSlug===model.brandSlug&&l.modelName===model.modelName&&l.tractorType===model.tractorType&&l.drive===model.drive); const tight=exact.filter(l=>Math.abs(l.yearModel-year)<=2 && Math.abs(l.hours-hours)<=1000); const source=tight.length ? tight : exact; if(!source.length) return { low:null, high:null, mid:null, count:0, source }; const prices=source.map(l=>l.advertisedPriceExVat); const low=Math.min(...prices); const high=Math.max(...prices); return { low, high, mid: Math.round((low+high)/2), count: source.length, source }; }
export function getModel(id:string){ return tractors.find(t=>t.id===id); }
export function runValuation(input:{ modelId:string; year:number; hours:number; condition:ConditionKey; }) : Result { const model=getModel(input.modelId); if(!model) throw new Error('MODEL_NOT_FOUND'); const aim=aim4(model,input.year,input.hours,input.condition); const marketRes=market(model,input.year,input.hours); const deptRes=deptValue(model,input.hours); const count=[aim,marketRes.mid,deptRes.value].filter(v=>v!==null).length; const band = count>=3 ? 'green' : count===2 ? 'amber' : 'red'; let previewValueExVat = marketRes.mid; let previewLabel: Result['previewLabel'] = 'Market midpoint'; if(previewValueExVat===null && aim!==null){previewValueExVat=aim; previewLabel='Aim4price Value';} if(previewValueExVat===null && deptRes.value!==null){previewValueExVat=deptRes.value; previewLabel='Department Guideline';}
return { model, aim4priceValueExVat:aim, marketLow:marketRes.low, marketHigh:marketRes.high, marketMid:marketRes.mid, marketCount:marketRes.count, marketSources:marketRes.source as any, departmentValueExVat:deptRes.value, departmentBand:deptRes.band, coverageBand:band, previewValueExVat, previewLabel } }
