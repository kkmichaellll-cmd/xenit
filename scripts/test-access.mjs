import ts from 'typescript';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const email=compile(fs.readFileSync('app/notification-email.ts','utf8'));
const store=compile(fs.readFileSync('app/server-store.ts','utf8').replace("'zod'",JSON.stringify(pathToFileURL(require.resolve('zod')).href)).replace("'./notification-email'",JSON.stringify(email)));
const applicationStorage=compile(fs.readFileSync('app/application-storage.ts','utf8').replaceAll("'./server-store'",JSON.stringify(store)));
const approval=compile(fs.readFileSync('app/approval-details.ts','utf8'));
const responseStub="const NextResponse={json:(data,init)=>Response.json(data,init)};";
const route=compile(fs.readFileSync('app/api/workspace/[...path]/route.ts','utf8').replace("import {NextResponse} from 'next/server';",responseStub).replace("'../../../server-store'",JSON.stringify(store)).replace("'../../../application-storage'",JSON.stringify(applicationStorage)).replace("'../../../approval-details'",JSON.stringify(approval)));
const {GET,POST}=await import(route), context=p=>({params:Promise.resolve({path:p.split('/')})});
delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.equal((await GET(new Request('https://app.test'),context('state'))).status,503);
process.env.NEXT_PUBLIC_SUPABASE_URL='https://db.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
assert.equal((await GET(new Request('https://app.test'),context('state'))).status,401);
const seen=[];globalThis.fetch=async(url)=>{seen.push(String(url));if(String(url).endsWith('/auth/v1/user'))return Response.json({id:'11111111-1111-4111-8111-111111111111',email:'tenant@example.test',email_confirmed_at:'2026-01-01'});return Response.json([])};
const sessionToken='test.'+Buffer.from(JSON.stringify({session_id:'44444444-4444-4444-8444-444444444444'})).toString('base64url')+'.test';
const headers={Authorization:'Bearer '+sessionToken,'Content-Type':'application/json'};
assert.equal((await GET(new Request('https://app.test',{headers}),context('properties'))).status,403);
assert.equal((await POST(new Request('https://app.test',{method:'POST',headers,body:JSON.stringify({id:'11111111-1111-4111-8111-111111111111',status:'Approved'})}),context('decision'))).status,403);
assert.equal((await POST(new Request('https://app.test',{method:'POST',headers,body:JSON.stringify({id:'11111111-1111-4111-8111-111111111111',status:'Approved'})}),context('decide-mailing'))).status,403);
assert.equal((await POST(new Request('https://app.test',{method:'POST',headers,body:JSON.stringify({id:'11111111-1111-4111-8111-111111111111',amount:2500})}),context('approve-lease'))).status,403);
const state=await (await GET(new Request('https://app.test',{headers}),context('state'))).json();assert.equal(state.isAdmin,false);assert.deepEqual(state.notifications,[]);
assert(seen.some(u=>u.includes('/applications?user_id=eq.11111111')));assert(seen.some(u=>u.includes('/receipts?user_id=eq.11111111')));
const publicRoute=compile(fs.readFileSync('app/api/properties/route.ts','utf8').replace("import {NextResponse} from 'next/server';",responseStub).replace("'../../server-store'",JSON.stringify(store)));
globalThis.fetch=async()=>Response.json([{data:{id:'home',title:'Home',lease:'12 months',deposit:1000},payment:{landlordName:'Private payee'}}]);
const list=await(await(await import(publicRoute)).GET()).json();assert.equal(list[0].lease,undefined);assert.equal(list[0].deposit,undefined);assert.equal(list[0].payment,undefined);
const schemas=await import(store);assert.equal(schemas.profileSchema.safeParse({name:'',address:'',phone:''}).success,false);assert.equal(schemas.propertySchema.safeParse({id:'../x'}).success,false);
console.log('PASS: setup/auth gates, admin denial, tenant-scoped queries, public privacy projection, input validation. Mocked transport; no live integration claimed.');
const appId='22222222-2222-4222-8222-222222222222',tenant='11111111-1111-4111-8111-111111111111';
let approved=false,mailingApproved=false,owner=tenant;const calls=[];
globalThis.fetch=async(url,init={})=>{const u=String(url);if(u.endsWith('/rpc/admin_session_check'))return Response.json(true);calls.push([u,init]);if(u.endsWith('/auth/v1/user'))return Response.json({id:tenant,email:'tenant@example.test',email_confirmed_at:'2026-01-01'});if(u.includes('/applications?'))return Response.json([{id:appId,user_id:owner,status:'Approved',property_id:'home'}]);if(u.includes('/receipts?'))return Response.json(approved?[{status:'Approved'}]:[]);if(u.includes('/mailing_receipts?application_id='))return Response.json(mailingApproved?[{status:'Approved'}]:[]);if(u.includes('/properties?'))return Response.json([{payment:{landlordName:'Test Owner',mailingAddress:'Test Address',amount:'350'}}]);if(u.includes('/mailing_receipts?id='))return Response.json([{user_id:owner,path:'private.pdf'}]);if(u.includes('/signed_leases?id='))return Response.json([{user_id:owner,path:'signed.pdf'}]);if(u.includes('/storage/v1/object/sign/'))return Response.json({signedURL:'/object/sign/receipts/private.pdf?test'});return Response.json([])};
const uploadRequest=()=>{const form=new FormData();form.set('applicationId',appId);form.set('file',new File(['%PDF-test sample'], 'receipt.pdf',{type:'application/pdf'}));return new Request('https://app.test',{method:'POST',headers:{Authorization:'Bearer test'},body:form})};
assert.equal((await POST(uploadRequest(),context('mailing-receipt'))).status,403);
assert(!calls.some(([u])=>u.includes('/storage/v1/object/receipts/')));
approved=true;
assert.equal((await POST(uploadRequest(),context('mailing-receipt'))).status,200);
assert(calls.some(([u])=>u.endsWith('/rpc/submit_mailing_receipt')));
const signedUploadRequest=()=>{const form=new FormData();form.set('applicationId',appId);form.set('file',new File(['%PDF-test signed lease'], 'signed-lease.pdf',{type:'application/pdf'}));return new Request('https://app.test',{method:'POST',headers:{Authorization:'Bearer test'},body:form})};
assert.equal((await POST(signedUploadRequest(),context('signed-lease'))).status,403);
mailingApproved=true;
assert.equal((await POST(signedUploadRequest(),context('signed-lease'))).status,200);
assert(calls.some(([u])=>u.endsWith('/rpc/submit_signed_lease')));
owner='33333333-3333-4333-8333-333333333333';
assert.equal((await GET(new Request('https://app.test',{headers}),context('mailing-receipt/'+appId))).status,404);
assert.equal((await GET(new Request('https://app.test',{headers}),context('signed-lease/'+appId))).status,404);
const sql=fs.readFileSync('supabase/migrations/20261017_mailing_receipts.sql','utf8');
assert(sql.includes("values('Mailing receipt submitted',a.code)"));
assert(sql.includes("status='Approved'"));
const leaseSql=fs.readFileSync('supabase/migrations/20261017_lease_workflow.sql','utf8');
assert(leaseSql.includes('decide_mailing_receipt'));
assert(leaseSql.includes("values('Signed lease submitted',a.code)"));
assert(leaseSql.includes("status='Approved'"));
const revealSql=fs.readFileSync('supabase/migrations/20261017_lease_payment_reveal.sql','utf8');
assert(revealSql.includes('approve_signed_lease'));
assert(revealSql.includes("status='Approved',payment_due=amount_due"));
assert(revealSql.includes('amount_due <= 0'));
console.log('PASS: mailing and signed-lease uploads enforce approval gates, admin-only payment reveal is defined, tenant file access is isolated, and submissions queue notifications. Mocked transport.');

