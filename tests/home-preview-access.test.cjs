const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,deps){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;Function('require','module','exports',code)(id=>{if(id in deps)return deps[id];throw Error('Unexpected dependency '+id)},m,m.exports);return m.exports;}
const {canViewTutorialPreview}=load('lib/tutorial-preview-access.ts',{'./account-constants':{normalizeEmail:v=>(v||'').trim().toLowerCase(),isAim4priceAdminEmail:v=>v==='aim4price@gmail.com'}});
function page(user){return load('app/home-preview/[audience]/page.tsx',{
 'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
 'next/navigation':{notFound(){throw Error('404')},redirect(url){throw Error(url)}},
 '../../../components/AppHeader':{default:()=>null},
 '../../../lib/auth-session':{getAnyServerSession:async()=>user?{user}:null},
 '../../../lib/tutorial-preview-access':{canViewTutorialPreview},
 '../audience-home':{default:()=>null},'../../page.module.css':{default:{page:'page'}}});}
test('anonymous previews require sign-in with exact return path',async()=>{for(const audience of ['dealers','businesses'])await assert.rejects(()=>page(null).default({params:{audience}}),e=>e.message===`/auth?returnTo=${encodeURIComponent('/home-preview/'+audience)}#login`)});
test('ordinary signed-in accounts cannot view either home',async()=>{for(const audience of ['dealers','businesses'])await assert.rejects(()=>page({id:'other',email:'other@example.test'}).default({params:{audience}}),/404/)});
test('only approved preview and admin sessions can render both variants',async()=>{for(const email of ['kallageldenhuys@gmail.com','aim4price@gmail.com'])for(const audience of ['dealers','businesses']){const result=await page({id:'allowed',email}).default({params:{audience}});assert.equal(result.props.children[1].props.audience,audience)}});
test('unknown audiences return 404 and previews prohibit indexing',async()=>{const p=page({id:'allowed',email:'kallageldenhuys@gmail.com'});await assert.rejects(()=>p.default({params:{audience:'owners'}}),/404/);assert.deepEqual(p.metadata.robots,{index:false,follow:false,nocache:true})});
