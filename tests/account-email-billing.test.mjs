import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(file,deps){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};Function('require','module','exports',code)(id=>{if(!(id in deps))throw Error(id);return deps[id];},module,module.exports);return module.exports;}
test('billing preferences reject unauthenticated, cross-origin and malformed writes and use only the session owner',async()=>{
 let user=null;const writes=[];
 const route=load('app/api/account-profile/billing-preferences/route.ts',{
 '../../../../lib/auth':{auth:{api:{getSession:async()=>user?{user}:null}}},
 '../../../../lib/trusted-request-origin':load('lib/trusted-request-origin.ts',{}),
 '../../../../lib/billing-preferences':{receivesBillingEmails:async()=>true,saveBillingEmailPreference:async(...args)=>writes.push(args)},
 });
 const req=(body,origin='https://www.aim4price.com')=>new Request('https://internal.railway.test/api/account-profile/billing-preferences',{method:'PUT',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await route.PUT(req({enabled:false}))).status,401);
 user={id:'signed-in-owner'};
 assert.equal((await route.PUT(req({enabled:false},'https://attacker.test'))).status,403);
 assert.equal((await route.PUT(req({enabled:'false'}))).status,400);
 assert.equal((await route.PUT(req({enabled:false,userId:'victim'}))).status,200);
 assert.deepEqual(writes,[['signed-in-owner',false]]);
});
test('email changes require the exact phrase before reaching the authentication handler',async()=>{
 let forwarded=0;
 const route=load('app/api/auth/[...all]/route.ts',{
 '../../../../lib/retired-workspaces':{},'../../../../lib/billing':{},'../../../../lib/auth':{auth:{}},'../../../../lib/signup-workspace-context':{},
 'better-auth/next-js':{toNextJsHandler:()=>({GET:()=>{},POST:async()=>{forwarded++;return Response.json({status:true});}})},
 });
 const req=confirmation=>new Request('https://www.aim4price.com/api/auth/change-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({newEmail:'new@example.test',confirmation})});
 for(const phrase of [undefined,'','change email','CHANGE EMAIL '])assert.equal((await route.POST(req(phrase))).status,400);
 assert.equal(forwarded,0);assert.equal((await route.POST(req('CHANGE EMAIL'))).status,200);assert.equal(forwarded,1);
 const auth=readFileSync(new URL('../lib/auth.ts',import.meta.url),'utf8');
 assert.match(auth,/updateEmailWithoutVerification:\s*false/);
 assert.match(auth,/sendChangeEmailConfirmation/);
});
