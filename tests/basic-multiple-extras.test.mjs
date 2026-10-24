import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/valuation/valuation-client.tsx',import.meta.url),'utf8');
const start=source.indexOf('  const basicExtras = useMemo(');
const end=source.indexOf('  const basicUsageNotRequired',start);
const calculate=new Function('basicExtraChoice','basicFamilyExtra','otherExtraName','primaryExtraReplacementPriceExVat','additionalBasicExtras','basicBaseReplacementPriceExVat','useMemo','normalizeText','parseMoneyInput',source.slice(start,end)+';return {basicExtras,basicExtrasValid,basicExtraReplacementPriceExVat,basicTotalReplacementPriceExVat};');
const run=(rows,choice='family',price=100000)=>calculate(choice,{label:'Loader'},'Custom',price,rows,500000,fn=>fn(),v=>v.trim(),v=>Number(v.replace(/\s/g,''))||null);
test('multiple extras retain individual prices and are counted once in replacement total',()=>{
 const result=run([{name:'GPS',price:'25 000'},{name:'Weights',price:'10 000'}]);
 assert.equal(result.basicExtrasValid,true);
 assert.deepEqual(result.basicExtras,[{name:'Loader',replacementPriceExVat:100000},{name:'GPS',replacementPriceExVat:25000},{name:'Weights',replacementPriceExVat:10000}]);
 assert.equal(result.basicExtraReplacementPriceExVat,135000);
 assert.equal(result.basicTotalReplacementPriceExVat,635000);
 assert.deepEqual(JSON.parse(JSON.stringify(result.basicExtras)),result.basicExtras);
});
test('removing extras and choosing none excludes their prices',()=>{
 assert.equal(run([{name:'GPS',price:'25000'}]).basicTotalReplacementPriceExVat,625000);
 assert.equal(run([]).basicTotalReplacementPriceExVat,600000);
 assert.equal(run([{name:'GPS',price:'25000'}],'none').basicTotalReplacementPriceExVat,500000);
});
test('a valid extra cannot hide a missing or invalid price on another entry',()=>{
 for(const price of ['', '0', '-1', 'Infinity']) assert.equal(run([{name:'GPS',price}]).basicExtrasValid,false);
 assert.equal(run([{name:'',price:'25000'}]).basicExtrasValid,false);
 assert.equal(run([{name:'GPS',price:'25000'}],'family',0).basicExtrasValid,false);
});
