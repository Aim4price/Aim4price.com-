import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { pricingVatAmount, pricingInputExVat } from '../lib/pricing-vat.ts';
test('VAT display covers values, selling ranges and differences without changing canonical amounts',()=>{
 const amounts=[340000,315000,335000,331500,351000,780000];
 const original=[...amounts];
 assert.deepEqual(amounts.map(v=>pricingVatAmount(v,true)),[391000,362250,385250,381225,403650,897000]);
 assert.equal(pricingVatAmount(351000,true)-pricingVatAmount(331500,true),22425);
 assert.deepEqual(amounts,original);
 for(const value of amounts) assert.equal(pricingVatAmount(value,false),value);
});
test('replacement input converts once to ex VAT and retains the entered inclusive text',()=>{
 const src=readFileSync('app/asset-register/asset-register-client.tsx','utf8');
 const start=src.indexOf('  function handleRevalueReplacementPriceChange(');
 const end=src.indexOf('\n  function ',start+10);
 const code=ts.transpileModule(src.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 const run=Function('pricingInputExVat','state',`
 const pricingVatIncluded=state.included;
 const formatRegisterValueInput=v=>String(v).replaceAll(' ','');
 const parseRegisterValueInput=v=>Number(v.replaceAll(' ',''));
 const setRevalueVatEntry=v=>state.entry=v;
 const setRevalueReplacementPriceInput=v=>state.canonical=v;
 const revalueReplacementPriceError=null;
 const setPricingPreview=()=>{};
 ${code}
 handleRevalueReplacementPriceChange({target:{value:state.text}});
 return state;`);
 const result=run(pricingInputExVat,{included:true,text:'897 000'});
 assert.equal(result.canonical,'780000');assert.equal(result.entry.text,'897000');
 assert.equal(run(pricingInputExVat,{included:true,text:''}).canonical,'');
 assert.equal(run(pricingInputExVat,{included:false,text:'780000'}).canonical,'780000');
});
