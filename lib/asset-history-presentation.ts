const friendly:Record<string,string>={value:'Current value · excl. VAT',selected_value_ex_vat:'Current value · excl. VAT',replacement_price_ex_vat:'Replacement price · excl. VAT',issue_noted_at:'Problem resolved',hours:'Usage',life_worked_percent:'Life worked · %',year_model:'Year model',maintenance_work:'Maintenance work',completed_at:'Completed',completed_notes:'Completion notes',recurring_enabled:'Recurring maintenance'};
export const label=(s:string)=>friendly[s]||s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).replace('Ex Vat','· excl. VAT');
const empty=(value:unknown)=>value==null||value===''||(Array.isArray(value)&&value.length===0);
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

function maintenanceWork(value:unknown):string {
 if(typeof value==='string'){try{return maintenanceWork(JSON.parse(value));}catch{return value;}}
 if(Array.isArray(value))return value.map(maintenanceWork).filter(Boolean).join('\n\n');
 if(!record(value))return empty(value)?'Not saved':String(value);
 const family=record(value.family)?value.family.label:'';
 const heading=[typeof value.mode==='string'?label(value.mode):'',typeof family==='string'?family:''].filter(Boolean).join(' · ');
 const items=Array.isArray(value.items)?value.items:[];
 const lines=items.filter(record).map(item=>{
  const parts=Array.isArray(item.parts)?item.parts.filter(record).map(part=>[part.name,part.brand,part.partNumber].filter(v=>typeof v==='string'&&v.trim()).join(' · ')).filter(Boolean):[];
  return [typeof item.label==='string'?item.label:'',...parts.map(part=>`Part: ${part}`)].filter(Boolean).join('\n');
 }).filter(Boolean);
 return [heading,...lines].filter(Boolean).join('\n')||'No work items recorded';
}

export function display(value:unknown,key?:string):string {
 if(empty(value))return 'Not saved';
 if(key==='maintenance_work')return maintenanceWork(value);
 if(typeof value==='boolean')return value?'Yes':'No';
 if(typeof value==='number')return key==='year_model'?String(value):value.toLocaleString('en-ZA').replace(/,/g,' ');
 if(typeof value==='string'){
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)&&!Number.isNaN(Date.parse(value)))return new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' SAST';
  if(['status','maintenance_type','recurring_interval_unit'].includes(key||''))return label(value);
  return value;
 }
 if(Array.isArray(value))return value.map(item=>display(item)).join('\n');
 if(record(value))return Object.entries(value).map(([field,entry])=>`${label(field)}: ${display(entry,field)}`).join('\n');
 return String(value);
}

/** Omit absent fields, but retain removals and every meaningful before/after change. */
export function visibleHistoryKeys(before:Record<string,unknown>,after:Record<string,unknown>){
 return Object.keys({...before,...after}).filter(key=>!empty(before[key])||!empty(after[key]));
}
export function matchesHistorySearch(item:import('./asset-history').HistoryItem,search:string){
 const query=search.trim().toLocaleLowerCase();
 return [item.action,item.actorName,item.source,label(item.category),new Date(item.createdAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}),...Object.keys({...item.before,...item.after}).map(key=>`${label(key)} ${display(item.before[key],key)} ${display(item.after[key],key)}`)].join(' ').toLocaleLowerCase().includes(query);
}