let leaseApproved=false,duplicate=false,asAdmin=false,rpcFailure=false;
const moveCalls=[];
globalThis.fetch=async(url,init={})=>{
 const u=String(url);if(u.endsWith('/rpc/admin_session_check'))return Response.json(true);moveCalls.push([u,init]);
 if(u.endsWith('/auth/v1/user'))return Response.json({id:tenant,email:'tenant@example.test',email_confirmed_at:'2026-01-01'});
 if(u.includes('/admins?'))return Response.json(asAdmin?[{user_id:tenant}]:[]);
 if(u.includes('/applications?'))return Response.json([{id:appId,user_id:tenant,status:'Approved',property_id:'home'}]);
 if(u.includes('/signed_leases?application_id='))return Response.json(leaseApproved?[{status:'Approved',payment_due:2012}]:[]);
 if(u.includes('/move_in_receipts?application_id='))return Response.json(duplicate?[{id:appId}]:[]);
 if(u.includes('/move_in_receipts?id='))return Response.json([{user_id:owner,path:'private-move-in.pdf'}]);
 if(u.includes('/properties?'))return Response.json([{payment:{landlordName:'Test Owner',mailingAddress:'Test Address',amount:'350'}}]);
 if(u.endsWith('/rpc/submit_move_in_receipt')&&rpcFailure)return new Response('Conflict',{status:409});
 if(u.includes('/storage/v1/object/sign/'))return Response.json({signedURL:'/object/sign/receipts/private-move-in.pdf?test'});
 return Response.json([]);
};
assert.equal((await POST(uploadRequest(),context('move-in-receipt'))).status,403);
assert(!moveCalls.some(([u])=>u.includes('/storage/v1/object/receipts/')));
leaseApproved=true;
const moveResult=await POST(uploadRequest(),context('move-in-receipt'));
assert.equal(moveResult.status,200);
assert.equal((await moveResult.json()).message,'Money order submitted for review');
const movePayload=JSON.parse(moveCalls.find(([u])=>u.endsWith('/rpc/submit_move_in_receipt'))[1].body);
assert.equal(movePayload.actor,tenant);assert.equal(movePayload.app_id,appId);
assert.equal(movePayload.amount_value,undefined); // Database resolves the approved amount, not the browser or holding fee.
duplicate=true;const uploadCount=moveCalls.filter(([u])=>u.includes('/storage/v1/object/receipts/')).length;
assert.equal((await POST(uploadRequest(),context('move-in-receipt'))).status,409);
assert.equal(moveCalls.filter(([u])=>u.includes('/storage/v1/object/receipts/')).length,uploadCount);
duplicate=false;rpcFailure=true;
assert.equal((await POST(uploadRequest(),context('move-in-receipt'))).status,400);
assert(moveCalls.some(([u,init])=>u.endsWith('/storage/v1/object/receipts')&&init.method==='DELETE'));
rpcFailure=false;
assert.equal((await GET(new Request('https://app.test',{headers}),context('move-in-receipt/'+appId))).status,404);
const approveRequest=()=>new Request('https://app.test',{method:'POST',headers,body:JSON.stringify({id:appId})});
assert.equal((await POST(approveRequest(),context('approve-move-in-payment'))).status,403);
asAdmin=true;
assert.equal((await GET(new Request('https://app.test',{headers}),context('move-in-receipt/'+appId))).status,200);
assert.equal((await POST(approveRequest(),context('approve-move-in-payment'))).status,200);
assert(moveCalls.some(([u])=>u.endsWith('/rpc/approve_move_in_receipt')));
const moveSql=fs.readFileSync('supabase/migrations/20261017_move_in_receipts.sql','utf8');
assert(moveSql.includes('l.payment_due,p.payment'));
assert(moveSql.includes("values('First month rent + security deposit receipt submitted',a.code)"));
assert(moveSql.includes('enable row level security'));
console.log('PASS: move-in approval prerequisite, duplicate protection, private access, admin-only review, upload cleanup, server-owned amount and notification event. Mocked transport.');

