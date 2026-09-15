import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const module={exports:{}};
new Function('exports',ts.transpile(readFileSync(new URL('../lib/budget-cost-details.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}))(module.exports);
const {allocatedBudgetCosts,budgetCostsUrl}=module.exports;
const budget={assetId:'tractor',period:'monthly',periodKey:'2026-09',includeFuelSlipCosts:false};
const costs=[
 {id:'a',assetId:'tractor',invoiceDate:'2026-09-10',source:'manual'},
 {id:'fuel',assetId:'tractor',invoiceDate:'2026-09-11',source:'fuel_slip'},
 {id:'other',assetId:'truck',invoiceDate:'2026-09-10',source:'manual'},
 {id:'old',assetId:'tractor',invoiceDate:'2026-08-10',source:'manual'},
 {id:'undated',assetId:'tractor',invoiceDate:null,source:'manual'},
 {id:'last-year',assetId:'tractor',invoiceDate:'2025-09-10',source:'manual'},
];
test('monthly details include only allocated costs in the budget period and fuel scope',()=>{
 assert.deepEqual(allocatedBudgetCosts(costs,budget).map(c=>c.id),['a']);
 assert.deepEqual(allocatedBudgetCosts(costs,{...budget,includeFuelSlipCosts:true}).map(c=>c.id),['fuel','a']);
 const url=new URL(budgetCostsUrl(budget),'https://example.test');assert.equal(url.searchParams.get('year'),'2026');assert.equal(url.searchParams.get('month'),'9');assert.equal(url.searchParams.get('assetId'),'tractor');
});
test('annual overall details include all assets and months but exclude undated and prior-year costs',()=>{
 const overall={...budget,assetId:null,period:'annual',periodKey:'2026',includeFuelSlipCosts:true};
 assert.deepEqual(allocatedBudgetCosts(costs,overall).map(c=>c.id),['fuel','a','other','old']);
 const url=new URL(budgetCostsUrl(overall),'https://example.test');assert.equal(url.searchParams.get('year'),'2026');assert.equal(url.searchParams.has('month'),false);assert.equal(url.searchParams.has('assetId'),false);
});
