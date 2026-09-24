const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// Execute the actual client dismissal handler, with React setters recorded.
const source=fs.readFileSync('app/asset-register/asset-register-client.tsx','utf8');
const start=source.indexOf('  function backFromShareModal()');
const handler=source.slice(start,source.indexOf('  async function loadQuotePartners(',start));
function navigate(overrides={}) {
 const calls=[];
 const state={isSendingQuoteLead:false,isExporting:false,isQuoteMapExpanded:false,
  quoteLeadStep:null,selectedQuoteOption:null,directoryShareReturnRef:{current:null},
  assetShareDestination:'inside',isRegisterShareModalOpen:false,...overrides};
 for(const name of ['setIsQuoteMapExpanded','goBackToQuoteLeadMessage','closeQuoteLeadStep','goBackToQuoteOptions','setQuoteAsset','setSelectedQuoteLeadType','setQuoteScope','setIsRegisterShareModalOpen','setAssetShareDestination','setQuoteDirectoryStage','closeRegisterShareModal','closeAssetQuoteModal'])state[name]=(...args)=>calls.push([name,...args]);
 vm.runInNewContext(handler+'\nbackFromShareModal();',state);
 return calls;
}
test('directory returns to partner options; inside/outside returns to destination choices',()=>{
 assert.deepEqual(navigate({selectedQuoteOption:{leadType:'replacement_quote'}}),[['goBackToQuoteOptions']]);
 for(const assetShareDestination of ['inside','outside'])for(const isRegisterShareModalOpen of [false,true])
 assert.deepEqual(navigate({assetShareDestination,isRegisterShareModalOpen}),[['setAssetShareDestination','choice']]);
});
test('only first share screen closes the flow',()=>{
 assert.deepEqual(navigate({assetShareDestination:'choice'}),[['closeAssetQuoteModal']]);
 assert.deepEqual(navigate({assetShareDestination:'choice',isRegisterShareModalOpen:true}),[['closeRegisterShareModal']]);
});
test('external business share restores its directory and original asset scope',()=>{
 for(const register of [false,true]) {
  const asset={id:'selected-asset'};
  assert.deepEqual(navigate({assetShareDestination:'outside',directoryShareReturnRef:{current:{asset,leadType:'insurance',register}}}),[
   ['setQuoteAsset',asset],['setSelectedQuoteLeadType','insurance'],['setQuoteScope',register?'register':'asset'],['setIsRegisterShareModalOpen',false],['setAssetShareDestination','inside'],['setQuoteDirectoryStage','map']
  ]);
 }
});
test('nested share steps return one level and sending cannot be interrupted',()=>{
 assert.deepEqual(navigate({isQuoteMapExpanded:true}),[['setIsQuoteMapExpanded',false]]);
 assert.deepEqual(navigate({quoteLeadStep:'consent'}),[['goBackToQuoteLeadMessage']]);
 assert.deepEqual(navigate({quoteLeadStep:'message'}),[['closeQuoteLeadStep']]);
 assert.deepEqual(navigate({isSendingQuoteLead:true}),[]);
 assert.deepEqual(navigate({isExporting:true}),[]);
});
