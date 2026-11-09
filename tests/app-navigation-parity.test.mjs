import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const accessModule={exports:{}};
new Function('exports', ts.transpileModule(readFileSync('lib/dealer-app-access.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(accessModule.exports);
function load(path, pathname, role=null) {
  const calls=[];const jsx=(type,props)=>({type,props});
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',code)(name=>{
    if(name==='react')return {useState:initial=>[path.includes('bottom-nav')?role:initial,()=>{}],useEffect(){}};
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
    if(name==='next/navigation')return {usePathname:()=>pathname,useRouter:()=>({back:()=>calls.push('back'),push:x=>calls.push(x),replace:x=>calls.push(x)})};
    if(name.includes('use-dealer-app-root'))return {useDealerAppRoot:()=>pathname.startsWith('/middleman')?'/middleman':'/dealer'};
    if(name.includes('dealer-app-access'))return accessModule.exports;
    return {__esModule:true,default:name.endsWith('.css')?new Proxy({},{get:(_,key)=>key}):name};
  },mod,mod.exports);return {Component:mod.exports.default,calls};
}
function nodes(n){if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(nodes);return [n,...nodes(n.props?.children)];}
test('Dealer and Middleman keep Back/Home and home settings in the correct realm',()=>{
  for(const root of ['/dealer','/middleman'])for(const path of [root,root+'/marketplace',root+'/notifications']){
    const {Component}=load('app/dealer/dealer-nav.tsx',path);const all=nodes(Component({}));
    assert.equal(all.filter(x=>x.props?.['aria-label']==='Back').length,1);
    assert.equal(all.find(x=>x.props?.['aria-label']?.endsWith('App home')).props.href,root);
    assert.equal(all.some(x=>x.props?.offlineHref===root+'/offline.html'),path===root);
  }
});
test('wizard Back calls its handler and respects disabled state; login has no app navigation',()=>{
  let count=0;for(const disabled of [true,false]){const {Component}=load('app/dealer/dealer-nav.tsx','/middleman/valuation');const back=nodes(Component({onBack:()=>count++,backDisabled:disabled})).find(x=>x.props?.['aria-label']==='Back');back.props.onClick();}assert.equal(count,1);
  for(const root of ['/dealer','/middleman']){const {Component}=load('app/dealer/dealer-nav.tsx',root+'/login');assert.equal(Component({}),null);}
});
test('Field Manager navigation works on deep links and remains hidden on login',()=>{
 const original=globalThis.window;try{globalThis.window={history:{length:1}};const {Component,calls}=load('app/field-manager/field-manager-top-nav.tsx','/field-manager/assets/abc');const all=nodes(Component());all.find(x=>x.props?.['aria-label']==='Back').props.onClick();assert.deepEqual(calls,['/field-manager/assets']);assert.equal(all.find(x=>x.props?.['aria-label']==='Field Manager home').props.href,'/field-manager');assert.equal(load('app/field-manager/field-manager-top-nav.tsx','/field-manager/login').Component(),null);}finally{globalThis.window=original;}
});
test('bottom navigation fails closed, respects role tools, and excludes capture forms',()=>{
 for(const root of ['/dealer','/middleman']){
  assert.equal(load('app/dealer/dealer-bottom-nav.tsx',root,null).Component(),null);
  for(const path of ['/valuation','/marketplace/create','/login'])assert.equal(load('app/dealer/dealer-bottom-nav.tsx',root+path,'owner').Component(),null);
  const links=nodes(load('app/dealer/dealer-bottom-nav.tsx',root,'technician').Component()).filter(n=>n.props?.href);
  assert(links.every(n=>n.props.href.startsWith(root)));
  assert(!links.some(n=>n.props.href.includes('/marketplace')));
  assert(!links.some(n=>root==='/middleman'&&n.props.href.includes('/maintenance')));
 }
});
