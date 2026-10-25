import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/valuation/valuation-client.tsx', import.meta.url), 'utf8');
function actualFunction(name, bindings) {
  const ast = ts.createSourceFile('client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let target;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) target = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(target, `Missing production function ${name}`);
  const output = ts.transpileModule(target.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), `${output}; return ${name};`)(...Object.values(bindings));
}

test('Brand and Model show a brief busy state before progressing and ignore duplicate clicks', () => {
  const steps = [], busy = [], callbacks = [];
  const timer = { current: null };
  const next = actualFunction('handleNext', {
    identityTimerRef: timer, setMessage() {}, setRequiredFeedback() {}, nextRequiredMessage: () => null, basicEstimateActive: true, step: 2,
    normalizeText: s => s.trim(), unlistedBrandName: 'Kubota', typedModelName: 'M7',
    setBrandSlug() {}, UNKNOWN_BRAND_SLUG: 'unknown', setGenericModelMode() {},
    setPreparingIdentity: value => busy.push(value), setStep: value => steps.push(value),
    scrollWizardToStart() {}, setTimeout: (callback, delay) => { assert.equal(delay, 1000); callbacks.push(callback); return 1; },
  });
  next(); next();
  assert.deepEqual(busy, [true]);
  assert.deepEqual(steps, []);
  assert.equal(callbacks.length, 1);
  callbacks[0]();
  assert.deepEqual(busy, [true, false]);
  assert.deepEqual(steps, [3]);
  assert.equal(timer.current, null);
});

test('advert upload prepares every selected photo in order and rejects incomplete uploads', async () => {
  const prepared = [];
  let uploaded;
  let complete = true;
  const upload = actualFunction('uploadMarketplacePhotos', {
    marketplacePhotoFiles: [{ file: { name: 'first.png' } }, { file: { name: 'second.webp' } }],
    FormData, compressReportPhoto: async file => { prepared.push(file.name); return `data:${file.name}`; },
    isAccountantClientWorkspace: false,
    fetch: async (url, options) => {
      if (url.startsWith('data:')) return { blob: async () => new Blob([url], { type: 'image/jpeg' }) };
      uploaded = options.body.getAll('files');
      return { ok: true, json: async () => ({ ok: true, uploads: complete ? [{ url: '/one' }, { url: '/two' }] : [{ url: '/one' }] }) };
    },
  });
  assert.deepEqual(await upload(), { urls: ['/one', '/two'], jpegPhotos: ['data:first.png', 'data:second.webp'] });
  assert.deepEqual(prepared, ['first.png', 'second.webp']);
  assert.deepEqual(uploaded.map(file => file.name), ['first.jpg', 'second.jpg']);
  assert.ok(uploaded.every(file => file.type === 'image/jpeg'));
  complete = false;
  await assert.rejects(upload(), /Some photos were not uploaded/);
});

test('publishing stores server URLs but exports and retries with the exact local photos', async () => {
  const posted = [], downloads = [], receipts = [], errors = [];
  const publish = actualFunction('publishEstimateToMarketplace', {
    setPublishedEstimatePhotos() {}, resultState: {}, marketplaceDraft: { askingPriceExVat: '1000', sellerName: 'Seller', sellerPhone: '0123', brandKitId: '' },
    getHeadlineValue: () => 900, selectedMethod: 'aim4price', replacementPriceBasis: 'new',
    parseMoneyInput: Number, isSignedIn: true, normalizedSignedInAccountType: 'owner',
    hasPendingReplacementPriceInput: () => false, ensureReplacementPriceBeforeFinalSave: () => true,
    setIsPublishingMarketplace() {}, setMarketplacePublishError: e => errors.push(e),
    uploadMarketplacePhotos: async () => ({ urls: ['/saved/one', '/saved/two'], jpegPhotos: ['data:one', 'data:two'] }),
    savedMarketplaceAssetId: null, saveCurrentValuationToRegister: async options => { assert.deepEqual(options.photos, ['/saved/one', '/saved/two']); return { assetId: 'asset-1' }; },
    setSavedMarketplaceAssetId() {}, fetch: async (url, options) => { posted.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ ok: true, listing: { id: 'listing-1', imageUrls: ['/remote/broken'], imageSrc: '/remote/broken' } }) }; },
    downloadPublishedAdvert: async listing => { downloads.push(listing); return 'downloaded'; },
    clearMarketplacePhotoFiles() {}, setMarketplaceDraft() {}, setPublishedAdvertDownload: receipt => receipts.push(receipt),
  });
  await publish({ preventDefault() {} });
  assert.deepEqual(errors, ['']);
  assert.deepEqual(posted[0].photos, ['/saved/one', '/saved/two']);
  assert.deepEqual(downloads[0].imageUrls, ['data:one', 'data:two']);
  assert.equal(downloads[0].imageSrc, 'data:one');
  assert.deepEqual(receipts[0].listing, downloads[0]);
});



