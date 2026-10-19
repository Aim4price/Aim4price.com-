import { calculateGeneralSaleability, calculateRefinedSaleability, type GeneralSaleabilityInput, type SaleabilityRefinementAnswers } from './saleability';

export type SaleabilityAsset = {value:number; hours:number|null; lifeRemainingPercent?:number|null; lifeWorkedPercent?:number|null; condition:string; maxLifetimeHours?:number|null; yearModel?:number|null; replacementPriceExVat?:number|null; specsJson:Record<string,unknown>};
export type SavedSaleability = {priceExVat:number; lowExVat:number; highExVat:number; assessedAt:string; basis:string; answers:SaleabilityRefinementAnswers};
const options = {
 saleArea:['local','province','south_africa'], similarAssetsAvailable:['none','one_to_three','four_to_ten','more_than_ten','unknown'], realisticBuyerPool:['many','moderate','few','specialist','unknown'], currentDemand:['strong','normal','weak','unknown'], modelFamiliarity:['common','less_common','rare','unknown'], desiredTimeline:['14','30','60','90','flexible'], sellingPriority:['best_price','balanced','fast_cashflow'],
};
export function validSaleabilityAnswers(value:unknown): value is SaleabilityRefinementAnswers {
 return !!value && typeof value==='object' && Object.entries(options).every(([key,values])=>values.includes((value as Record<string,string>)[key]));
}
function number(record:Record<string,unknown>, keys:string[]) { for(const key of keys){const v=record[key];if(v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)))return Number(v);}return null; }
export function assetSaleabilityInput(asset:SaleabilityAsset):GeneralSaleabilityInput {
 const s=asset.specsJson||{};
 const saved=(s.aim4priceSaleabilityInputs||s.aim4price_saleability_inputs||{}) as Record<string,unknown>;
 const lifetimeKeys=['maxLifetimeHours','max_lifetime_hours','expectedLifetimeHours','expected_lifetime_hours','lifetimeHours','lifetime_hours','designLifeHours','design_life_hours','usefulLifeHours','useful_life_hours','maxLifetimeKm','max_lifetime_km','expectedLifetimeKm','expected_lifetime_km','lifetimeKm','lifetime_km','designLifeKm','design_life_km','usefulLifeKm','useful_life_km'];
 return {lifeRemainingPercent:asset.lifeRemainingPercent,usageAmount:asset.hours,maxLifetimeUsage:asset.maxLifetimeHours||number(s,lifetimeKeys),lifeWorkedPercent:asset.lifeWorkedPercent??number(s,['life_worked_percent','worked_percent','lifetime_worked_percent','percent_worked','lifetime_used_percent']),condition:asset.condition,conditionFactorPercent:number(saved,['conditionFactorPercent','condition_factor_percent']),popularityStars:number(saved,['popularityStars','popularity_stars'])};
}
export function saleabilityBasis(asset:SaleabilityAsset) {return JSON.stringify([asset.value,asset.yearModel??null,asset.replacementPriceExVat??null,assetSaleabilityInput(asset)]);}
export function assessSaleability(asset:SaleabilityAsset, answers:SaleabilityRefinementAnswers):SavedSaleability {
 if(!validSaleabilityAnswers(answers)||!Number.isFinite(asset.value)||asset.value<=0)throw Error('Enter complete answers and a valid asset value.');
 const plan=calculateRefinedSaleability(calculateGeneralSaleability(assetSaleabilityInput(asset)),answers,asset.value);
 return {priceExVat:plan.recommendedAskingPriceExVat,lowExVat:plan.likelySellingRangeLowExVat,highExVat:plan.likelySellingRangeHighExVat,assessedAt:new Date().toISOString(),basis:saleabilityBasis(asset),answers};
}
