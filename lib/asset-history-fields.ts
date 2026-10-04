/** Fields eligible for owner-confirmed correction, shared by API and dialog. */
export const restorableDetailFields = ['title','year_model','condition','brand_name','model_name','note','hours','life_worked_percent'];
export const legacyDetailFields:Record<string,string> = {title:'title',yearModel:'year_model',condition:'condition',brand:'brand_name',model:'model_name',note:'note',usage:'hours'};
export function restorableChanges(before:Record<string,unknown>,after:Record<string,unknown>){
 return restorableDetailFields.filter(key=>key in before&&key in after&&(!['hours','life_worked_percent'].includes(key)||(before[key]!=null&&before[key]!==''&&Number.isFinite(Number(before[key]))&&Number(before[key])>=0))&&JSON.stringify(before[key])!==JSON.stringify(after[key]));
}
