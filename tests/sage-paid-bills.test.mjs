import test from 'node:test';
import assert from 'node:assert/strict';
import {paidBillCosts} from '../lib/sage-paid-bills.ts';
const bill={ID:1,Date:'2026-11-27',Paid:true,AmountDue:0,Total:115,SupplierName:'Workshop',Supplier_CurrencyId:4,
  Lines:[{ID:2,Description:'Repair serial AB123',Total:115,Tax:15}]};
const read = changes=>paidBillCosts({...bill,...changes},new Set([4]),[{id:'tractor',title:'Tractor',serialNumber:'AB123'}]);
test('only fully paid bills qualify',()=>{
  for(const changes of [{Paid:false},{Paid:true,AmountDue:50},{Paid:undefined}]) assert.deepEqual(read(changes),[]);
});
test('a known asset posts even without a category code',()=>{
  assert.equal(read({})[0].assetId,'tractor');
  assert.equal(read({})[0].details.category,'other');
  assert.equal(read({Lines:[{...bill.Lines[0],Description:'Workshop repair'}]})[0].assetId,null);
});
test('currency, duplicate references and total must reconcile before any line is emitted',()=>{
  for (const changes of [{Supplier_CurrencyId:1},{Total:110},{Lines:[...bill.Lines,...bill.Lines]}]) assert.throws(()=>read(changes));
});