let movePaymentApproved=false,secondMailingStatus='',secondOwner=tenant,secondAdmin=false;
const finalCalls=[];
globalThis.fetch=async(url,init={})=>{
 const u=String(url);if(u.endsWith('/rpc/admin_session_check'))return Response.json(true);finalCalls.push([u,init]);
 if(u.endsWith('/auth/v1/user'))return Response.json({id:tenant,email:'tenant@example.test',email_confirmed_at:'2026-01-01'});
 if(u.includes('/admins?'))return Response.json(secondAdmin?[{user_id:tenant}]:[]);
 if(u.includes('/applications?'))return Response.json([{id:appId,user_id:tenant,status:'Approved',property_id:'home'}]);
 if(u.includes('/move_in_receipts?application_id='))return Response.json(movePaymentApproved?[{status:'Approved'}]:[]);
 if(u.includes('/move_in_mailing_receipts?application_id=')){if(u.includes('status=eq.Approved')&&secondMailingStatus!=='Approved')return Response.json([]);return Response.json(secondMailingStatus?[{id:appId,status:secondMailingStatus,user_id:secondOwner,path:'second-mailing.pdf'}]:[]);}
 if(u.includes('/move_in_mailing_receipts?id='))return Response.json([{id:appId,status:'Submitted',user_id:secondOwner,path:'second-mailing.pdf'}]);
 if(u.includes('/access_cards?application_id='))return Response.json([]);
 if(u.includes('/properties?'))return Response.json([{payment:{landlordName:'Test Owner',mailingAddress:'Test Address',amount:'350'}}]);
 if(u.includes('/storage/v1/object/sign/'))return Response.json({signedURL:'/object/sign/receipts/second-mailing.pdf?test'});
 return Response.json([]);
};
assert.equal((await POST(uploadRequest(),context('move-in-mailing-receipt'))).status,403);
movePaymentApproved=true;
assert.equal((await POST(uploadRequest(),context('move-in-mailing-receipt'))).status,200);
assert(finalCalls.some(([u])=>u.endsWith('/rpc/submit_move_in_mailing_receipt')));
secondMailingStatus='Submitted';
assert.equal((await POST(uploadRequest(),context('move-in-mailing-receipt'))).status,409);
const imageRequest=()=>{const form=new FormData();form.set('applicationId',appId);form.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0])], 'photo.png',{type:'image/png'}));return new Request('https://app.test',{method:'POST',headers:{Authorization:'Bearer test'},body:form})};
assert.equal((await POST(imageRequest(),context('access-card'))).status,403);
const decideSecond=()=>new Request('https://app.test',{method:'POST',headers,body:JSON.stringify({id:appId,status:'Approved',note:''})});
assert.equal((await POST(decideSecond(),context('decide-move-in-mailing'))).status,403);
secondAdmin=true;
assert.equal((await POST(decideSecond(),context('decide-move-in-mailing'))).status,200);
secondAdmin=false;secondMailingStatus='Approved';
assert.equal((await POST(uploadRequest(),context('access-card'))).status,400);
assert.equal((await POST(imageRequest(),context('access-card'))).status,200);
assert(finalCalls.some(([u])=>u.endsWith('/rpc/create_access_card')));
const finalSql=fs.readFileSync('supabase/migrations/20261017_move_in_mailing_and_access_cards.sql','utf8');
assert(finalSql.includes("values('Move-in mailing receipt submitted',a.code)"));
assert(finalSql.includes("values('Access card photo submitted',a.code)"));
assert(finalSql.includes("status='Declined'"));
console.log('PASS: second mailing flow, admin decision gate, retry path, access-card prerequisite, image-only upload, and notification events. Mocked transport.');
// Verification records are administrator-only; no tenant can request signed links.
secondAdmin=false;
assert.equal((await GET(new Request('https://app.test',{headers}),context('application-verification/'+appId))).status,403);
assert.equal((await GET(new Request('https://app.test',{headers}),context('admin-session'))).status,403);
secondAdmin=true;
assert.equal((await GET(new Request('https://app.test',{headers}),context('admin-session'))).status,200);
const {notificationEmail}=await import(email);
for(const kind of ['Application approved','Holding payment approved','Mailing validation approved','Lease approved','Move-in payment approved','Access card ready']){
 const message=notificationEmail({kind,audience:'tenant',reference:'APP-123',payload:{name:'<script>alert(1)</script>',property:'Sample Home'}},'https://example.test');
 assert(message.html.includes('Xenit Realty'));assert(message.html.includes('https://example.test/dashboard'));
 assert(!message.html.includes('<script>'));assert(message.text.includes('APP-123'));
}
process.env.RESEND_API_KEY='test-key';process.env.EMAIL_FROM='Xenit Realty <test@example.test>';process.env.ADMIN_EMAIL='one@example.test,two@example.test';process.env.NEXT_PUBLIC_SITE_URL='https://example.test';
const sentEmails=[];const updates=[];
globalThis.fetch=async(url,init={})=>{
 if(String(url).includes('/notifications?status='))return Response.json([{id:'job-admin',kind:'Application submitted',reference:'APP-123',audience:'admin'},{id:'job-tenant',kind:'Lease approved',reference:'APP-123',audience:'tenant',recipient:'tenant@example.test',payload:{name:'Tenant'}}]);
 if(String(url)==='https://api.resend.com/emails'){sentEmails.push(JSON.parse(init.body));assert(init.headers['Idempotency-Key']);return Response.json({id:'email-test'})}
 if(init.method==='PATCH'){updates.push(JSON.parse(init.body));return new Response(null,{status:204})}
 return Response.json([]);
};
await schemas.deliverEmails();assert.equal(sentEmails.length,2);assert.deepEqual(sentEmails[0].to,['one@example.test','two@example.test']);assert.deepEqual(sentEmails[1].to,['tenant@example.test']);assert(updates.every(x=>x.status==='sent'));
console.log('PASS: administrator-only verification, approval email templates, HTML escaping, recipient routing and idempotent delivery. Mocked transport.');
const {saveApplication}=await import(applicationStorage);
let submittedBody=null;
globalThis.fetch=async(url,init={})=>{
 const path=String(url);
 if(path.includes('/properties?'))return Response.json([{data:{id:'home',title:'Home',rent:1000,status:'Available'}}]);
 if(path.includes('/rpc/submit_verified_application')){submittedBody=JSON.parse(init.body);return Response.json({id:appId,code:'APP-TEST',status:submittedBody.new_status})}
 if(path.includes('/storage/v1/object/receipts/'))return Response.json({Key:'test'});
 return Response.json([]);
};
function applicationRequest({complete=true,draft=false}={}){
 const f=new FormData();for(const [key,value] of Object.entries({id:appId,propertyId:'home',name:'Test Tenant',phone:'123456789',moveIn:'2099-01-01',occupants:'1',lease:'12 months',employment:'Employed',income:'5000',eviction:'No',pets:'No',notes:'',consent:'on',status:draft?'Draft':'Pending',ssnLast4:'1234',idType:'State ID'}))f.set(key,value);
 if(complete)for(const key of ['idFront','idBack','incomeProof','addressProof'])f.set(key,new File([new Uint8Array([137,80,78,71,13,10,26,10,0])],key+'.png',{type:'image/png'}));
 return new Request('https://app.test',{method:'POST',body:f});
}
await assert.rejects(()=>saveApplication(applicationRequest({complete:false}),{id:tenant,email:'tenant@example.test'},{data:{address:'Example'}}),/upload all four/);
const applied=await saveApplication(applicationRequest(),{id:tenant,email:'tenant@example.test'},{data:{address:'Example'}});
assert.equal(applied.code,'APP-TEST');assert.equal(submittedBody.ssn_value,'1234');assert.equal(submittedBody.details.ssnLast4,undefined);assert.equal(Object.keys(submittedBody.documents_value).length,4);
const draft=await saveApplication(applicationRequest({complete:false,draft:true}),{id:tenant,email:'tenant@example.test'},{data:{address:'Example'}});assert.equal(draft.status,'Draft');
console.log('PASS: required verification, private SSN separation, four document uploads, and incomplete draft persistence. Mocked transport.');

