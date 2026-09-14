import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const client = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
const source = client.slice(client.indexOf('  function chooseRevaluePrice('), client.indexOf('  function openSavedReplacementPreview('));
const js = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const run = new Function('state', `
  let {pricingPreview,revalueQuestion}=state;
  const isLoadingPricingPreview=!!state.busy,isSavingPricingPreview=false;
  const shouldShowRevalueLifetimeInput=asset=>!asset.percent;
  const setRevalueQuestion=value=>state.question=value;
  const setSaveReplacementPriceWithRevalue=value=>state.persist=value;
  const setRevalueReplacementPriceError=value=>state.priceError=value;
  const setRevalueAdvancedError=value=>state.lifetimeError=value;
  const readCustomRevalueReplacementPrice=()=>state.price??null;
  const openSavedReplacementPreview=()=>state.preview='saved';
  const openCustomReplacementPreview=()=>state.preview='custom';
  const setPricingPreview=value=>state.nextPreview=value;
  const showSavedReplacementStep=()=>state.question='price';
  ${js}
  if(state.action==='saved')chooseRevaluePrice(pricingPreview.asset);
  else if(state.action==='persist')chooseRevaluePersistence(pricingPreview.asset,state.save);
  else if(state.action==='back')handlePreviousRevalueStep();
  else continueRevalueQuestion();
  return state;
`);
const base={pricingPreview:{method:'aim4price',replacementMode:'custom',asset:{percent:false}},revalueQuestion:'price',price:475000};
test('saved replacement asks lifetime only when needed',()=>{
  assert.equal(run({...base,action:'saved'}).question,'lifetime');
  assert.equal(run({...base,pricingPreview:{...base.pricingPreview,asset:{percent:true}},action:'saved'}).preview,'saved');
});
test('custom price is validated before the independent persistence question',()=>{
  assert.ok(run({...base,price:null}).priceError);
  const valid=run({...base});assert.equal(valid.question,'save');assert.equal(valid.preview,undefined);
});
test('both persistence choices advance without saving the asset',()=>{
  for(const save of [true,false]){
    const state=run({...base,action:'persist',save});assert.equal(state.persist,save);assert.equal(state.question,'lifetime');assert.equal(state.preview,undefined);
    assert.equal(run({...base,pricingPreview:{...base.pricingPreview,asset:{percent:true}},action:'persist',save}).preview,'custom');
  }
});
test('lifetime confirmation previews the correct price mode',()=>{
  assert.equal(run({...base,revalueQuestion:'lifetime'}).preview,'custom');
  assert.equal(run({...base,pricingPreview:{...base.pricingPreview,replacementMode:null},revalueQuestion:'lifetime'}).preview,'saved');
});
test('Back revisits the last question and clears a result without discarding price mode',()=>{
  const state=run({...base,pricingPreview:{...base.pricingPreview,result:{item:{}}},action:'back'});
  assert.equal(state.question,'lifetime');assert.equal(state.nextPreview.result,null);assert.equal(state.nextPreview.replacementMode,'custom');
  assert.equal(run({...base,revalueQuestion:'lifetime',action:'back'}).question,'save');
  assert.equal(run({...base,revalueQuestion:'save',action:'back'}).question,'price');
  assert.equal(run({...base,action:'back',busy:true}).question,undefined);
});
