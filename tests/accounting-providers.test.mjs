import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,companies,exchange,latestBills} from '../lib/accounting-cloud.ts';
import {parseExport} from '../lib/accounting-export.ts';
import {assetForLine} from '../lib/accounting-serial.ts';

const cfg = provider => ({provider,origin:'https://pilot.example',clientId:'client',secret:'test',sandbox:true});
const grant = {access:'token',refresh:'refresh',realm:'123',dc:'eu'};
for(const p of ['xero','quickbooks','zoho','intacct']){
  test(p+' has a provider-specific callback and can refresh access',async t=>{
    const c=cfg(p);
    const url=new URL(authorize(c,'nonce'));
    assert.equal(url.searchParams.get('state'),'nonce');
    assert.equal(url.searchParams.get('redirect_uri'),c.origin+'/api/accounting/'+p+'/callback');
    t.mock.method(globalThis,'fetch',async (host,options)=>{
      assert.equal(options.method,'POST');
      assert.equal(options.redirect,'error');
      assert.ok(String(host).startsWith('https://'));
      return Response.json({access_token:'new',expires_in:3600});
    });
    assert.equal((await exchange(c,{refresh_token:'previous'},'123','eu')).refresh,'previous');
  });
}
test('QuickBooks verifies realm and only shows expense lines',async t=>{
  t.mock.method(globalThis,'fetch',async url=>{
    if(String(url).includes('/companyinfo/')) return Response.json({CompanyInfo:{CompanyName:'Farm'}});
    assert.match(String(url),/sandbox-quickbooks\.api\.intuit\.com\/v3\/company\/123\/query/);
    return Response.json({QueryResponse:{Bill:[{DocNumber:'B1',VendorRef:{name:'Dealer'},CurrencyRef:{value:'ZAR'},Line:[
      {DetailType:'ItemBasedExpenseLineDetail',Description:'S/N 0001',Amount:35},{DetailType:'SubTotalLineDetail',Amount:35}]}]}});
  });
  assert.deepEqual(await companies(cfg('quickbooks'),grant),[{id:'123',name:'Farm'}]);
  await assert.rejects(latestBills(cfg('quickbooks'),grant,'456'));
  assert.equal((await latestBills(cfg('quickbooks'),grant,'123')).length,1);
});
test('Xero uses the selected tenant and asks for detailed payable bills',async t=>{
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    if(String(url).endsWith('/connections')) return Response.json([{tenantType:'ORGANISATION',tenantId:'one',tenantName:'Farm'}]);
    assert.equal(options.headers['xero-tenant-id'],'one');
    assert.match(url.searchParams.get('where'),/ACCPAY/);
    assert.equal(url.searchParams.get('page'),'1');
    return Response.json({Invoices:[{InvoiceID:'B',LineItems:[{Description:'S/N 001',LineAmount:2}]}]});
  });
  const [company]=await companies(cfg('xero'),grant);
  assert.equal((await latestBills(cfg('xero'),grant,company.id))[0].amount,2);
});
test('Zoho restricts data centre hosts and reads individual bills',async t=>{
  const requested=[];
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    const target=new URL(url);
    requested.push(target.pathname);
    assert.equal(target.hostname,'www.zohoapis.eu');
    assert.equal(options.headers.Authorization,'Zoho-oauthtoken token');
    assert.equal(target.searchParams.get('organization_id'),'15');
    return Response.json(target.pathname.endsWith('/bills')?{bills:[{bill_id:'19'}]}:{bill:{bill_number:'X',line_items:[{description:'S/N 12345',item_total:12.5}]}});
  });
  assert.equal((await latestBills(cfg('zoho'),grant,'15'))[0].amount,12.5);
  assert.equal(requested.length,2);
  await assert.rejects(exchange(cfg('zoho'),{code:'c'},'','unknown'));
  assert.equal(requested.length,2);
});
test('Intacct queries keys then reads the original bill currency and line memo',async t=>{
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    if(String(url).endsWith('/query')){
      assert.equal(JSON.parse(options.body).object,'accounts-payable/bill');
      return Response.json({'ia::result':[{key:'1'}]});
    }
    return Response.json({'ia::result':{billNumber:'1',currency:{txnCurrency:'ZAR'},lines:[{memo:'Service S/N 001',txnAmount:'11.50'}]}});
  });
  const [company]=await companies(cfg('intacct'),grant);
  assert.deepEqual((await latestBills(cfg('intacct'),grant,company.id))[0],{invoice:'1',supplier:'',description:'Service S/N 001',amount:11.5,currency:'ZAR'});
});
test('Sage delimited files preserve serials, quoted paragraphs and decimal commas',()=>{
  assert.deepEqual(parseExport('\uFEFFInvoice;Description;Amount\r\nA;"Oil; S/N 0001\n""repair""";10,50',';')[1],['A','Oil; S/N 0001\n"repair"','10,50']);
  assert.throws(()=>parseExport('A,B,C\n1,"unfinished,15',','));
  assert.throws(()=>parseExport('A,B,C\n1,2',','));
  const a=[{serialNumber:'001',title:'Pump'},{serialNumber:'X123',title:'Tractor'}];
  assert.equal(assetForLine('Oil service MAIN-001',a),'Pump');
  assert.equal(assetForLine('REP-001 MAIN-X123',a),null);
  assert.equal(assetForLine('service S/N:001',a),'Pump');
  assert.equal(assetForLine('X123 S/N:001',a),null);
});
