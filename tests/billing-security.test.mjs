import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,deps){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};Function('require','module','exports',code)(id=>id in deps?deps[id]:require(id),module,module.exports);return module.exports;}
const {NextRequest}=require('next/server');
class BillingError extends Error {}
test('Admin API rejects non-admin sessions, cross-origin writes and malformed requests before mutation',async()=>{
 let allowed=false,writes=0;
 const route=load('app/api/admin/billing/route.ts',{
  '../../../../lib/admin-api-access':{requireAdminApiAccess:async()=>allowed?{ok:true,actor:{userId:'admin'}}:{ok:false,response:Response.json({error:'Forbidden'},{status:403})}},
  '../../../../lib/trusted-request-origin':load('lib/trusted-request-origin.ts',{}),
  '../../../../lib/billing':{BillingError,createBillingDraft:async()=>{writes++;return 'draft';}},
 });
 const request=(origin,body='{"action":"create_draft"}')=>new NextRequest('https://aim4price.com/api/admin/billing',{method:'POST',headers:{origin,'Content-Type':'application/json'},body});
 assert.equal((await route.POST(request('https://aim4price.com'))).status,403);
 assert.equal((await route.GET(new NextRequest('https://aim4price.com/api/admin/billing'))).status,403);
 allowed=true;
 assert.equal((await route.POST(request('https://untrusted.test'))).status,403);
 assert.equal((await route.POST(request('null'))).status,403);
 assert.equal((await route.POST(request('https://aim4price.com','{'))).status,400);
 assert.equal(writes,0);
 assert.equal((await route.POST(request('https://aim4price.com'))).status,200);assert.equal(writes,1);
});
test('Invoice downloads require a real session and enforce owner access before rendering',async()=>{
 let session=null,renders=0,lookup=0;
 const route=load('app/api/billing/invoices/[id]/route.ts',{
  '../../../../../lib/auth-session':{getAnyServerSession:async()=>session},
  '../../../../../lib/account-constants':{isAim4priceAdminEmail:email=>email==='admin@example.test'},
  '../../../../../lib/billing':{BillingError,mapInvoice:x=>x,getBillingInvoice:async(id,userId,admin)=>{lookup++;if(!admin&&userId!=='owner')throw new BillingError();return {id,number:'A4P-test',status:'issued'};}},
  '../../../../../lib/billing-report':{buildBillingInvoiceHtml:async()=>'<html></html>'},
  '../../../../../lib/billing-mail':{billingPdf:async()=>{renders++;return Buffer.from('%PDF-fixture');}},
 });
 const request=new NextRequest('https://aim4price.com/api/billing/invoices/test?format=pdf'),params={params:{id:'test'}};
 assert.equal((await route.GET(request,params)).status,401);assert.equal(lookup,0);
 session={user:{id:'another',email:'other@example.test'}};
 assert.equal((await route.GET(request,params)).status,404);assert.equal(renders,0);
 session={user:{id:'owner',email:'owner@example.test'}};
 const response=await route.GET(request,params);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.equal(renders,1);
});
test('Signup uses the server quote and rejects a changed price before creating the account',async()=>{
 let calls=0,context;const trustedQuote={plan:{amountCents:50000}};
 const route=load('app/api/auth/[...all]/route.ts',{
  '../../../../lib/billing':{BillingError,validateSignupBilling:async input=>{if(!input.billingAccepted)throw new BillingError('Accept current price');return trustedQuote;}},
  'better-auth/next-js':{toNextJsHandler:()=>({GET:()=>{},POST:async()=>{calls++;return Response.json({ok:true});}})},
  '../../../../lib/auth':{auth:{}},
  '../../../../lib/signup-workspace-context':{withSignupWorkspaceInput:async(input,fn)=>{context=input;return fn();}},
 });
 const req=input=>new Request('https://aim4price.com/api/auth/sign-up/email',{method:'POST',body:JSON.stringify(input)});
 assert.equal((await route.POST(req({billingAccepted:false}))).status,400);assert.equal(calls,0);
 assert.equal((await route.POST(req({billingAccepted:true,billingSignup:{plan:{amountCents:1}}}))).status,200);
 assert.deepEqual(context.billingSignup,trustedQuote);assert.equal(calls,1);
});
test('Signup wizard permits early steps and requires invoice consent only at the final step',()=>{
 const source=readFileSync(new URL('../app/auth/auth-client.tsx',import.meta.url),'utf8');
 const start=source.indexOf('  const validateSignupStep ='),end=source.indexOf('  const selectedBillingPlan =',start);
 const code=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const form={name:'Example',phone:'0821234567',email:'example@example.test',introducedByName:'',introducedByOption:'direct',province:'Western Cape',townCity:'George',password:'long-password',confirmPassword:'long-password',acceptTerms:true};
 const billing={accepted:false,address:''};const notices=[];
 const validate=Function('billingPricingError','selectedBillingPlan','billing','signupForm','setNotice','returnToSignupStep',code+';return validateSignupStep;')('',{amountCents:50000},billing,form,n=>notices.push(n),()=>{});
 assert.equal(validate(1),true);assert.equal(validate(2),true);assert.equal(validate(3),false);
 billing.accepted=true;billing.address='George';assert.equal(validate(3),true);
 assert.equal(notices[0].title,'Invoice details required');
});
