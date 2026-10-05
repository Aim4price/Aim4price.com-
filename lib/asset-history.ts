import {restorableDetailFields,restorableChanges} from './asset-history-fields';
import {getDb} from './db';
import {ensureAssetHistorySchema} from './asset-history-schema';
import {ensureSharedAssetActivity} from './shared-asset-activity';
export type HistoryCategory='details'|'values'|'costs'|'fuel'|'budgets'|'maintenance'|'documents';
export type HistoryItem={id:string;category:HistoryCategory;action:string;actorName:string;source:string;createdAt:string;before:Record<string,unknown>;after:Record<string,unknown>;recordId:string;recordTable:string;href?:string;restorable:boolean;valueRestorable?:boolean};
const labels:Record<string,string>={asset_register_items:'Asset',asset_invoices:'Cost',asset_invoice_documents:'Cost document',fuel_slips:'Fuel slip',fuel_storage_events:'Fuel movement',asset_cost_budgets:'Budget',asset_maintenance_records:'Maintenance',asset_scan_events:'Asset activity',account_documents:'Document',account_document_asset_links:'Document link'};
const fields=['reason','decision','title','serial_number','year_model','hours','condition','brand_name','model_name','note','value','selected_value_ex_vat','replacement_price_ex_vat','replacement_price_used_ex_vat','is_financed','is_insured','is_licensed','insured_value_ex_vat','last_known_lat','last_known_lng','last_known_location_text','supplier_name','invoice_number','invoice_date','subtotal_ex_vat','vat_amount','total_inc_vat','notes','litres','total_amount','document_date','issue_at','fuel_type','status','voided_at','void_reason','period','amount','warning_percent','include_fuel_slip_costs','maintenance_type','due_date','due_usage','completed_at','completed_by','completed_notes','completed_usage','trigger_type','assigned_name','maintenance_work','recurring_enabled','recurring_interval_value','recurring_interval_unit','category','document_type','file_name','expiry_date','deleted_at','activity_text','operator_name','issue_note','issue_note_resolved_at'];
export const historyPaperworkFields=['finance_status', 'finance_type', 'finance_current_outstanding_ex_vat', 'financier_name', 'finance_note', 'finance_bought_when', 'finance_bought_for_ex_vat', 'finance_original_amount_ex_vat', 'finance_monthly_payment_ex_vat', 'finance_interest_rate_percent', 'finance_term_months', 'finance_balloon_payment_ex_vat', 'finance_settlement_date', 'finance_reference_number', 'insurance_status', 'insurance_insurer_name', 'insurance_policy_number', 'insurance_renewal_date', 'insurance_note', 'license_status', 'license_registration_number', 'license_renewal_date', 'license_note', 'issue_noted_at', 'usage_reading', 'life_worked_percent'];
fields.push(...historyPaperworkFields);
const detailsRestore=restorableDetailFields;
function clean(data:Record<string,unknown>){
 const specs=(data.specs_json||{}) as Record<string,unknown>;
 const aliases:Record<string,string[]>={is_financed:['isFinanced','financed'],is_insured:['isInsured','insured'],is_licensed:['isLicensed','licensed'],insured_value_ex_vat:['insuredValueExVat'],last_known_lat:['lastKnownLat','latitude'],last_known_lng:['lastKnownLng','longitude'],last_known_location_text:['lastKnownLocationText','locationText']};
 for(const key of historyPaperworkFields)aliases[key]=[key.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase())];
 const result=Object.fromEntries(fields.filter(k=>k in data).map(k=>[k,data[k]]));
 for(const [key,names] of Object.entries(aliases))if(!(key in result)){const name=[key,...names].find(n=>n in specs);if(name)result[key]=specs[name];}
 if(result.selected_value_ex_vat!==undefined){result.value=result.selected_value_ex_vat;delete result.selected_value_ex_vat;}
 if(result.replacement_price_used_ex_vat!==undefined){result.replacement_price_ex_vat=result.replacement_price_used_ex_vat;delete result.replacement_price_used_ex_vat;}
 return result;
}
function changed(a:unknown,b:unknown){return JSON.stringify(a)!==JSON.stringify(b);}
export function historyChanges(before:Record<string,unknown>,after:Record<string,unknown>){return Object.keys({...before,...after}).filter(k=>changed(before[k],after[k]));}
export function historyLink(category:HistoryCategory,assetId:string,id:string,table:string){
 const asset=encodeURIComponent(assetId),record=encodeURIComponent(id);
 if(category==='costs')return `/my-invoices?view=costs&assetId=${asset}&invoiceId=${record}`;
 if(category==='fuel')return `/fuel?assetId=${asset}&view=slips${table==='fuel_slips'?`&slipId=${record}`:''}`;
 if(category==='budgets')return `/budgets?assetId=${asset}&budgetId=${record}`;
 if(category==='documents')return `/asset-register?assetId=${asset}`;
 return `/asset-register?assetId=${asset}${category==='values'?'&valueReview=1':''}`;
}
export function mapHistoryRow(row:any,owner:boolean,assetId:string):HistoryItem{
 const before=clean(row.before_data||{}),after=clean(row.after_data||{}),keys=historyChanges(before,after);
 // Documents/photos are represented by counts; URLs and unrelated private metadata never leave this API.
 for(const key of ['photos','documents']){if(JSON.stringify(row.before_data?.[key])!==JSON.stringify(row.after_data?.[key]))after[key+'_changed']='Updated';if(key in (row.before_data||{}))before[key]=Array.isArray(row.before_data[key])?row.before_data[key].length:0;if(key in (row.after_data||{}))after[key]=Array.isArray(row.after_data[key])?row.after_data[key].length:0;}
 const operation:Record<string,string>={INSERT:'added',UPDATE:'updated',DELETE:'removed',REASSIGNED:'reassigned',SNAPSHOT:'existing record',TRANSFERRED:'received'};
 return {id:row.id,category:row.category,action:row.semantic_action||`${row.category==='budgets'&&!row.asset_id?'Overall budget':labels[row.record_table]||'Record'} ${operation[row.operation]||'changed'}`,actorName:row.actor_name||'Not recorded',source:row.source==='record'?'Recorded activity':row.source,createdAt:row.created_at,before,after,recordId:row.record_id,recordTable:row.record_table,href:owner&&row.operation!=='DELETE'&&!row.record_removed?historyLink(row.category,assetId,row.record_id,row.record_table):undefined,restorable:owner&&row.record_table==='asset_register_items'&&row.operation==='UPDATE'&&restorableChanges(before,after).length>0};
}
export const historyCategories:HistoryCategory[]=['details','values','costs','fuel','budgets','maintenance','documents'];
export async function listUnifiedAssetHistory(ownerId:string,assetId:string,options:{owner:boolean;actorId?:string;categories?:HistoryCategory[];detailFields?:string[];problems?:boolean;maintenance?:boolean;documents?:boolean;before?:string;category?:string}={owner:true}){
 await ensureAssetHistorySchema();await ensureSharedAssetActivity();
 let categories=options.categories||historyCategories;
 if(options.category&&historyCategories.includes(options.category as HistoryCategory))categories=categories.filter(c=>c===options.category);
 let cursor:{date:string;id:string}|null=null;
 if(options.before){try{cursor=JSON.parse(Buffer.from(options.before,'base64url').toString());if(!cursor||!Number.isFinite(Date.parse(cursor.date))||! /^[0-9a-f-]{36}$/i.test(cursor.id))throw Error();}catch{throw Error('Invalid history page.');}}
 // Combine old application activity and new transactional audit, using one stable pagination order.
 const rows=(await getDb().query(`WITH events AS (
 SELECT h.id,h.owner_id,h.asset_id,h.category,h.record_table,h.record_id,h.operation,h.actor_id,h.actor_name,h.source,h.before_data,h.after_data||coalesce((SELECT jsonb_build_object('reason',s.after_data->'reason') FROM shared_asset_activity s WHERE s.owner_id=h.owner_id AND s.asset_id=h.asset_id AND s.transaction_id=h.transaction_id AND s.after_data ? 'reason' LIMIT 1),'{}'::jsonb) AS after_data,h.created_at,(SELECT s.action FROM shared_asset_activity s WHERE s.owner_id=h.owner_id AND s.asset_id=h.asset_id AND s.transaction_id=h.transaction_id ORDER BY s.created_at DESC LIMIT 1) AS semantic_action,NULL::text AS legacy_action FROM asset_history_events h
 UNION ALL SELECT id,owner_id,asset_id,CASE WHEN action LIKE 'Value %' THEN 'values' WHEN action ~* 'maintenance|problem' THEN 'maintenance' WHEN action ~* 'document|photo' THEN 'documents' ELSE 'details' END,'shared_asset_activity',id::text,'UPDATE',actor_id,actor_name,'Asset activity',before_data,after_data,created_at,NULL::text AS semantic_action,action FROM shared_asset_activity s WHERE NOT EXISTS(SELECT 1 FROM asset_history_events h WHERE h.owner_id=s.owner_id AND h.asset_id=s.asset_id AND h.transaction_id=s.transaction_id AND h.category=CASE WHEN s.action LIKE 'Value %' THEN 'values' WHEN s.action ~* 'maintenance|problem' THEN 'maintenance' WHEN s.action ~* 'document|photo' THEN 'documents' ELSE 'details' END)
 ) SELECT events.*,created_at::text AS created_at,EXISTS(SELECT 1 FROM shared_asset_activity v WHERE v.owner_id=events.owner_id AND v.asset_id=events.asset_id AND (v.id::text=events.record_id OR EXISTS(SELECT 1 FROM asset_history_events h WHERE h.id=events.id AND h.transaction_id=v.transaction_id)) AND v.action LIKE 'Value %' AND v.before_data ? 'baseline' AND v.after_data ? 'baseline' AND jsonb_typeof(v.before_data->'amount')='number' AND (v.after_data->>'replacementPrice' IS NULL OR v.before_data->'replacementPrice'=v.after_data->'replacementPrice')) AS value_restorable,EXISTS(SELECT 1 FROM asset_history_events removed WHERE removed.owner_id=events.owner_id AND removed.record_table=events.record_table AND removed.record_id=events.record_id AND removed.operation='DELETE' AND removed.created_at>=events.created_at) AS record_removed FROM events WHERE owner_id=$1 AND (asset_id=$2::uuid OR ($3 AND asset_id IS NULL AND category='budgets')) AND category=ANY($4::text[]) AND ($5::timestamptz IS NULL OR (created_at,id)<($5::timestamptz,$6::uuid)) AND ($3 OR (category NOT IN ('costs','fuel','budgets','values') AND record_table<>'shared_asset_activity') OR actor_id=$7) ORDER BY events.created_at DESC,events.id DESC LIMIT 101`,[ownerId,assetId,options.owner,categories,cursor?.date||null,cursor?.id||null,options.actorId||null])).rows;
 const allowed=new Set(options.detailFields||[]);
 const project=(d:Record<string,unknown>,category:HistoryCategory)=>Object.fromEntries(Object.entries(d).filter(([k])=>{
  if(options.owner)return true;
  if(k.startsWith('issue_note')&&!options.problems)return false;
  return category==='details'||category==='values'?allowed.has(k):true;
 }));
 const items=rows.slice(0,100).map(row=>{
  const problem=/problem/i.test(row.legacy_action||'')||(row.record_table==='asset_scan_events'&&/notes.?problems/i.test(row.after_data?.note||row.before_data?.note||''));
  if(!options.owner&&row.category==='maintenance'&&(problem?!options.problems:!options.maintenance))return null;
  const item=mapHistoryRow(row,options.owner,assetId);
  if(!options.owner&&row.category==='documents'&&!options.documents){item.before=Object.fromEntries(Object.entries(item.before).filter(([k])=>k==='photos'||k==='photos_changed'));item.after=Object.fromEntries(Object.entries(item.after).filter(([k])=>k==='photos'||k==='photos_changed'));}

  if(row.legacy_action){item.action=row.legacy_action;const aliases:Record<string,string>={yearModel:'year_model',usage:'hours',brand:'brand_name',model:'model_name',amount:'value',replacementPrice:'replacement_price_ex_vat'};
   for(const key of historyPaperworkFields)aliases[key.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase())]=key;
   Object.assign(aliases,{latitude:'last_known_lat',longitude:'last_known_lng',locationText:'last_known_location_text'});
   const safe=(d:Record<string,unknown>)=>Object.fromEntries(Object.entries(d||{}).filter(([k,v])=>!['requestSignature','legacyCorrectionId','proposalId','baseline'].includes(k)&&(['reason','suggestedBy','suggestionReason','kind','mode'].includes(k)||fields.includes(aliases[k]||k))).map(([k,v])=>[aliases[k]||k,v]));
   item.before=safe(row.before_data);item.after=safe(row.after_data);item.restorable=options.owner&&row.legacy_action==='Asset details updated'&&restorableChanges(item.before,item.after).length>0;
  }
  item.valueRestorable=options.owner&&item.category==='values'&&Boolean(row.value_restorable);
  item.before=project(item.before,item.category);item.after=project(item.after,item.category);
  // Show only fields that changed, not unrelated account information on every event.
  const keys=historyChanges(item.before,item.after);item.before=Object.fromEntries(keys.filter(k=>k in item.before).map(k=>[k,item.before[k]]));item.after=Object.fromEntries(keys.filter(k=>k in item.after).map(k=>[k,item.after[k]]));
  return item;
 }).filter((i):i is HistoryItem=>!!i&&(Object.keys(i.before).length>0||Object.keys(i.after).length>0));
 const last=rows[99];return {items,nextBefore:rows.length>100?Buffer.from(JSON.stringify({date:last.created_at,id:last.id})).toString('base64url'):null};
}
export {detailsRestore};
