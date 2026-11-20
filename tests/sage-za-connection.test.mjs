import test from 'node:test';
import assert from 'node:assert/strict';
import { assetForSageLine, sageAuthorize, sageTokens, sageRead, seal, unseal } from '../lib/sage-za-api.ts';

const config = {key:Buffer.alloc(32,1), origin:'https://pilot.example', clientId:'pilot',secret:'example',apiKey:'app-key'};
test('Sage approval uses the ZA audience and the registered callback', () => {
  const url = new URL(sageAuthorize(config,'nonce'));
  assert.equal(url.origin,'https://id.sage.com');
  assert.equal(url.searchParams.get('audience'),'sbca-za-prd/PUBLIC-API');
  assert.equal(url.searchParams.get('redirect_uri'),config.origin+'/api/accounting/sage-za/callback');
  assert.equal(url.searchParams.get('state'),'nonce');
});
test('connection secrets are bound to owner and purpose', () => {
  const encrypted = seal('session','owner-A/grant',config.key);
  assert.equal(unseal(encrypted,'owner-A/grant',config.key),'session');
  assert.throws(() => unseal(encrypted,'owner-B/grant',config.key));
});
test('preserves full serials and sends ambiguity to review', () => {
  const assets = [{title:'Tractor',serialNumber:'0012-A'},{title:'Pump',serialNumber:'0081'}];
  assert.equal(assetForSageLine('Repair 0012-A',assets),'Tractor');
  assert.equal(assetForSageLine('Repair 0012-AB',assets),null);
  assert.equal(assetForSageLine('Oil 0081',assets),null);
  assert.equal(assetForSageLine('Oil S/N 0081',assets),'Pump');
  assert.equal(assetForSageLine('0012-A S/N 0081',assets),null);
  assert.equal(assetForSageLine('Repair 0012-A',[...assets,assets[0]]),null);
});
test('refresh keeps the existing refresh token if Sage omits a replacement', async t => {
  t.mock.method(globalThis,'fetch',async () => Response.json({access_token:'new',expires_in:3600}));
  assert.equal((await sageTokens(config,{refresh_token:'old'})).refresh,'old');
});
test('supplier preview is company scoped and requests line detail', async t => {
  let calls = 0;
  t.mock.method(globalThis,'fetch',async (url,options) => {
    calls++;
    assert.equal(url.hostname,'accounting.sageone.co.za');
    assert.equal(url.searchParams.get('CompanyId'),'17');
    assert.equal(url.searchParams.get('includeDetail'),'true');
    assert.equal(options.headers.Authorization,'Bearer granted');
    assert.equal(options.redirect,'error');
    return Response.json({Results:[],TotalResults:0});
  });
  await assert.rejects(sageRead(config,'granted','SupplierInvoice/Get'));
  assert.deepEqual((await sageRead(config,'granted','SupplierInvoice/Get',17)).rows,[]);
  assert.equal(calls,1);
});
