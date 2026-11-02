import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);

// Exercise the component's state transitions without depending on browser geometry.
function pickerHarness(overrides = {}) {
  const state = []; let cursor = 0;
  const hooks = { useState(initial) { const i=cursor++; if (!(i in state)) state[i]=initial; return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}]; }, useEffect(){}, useRef(){return {current:null};} };
  const module = {exports:{}};
  const source=readFileSync(new URL('../components/asset-register/MoveAssetDestinationPicker.tsx',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('module','exports','require',code)(module,module.exports,name=>name==='react'?hooks:name.endsWith('.css')?{default:{}}:name==='./RegisterPickerRow'?{default:'picker-row'}:require(name));
  let created=0,moved=0,closed=0;
  const props={assetName:'Tractor',assetDetails:'Year Model: 2022',sourceName:'Farm',destination:'register',onDestinationChange:v=>{props.destination=v;},options:[],targetId:'',onSelect:v=>{props.targetId=v;},canUseUmbrellas:true,loading:false,loadError:'',error:'',busy:false,managementHref:'/asset-registers',onRetry(){},onClose(){closed++;},onMove(){moved++;},onCreateRegister(){created++;props.suspended=true;},onCreateUmbrella(){created++;props.suspended=true;},...overrides};
  const render=()=>{cursor=0;return module.exports.default(props);};
  const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...[].concat(tree.props?.children??[]).flat(Infinity).flatMap(nodes)];
  const text=node=>typeof node==='string'?node:typeof node==='number'?String(node):[].concat(node?.props?.children??[]).flat(Infinity).map(text).join('');
  const button=label=>nodes(render()).find(n=>n.type==='button'&&text(n).trim()===label);
  return {props,render,nodes,button,text,counts:()=>({created,moved,closed})};
}

test('Add register clears search and resumes the same move step with the selected destination',()=>{
 const h=pickerHarness(); h.button('Asset RegisterMove to another asset register.').props.onClick();
 const search=h.nodes(h.render()).find(n=>n.type==='input');search.props.onChange({target:{value:'old filter'}});
 h.button('+ Add register').props.onClick();assert.equal(h.render(),null);assert.equal(h.counts().created,1);assert.equal(h.counts().moved,0);
 h.props.suspended=false;h.props.options=[{value:'new',label:'New register'}];h.props.targetId='new';
 const resumed=h.render();assert.equal(h.nodes(resumed).find(n=>n.type==='input').props.value,'');
 assert.match(h.text(resumed),/Selected asset registerNew register/);
 assert.equal(h.button('Move asset').props.disabled,false);
 h.button('Move asset').props.onClick();assert.equal(h.counts().moved,1);
});

test('cancelling creation preserves asset context and never moves the asset',()=>{
 const h=pickerHarness();h.button('Asset RegisterMove to another asset register.').props.onClick();h.button('+ Add register').props.onClick();
 h.props.suspended=false;
 assert.match(h.text(h.render()),/Tractor/);assert.equal(h.button('Move asset').props.disabled,true);assert.equal(h.counts().moved,0);
});

test('umbrella and register steps use matching actions and busy state prevents dismissal',()=>{
 const h=pickerHarness();h.button('UmbrellaGroup with assets under an umbrella.').props.onClick();
 assert.ok(h.button('+ Add umbrella'));assert.equal(h.button('+ Add register'),undefined);
 h.props.busy=true;assert.equal(h.button('+ Add umbrella').props.disabled,true);
 const dialog=h.nodes(h.render()).find(n=>n.props?.role==='dialog');dialog.props.onKeyDown({key:'Escape',stopPropagation(){}});
 assert.equal(h.counts().closed,0);
});