test('incomplete answers reveal feedback and cannot begin the next-step transition', () => {
  const feedback = [];
  const next = actualFunction('handleNext', {
    identityTimerRef: { current: null },
    setRequiredFeedback: value => feedback.push(value),
    nextRequiredMessage: () => 'Enter the brand name.',
    setMessage: () => assert.fail('Incomplete answers must stop before progressing'),
    setTimeout: () => assert.fail('Incomplete answers must not start a transition'),
  });
  next();
  assert.deepEqual(feedback, [true]);
});

test('ordinary register save carries selected photo URLs without changing replacement value', () => {
  const build = actualFunction('buildValuationSavePayload', {
    resultState: {kind:'generic', result:{sector:{key:'agricultural'},family:{key:'tractor'},brand:{slug:'test'},specsJson:{},year:2020,userReplacementPriceExVat:430000}},
    conversionAssetId:null,CURRENT_YEAR:2026,yearModelUnknown:false,toNumberOrNull:()=>null,
  });
  const payload=build({photos:['/api/asset-register/uploads/photo-a']});
  assert.deepEqual(payload.photos,['/api/asset-register/uploads/photo-a']);
  assert.equal(payload.userReplacementPriceExVat,430000);
  assert.equal(payload.saveForMarketplace,undefined);
});

test('save waits for selected photos and stops on upload failure', async () => {
  const saves=[], errors=[],busy=[];
  let fails=false;
  const confirm=actualFunction('confirmFinalSaveAction',{
    finalSaveIntent:'asset-register',savePhotoMode:'files',savePhotoFiles:['file'],
    setSaveLoading:v=>busy.push(v),setFinalSaveError:v=>errors.push(v),
    uploadMarketplacePhotos:async files=>{assert.deepEqual(files,['file']);if(fails)throw Error('Upload failed');return {urls:['/photo']}},
    saveCurrentValuationToRegister:async options=>{saves.push(options);return {assetId:'asset'}},
  });
  await confirm();
  assert.deepEqual(saves[0].photos,['/photo']);
  assert.equal(saves[0].redirectToAssetRegister,true);
  fails=true;await confirm();
  assert.equal(saves.length,1);
  assert.equal(errors.at(-1),'Upload failed');
  assert.equal(busy.at(-1),false);
});

test('skip excludes photos and Marketplace reuse is tied to the same estimate', async () => {
  for(const mode of ['skip','marketplace']){
    for(const same of [true,false]){
      const result={},saves=[];
      const confirm=actualFunction('confirmFinalSaveAction',{
        finalSaveIntent:'asset-register',savePhotoMode:mode,resultState:result,
        publishedEstimatePhotos:{result:same?result:{},urls:['/own-ad-photo']},
        setSaveLoading(){},setFinalSaveError(){},
        uploadMarketplacePhotos:()=>assert.fail('Existing URLs do not need uploading'),
        saveCurrentValuationToRegister:async options=>{saves.push(options);return {assetId:'asset'}},
      });
      await confirm();
      assert.deepEqual(saves[0].photos,mode==='marketplace'&&same?['/own-ad-photo']:[]);
    }
  }
});