// Explicit single-session API enforcement with mocked atomic database RPCs.
let activeSession=null;const sessionA='44444444-4444-4444-8444-444444444444',sessionB='55555555-5555-4555-8555-555555555555';
let protectedReads=0;
globalThis.fetch=async(url,init={})=>{
 const u=String(url);
 if(u.endsWith('/auth/v1/user'))return Response.json({id:tenant,email:'admin@example.test',email_confirmed_at:'2026-01-01'});
 if(u.includes('/admins?'))return Response.json([{user_id:tenant}]);
 if(u.includes('/rpc/admin_session_')){const {session}=JSON.parse(init.body);if(u.endsWith('_claim')){if(activeSession&&activeSession!==session)return Response.json(false);activeSession=session;return Response.json(true)}if(u.endsWith('_release')){if(activeSession===session)activeSession=null;return Response.json(true)}return Response.json(activeSession===session)}
 protectedReads++;return Response.json([]);
};
const adminReq=(session,method='GET')=>new Request('https://app.test',{method,headers:{Authorization:'Bearer test.'+Buffer.from(JSON.stringify({session_id:session})).toString('base64url')+'.test'},...(method==='POST'?{body:'{}'}:{})});
assert.equal((await POST(adminReq(sessionA,'POST'),context('admin-session'))).status,200);
assert.equal((await POST(adminReq(sessionB,'POST'),context('admin-session'))).status,409);
assert.equal(activeSession,sessionA);
assert.equal((await GET(adminReq(sessionA),context('properties'))).status,200);
const before=protectedReads;
assert.equal((await GET(adminReq(sessionB),context('state'))).status,401);
assert.equal((await POST(adminReq(sessionB,'POST'),context('approve-move-in-payment'))).status,401);
assert.equal(protectedReads,before);
assert.equal((await POST(adminReq(sessionB,'POST'),context('admin-session/logout'))).status,200);
assert.equal(activeSession,sessionA);
assert.equal((await POST(adminReq(sessionA,'POST'),context('admin-session/logout'))).status,200);
assert.equal((await GET(adminReq(sessionA),context('properties'))).status,401);
assert.equal((await POST(adminReq(sessionB,'POST'),context('admin-session'))).status,200);
activeSession=null; // RPC models expiry.
assert.equal((await GET(adminReq(sessionB),context('properties'))).status,401);
assert.equal((await POST(adminReq(sessionA,'POST'),context('admin-session'))).status,200);
const sessionSql=fs.readFileSync('supabase/migrations/20261018_admin_single_session.sql','utf8');
assert(sessionSql.includes('on conflict(user_id) do update'));
assert(sessionSql.includes("interval '12 hours'"));
assert(sessionSql.includes('where user_id=actor and session_id=session'));
console.log('PASS: blocked second admin login, protected data/actions, first-session preservation, scoped logout, re-login and expiry. Mocked database; live concurrency requires configured Supabase.');
