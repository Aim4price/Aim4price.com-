const friendly:Record<string,string>={value:'Current value · excl. VAT',selected_value_ex_vat:'Current value · excl. VAT',replacement_price_ex_vat:'Replacement price · excl. VAT',issue_noted_at:'Problem resolved',hours:'Usage',life_worked_percent:'Life worked · %',year_model:'Year model'};
export const label=(s:string)=>friendly[s]||s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).replace('Ex Vat','· excl. VAT');
export const display=(value:unknown,key?:string)=>value==null?'Not saved':typeof value==='boolean'?(value?'Yes':'No'):typeof value==='object'?JSON.stringify(value):typeof value==='number'&&key!=='year_model'?value.toLocaleString('en-ZA').replace(/,/g,' '):String(value);

export function matchesHistorySearch(item:import('./asset-history').HistoryItem,search:string){
 const query=search.trim().toLocaleLowerCase();
 return [item.action,item.actorName,item.source,label(item.category),new Date(item.createdAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}),...Object.keys({...item.before,...item.after}).map(key=>`${label(key)} ${display(item.before[key],key)} ${display(item.after[key],key)}`)].join(' ').toLocaleLowerCase().includes(query);
}
