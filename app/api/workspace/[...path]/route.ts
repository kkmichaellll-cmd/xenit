import {specialRequest} from '../../../rent-special-server';
import {utilityReady,utilitySettingsSchema} from '../../../utility-hoa-settings';
import {utilityRequest} from '../../../utility-hoa-server';
import {z} from 'zod';
import {availabilityAdmin} from '../../../availability-server';
import {depositReviewRpc} from '../../../deposit-review-server';
import {countersignLease} from '../../../lease-signing-server';
import {mailingCopy} from '../../../mailing-instructions-copy';
import {paymentMailingAddress} from '../../../payment-address';
import {UploadError,uploadControl,readUploadForm} from '../../../document-uploads';
import {MAX_UPLOAD_BYTES} from '../../../upload-limits';
import {NextResponse,after} from 'next/server';
import {adminSession,admin,applicationSchema,config,deliverEmails,paymentSchema,profileSchema,propertySchema,sb,user} from '../../../server-store';
import {saveApplication} from '../../../application-storage';
import {leaseEnd} from '../../../approval-details';
export const dynamic='force-dynamic';
export const maxDuration=300;
const queueEmails=()=>after(()=>deliverEmails().catch(()=>{}));
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const uuid=/^[0-9a-f-]{36}$/i;
async function handle(req:Request,{params}:{params:Promise<{path:string[]}>}){
 try{
 const path=(await params).path.join('/'),u=await user(req),isAdmin=await admin(u.id);
 if(path==='admin-session/logout'&&req.method==='POST'){if(isAdmin)await adminSession(req,u.id,'release');return json({ok:true})}
 if(path==='admin-session'&&req.method==='POST'){if(!isAdmin)return json({error:'Admin access required'},403);await adminSession(req,u.id,'claim');return json({ok:true})}
 if(isAdmin)await adminSession(req,u.id,'check');
 if(req.method==='POST'&&(path==='access-card-print'||path==='access-card-review')){
  const fee=z.number().finite().min(0).max(10000000).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001);
  const body=await req.json();
  const id=z.string().uuid().parse(body.applicationId);
  if(path==='access-card-review'&&!isAdmin)return json({error:'Admin access required'},403);
  const action=path==='access-card-print'?'request':z.literal('approve').parse(body.action);
  const charges=action==='request'?null:z.object({hoa:fee,electric:fee,internet:fee,lastRent:fee}).strict().parse(body.charges);
  const a=(await sb('/rest/v1/applications?id=eq.'+id))[0];
  if(!a||(!isAdmin&&a.user_id!==u.id)||a.status!=='Approved')return json({error:'Application is not available.'},403);
  const settings=action==='approve'?utilitySettingsSchema.parse({...body.settings,...charges}):null;
  try{await sb('/rest/v1/rpc/'+(action==='approve'?'approve_access_card_with_utility':'access_card_print_action'),{method:'POST',body:JSON.stringify(action==='approve'?{actor:u.id,app_id:id,charges,details:settings}:{actor:u.id,app_id:id,action,charges})})}
  catch(e){console.error('Access-card request failed',e);return json({error:'The access-card request could not be saved. Please ask the administrator to check the access-card setup, then retry. Your uploaded photo is still saved.'},503)}
  queueEmails();return json({ok:true});
 }
 if(path.startsWith('rent-special/')){const result=await specialRequest(req,path,u.id,isAdmin);if(req.method==='POST')queueEmails();return json(result)}
 if(path.startsWith('utility-hoa/')){const result=await utilityRequest(req,path,u.id,isAdmin);if(req.method==='POST')queueEmails();return json(result)}
 if(path==='availability'||path.startsWith('availability/'))return availabilityAdmin(req,path,isAdmin,u.id);
 if(req.method==='POST'&&(path==='uploads/sign'||path==='uploads/cancel'))return json(await uploadControl(req,u.id,path.split('/')[1]));
 const own=(await sb('/rest/v1/profiles?user_id=eq.'+u.id))[0];
 if(req.method==='GET'&&path==='admin-session'){return isAdmin?json({ok:true}):json({error:'Admin access required'},403)}
 if(req.method==='GET'&&path.startsWith('application-verification/')){
  if(!isAdmin)return json({error:'Admin access required'},403);
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const v=(await sb('/rest/v1/application_verifications?application_id=eq.'+id))[0];
  if(!v)return json({documents:[]});
  const documents=[];for(const [kind,doc] of Object.entries(v.documents||{}) as [string,any][]){const signed=await sb('/storage/v1/object/sign/receipts/'+doc.path,{method:'POST',body:JSON.stringify({expiresIn:60})});documents.push({kind,filename:doc.filename,url:config().url+'/storage/v1'+signed.signedURL})}
  return json({ssnLast4:v.ssn_last4,idType:v.id_type,documents});
 }
 if(req.method==='POST'&&path==='application'){
  try{const result=await saveApplication(req,u,own);queueEmails();return json(result)}catch(e){return json({error:(e as Error).message.startsWith('[')?'Please complete the required fields.':(e as Error).message},400)}
 }
 if(req.method==='GET'&&path==='state'){
  const apps=await sb('/rest/v1/applications?'+(isAdmin?'':'user_id=eq.'+u.id+'&')+'order=created_at.desc');
  const receipts=await sb('/rest/v1/receipts?'+(isAdmin?'':'user_id=eq.'+u.id+'&')+'order=created_at.desc');
  const mailing=await sb('/rest/v1/mailing_receipts?'+(isAdmin?'':'user_id=eq.'+u.id+'&')+'order=created_at.desc');
  const leases=await sb('/rest/v1/signed_leases?'+(isAdmin?'':'user_id=eq.'+u.id+'&')+'order=created_at.desc');
  const moveInMailing=await sb('/rest/v1/move_in_mailing_receipts?'+(isAdmin?'':'user_id=eq.'+u.id+'&')+'order=created_at.desc');
  const accessCards=await sb('/rest/v1/access_cards?'+(isAdmin?'':'user_id=eq.'+u.id+'&')+'order=created_at.desc');
  const moveIn=await sb('/rest/v1/move_in_receipts?'+(isAdmin?'':'user_id=eq.'+u.id+'&')+'order=created_at.desc');
  return json({accessCards:accessCards.map(({photo_path:_path,...r}:any)=>r),moveInMailingReceipts:moveInMailing.map(({path:_path,...r}:any)=>r),moveInReceipts:moveIn.map(({path:_path,...r}:any)=>r),signedLeases:leases.map(({path:_path,completed_path:_completed,...r}:any)=>({...r,completed:!!_completed})),mailingReceipts:mailing.map(({path:_path,...r}:any)=>r),profile:own?{...own.data,email:u.email}:null,email:u.email,isAdmin,applications:apps.map((a:any)=>({...a.data,id:a.id,code:a.code,status:a.status,updatedAt:a.updated_at,letterDownloadedAt:a.letter_downloaded_at,paymentReleasedAt:a.payment_released_at})),receipts:receipts.map(({path:_path,...r}:any)=>r),notifications:isAdmin?await sb('/rest/v1/notifications?order=created_at.desc&limit=100'):[]});
 }
 if(req.method==='GET'&&path.startsWith('completed-lease/')){
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const lease=(await sb('/rest/v1/signed_leases?id=eq.'+id))[0];
  if(!lease||(!isAdmin&&lease.user_id!==u.id)||!lease.completed_path)return json({error:'Completed lease is not available.'},404);
  const signed=await sb('/storage/v1/object/sign/receipts/'+lease.completed_path,{method:'POST',body:JSON.stringify({expiresIn:60})});
  return json({url:config().url+'/storage/v1'+signed.signedURL,filename:lease.completed_filename});
 }
 if(req.method==='GET'&&path.startsWith('payment-receipt/')){
  const [,id,kind]=path.split('/');if(!uuid.test(id)||!['rent','deposit'].includes(kind))return json({error:'Not found'},404);
  const a=(await sb('/rest/v1/applications?id=eq.'+id))[0];
  if(!a||(!isAdmin&&a.user_id!==u.id))return json({error:'Not found'},404);
  const payment=(await sb('/rest/v1/move_in_receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];
  const mailing=(await sb('/rest/v1/move_in_mailing_receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];
  if(a.status!=='Approved'||!payment||!mailing)return json({error:'Final mailing receipt approval is required.'},403);
  return json({kind,code:a.code,name:a.data.name,property:a.data.propertyTitle,address:a.data.approval?.address||'',amount:Number((kind==='rent'?payment.first_month_rent:payment.security_deposit)??payment.amount),combined:payment.first_month_rent==null||payment.security_deposit==null,payee:payment.payee,reference:payment.id,approvedAt:mailing.decided_at});
 }
 if(req.method==='GET'&&path.startsWith('deposit-settings/')){
  if(!isAdmin)return json({error:'Admin access required'},403);
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const a=(await sb('/rest/v1/applications?id=eq.'+id))[0];if(!a||a.status!=='Approved')return json({error:'Approved application required'},403);
  const property=(await sb('/rest/v1/properties?id=eq.'+encodeURIComponent(a.property_id)))[0];
  if(!Object.prototype.hasOwnProperty.call(a,'deposit_payment_settings')||!Object.prototype.hasOwnProperty.call(a,'letter_downloaded_at')||!Object.prototype.hasOwnProperty.call(a,'payment_released_at'))throw new UploadError('The deposit approval database update is missing. Run the included Supabase migrations in the INSTALL.txt order, then retry.');
  return json({settings:a.deposit_payment_settings||property?.payment||{},saved:!!a.deposit_payment_settings,version:a.updated_at,letterDownloadedAt:a.letter_downloaded_at,paymentReleasedAt:a.payment_released_at});
 }
 if(req.method==='GET'&&path==='properties'){if(!isAdmin)return json({error:'Admin access required'},403);return json(await sb('/rest/v1/properties?order=created_at.asc'))}
 if(req.method==='GET'&&path.startsWith('payment/')){
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const a=(await sb('/rest/v1/applications?id=eq.'+id))[0];if(!a||(!isAdmin&&a.user_id!==u.id)||a.status!=='Approved')return json({error:'Approved application required'},403);
  if(!a.payment_released_at)return json({error:'Admin approval after letter download is required before payment.'},403);
  const p=(await sb('/rest/v1/properties?id=eq.'+encodeURIComponent(a.property_id)))[0];const settings=path.split('/')[2]==='move-in'?(p?.payment||{}):(a.deposit_payment_settings||p?.payment||{});return json({...settings,mailingAddress:paymentMailingAddress(settings),mailingCopy:mailingCopy(p?.payment?.mailingInstructions?.[path.split('/')[2]==='move-in'?'moveIn':'deposit'])});
 }
 if(req.method==='GET'&&path.startsWith('access-card-photo/')){
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const a=(await sb('/rest/v1/applications?id=eq.'+id))[0],card=(await sb('/rest/v1/access_cards?application_id=eq.'+id))[0];
  if(!a||!card||(!isAdmin&&a.user_id!==u.id))return json({error:'Not found'},404);
  const signed=await sb('/storage/v1/object/sign/receipts/'+card.photo_path,{method:'POST',body:JSON.stringify({expiresIn:300})});return json({url:config().url+'/storage/v1'+signed.signedURL});
 }
 if(req.method==='GET'&&path.startsWith('rent-special-receipt/')){
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const r=(await sb('/rest/v1/rent_special_receipts?id=eq.'+id))[0];if(!r||(!isAdmin&&r.user_id!==u.id))return json({error:'Not found'},404);
  const signed=await sb('/storage/v1/object/sign/receipts/'+r.path,{method:'POST',body:JSON.stringify({expiresIn:60})});return json({url:config().url+'/storage/v1'+signed.signedURL});
 }
 if(req.method==='GET'&&path.startsWith('rent-special-mailing-receipt/')){
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const r=(await sb('/rest/v1/rent_special_mailing_receipts?id=eq.'+id))[0];if(!r||(!isAdmin&&r.user_id!==u.id))return json({error:'Not found'},404);
  const signed=await sb('/storage/v1/object/sign/receipts/'+r.path,{method:'POST',body:JSON.stringify({expiresIn:60})});return json({url:config().url+'/storage/v1'+signed.signedURL});
 }
 if(req.method==='GET'&&path.startsWith('utility-hoa-receipt/')){
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const r=(await sb('/rest/v1/utility_hoa_receipts?id=eq.'+id))[0];if(!r||(!isAdmin&&r.user_id!==u.id))return json({error:'Not found'},404);
  const signed=await sb('/storage/v1/object/sign/receipts/'+r.path,{method:'POST',body:JSON.stringify({expiresIn:60})});return json({url:config().url+'/storage/v1'+signed.signedURL});
 }
 if(req.method==='GET'&&path.startsWith('utility-hoa-mailing-receipt/')){
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const r=(await sb('/rest/v1/utility_hoa_mailing_receipts?id=eq.'+id))[0];if(!r||(!isAdmin&&r.user_id!==u.id))return json({error:'Not found'},404);
  const signed=await sb('/storage/v1/object/sign/receipts/'+r.path,{method:'POST',body:JSON.stringify({expiresIn:60})});return json({url:config().url+'/storage/v1'+signed.signedURL});
 }
 if(req.method==='GET'&&(path.startsWith('move-in-mailing-receipt/')||path.startsWith('move-in-receipt/')||path.startsWith('receipt/')||path.startsWith('mailing-receipt/')||path.startsWith('signed-lease/'))){
  const id=path.split('/')[1];if(!uuid.test(id))return json({error:'Not found'},404);
  const table=path.startsWith('move-in-mailing-receipt/')?'move_in_mailing_receipts':path.startsWith('move-in-receipt/')?'move_in_receipts':path.startsWith('signed-lease/')?'signed_leases':path.startsWith('mailing-receipt/')?'mailing_receipts':'receipts';const r=(await sb('/rest/v1/'+table+'?id=eq.'+id))[0];if(!r||(!isAdmin&&r.user_id!==u.id))return json({error:'Not found'},404);
  const signed=await sb('/storage/v1/object/sign/receipts/'+r.path,{method:'POST',body:JSON.stringify({expiresIn:60})});return json({url:config().url+'/storage/v1'+signed.signedURL});
 }
 if(req.method!=='POST')return json({error:'Not found'},404);
 if(path==='rent-special-receipt'){
  const form=await readUploadForm(req,u.id,path),id=String(form.get('applicationId'));if(!uuid.test(id))return json({error:'Invalid application'},400);
  const a=(await sb('/rest/v1/applications?id=eq.'+id+'&user_id=eq.'+u.id))[0];if(!a||a.status!=='Approved')return json({error:'Approved application required'},403);
  const utility=(await sb('/rest/v1/rent_special?application_id=eq.'+id))[0];const previous=(await sb('/rest/v1/utility_hoa_mailing_receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];if(!previous||!utility?.released_at||!(utility.settings?.hoa>0))return json({error:'Rent Special payment is not available yet.'},403);
  if((await sb('/rest/v1/rent_special_receipts?application_id=eq.'+id)).length)return json({error:'Receipt already submitted.'},409);
  const f=form.get('file');if(!f||typeof f==='string'||f.size>MAX_UPLOAD_BYTES||f.size<8)return json({error:'Choose a JPG, PNG, or PDF up to 20 MB.'},400);
  const bytes=new Uint8Array(await f.arrayBuffer()),png=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10',jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,pdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  const type=png?'image/png':jpg?'image/jpeg':pdf?'application/pdf':'';if(type!==f.type||!type)return json({error:'Unsupported or invalid file'},400);
  const rid=crypto.randomUUID(),filePath=u.id+'/'+rid+(png?'.png':jpg?'.jpg':'.pdf'),{url,key}=config();
  const upload=await fetch(url+'/storage/v1/object/receipts/'+filePath,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':type},body:bytes});if(!upload.ok)throw Error('Receipt upload failed.');
  try{await sb('/rest/v1/rpc/submit_rent_special_receipt',{method:'POST',body:JSON.stringify({actor:u.id,app_id:id,receipt_id:rid,object_path:filePath,file_name:f.name.slice(0,200)})})}catch(e){await sb('/storage/v1/object/receipts',{method:'DELETE',body:JSON.stringify({prefixes:[filePath]})}).catch(()=>{});throw e}
  queueEmails();return json({ok:true,message:'Money Order or Cashier’s Check submitted for review'});
 }
 if(path==='rent-special-mailing-receipt'){
  const form=await readUploadForm(req,u.id,path),id=String(form.get('applicationId'));if(!uuid.test(id))return json({error:'Invalid application'},400);
  const a=(await sb('/rest/v1/applications?id=eq.'+id+'&user_id=eq.'+u.id))[0];if(!a||a.status!=='Approved')return json({error:'Approved application required'},403);
  const payment=(await sb('/rest/v1/rent_special_receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];if(!payment)return json({error:'Rent Special payment approval is required.'},403);
  const existing=(await sb('/rest/v1/rent_special_mailing_receipts?application_id=eq.'+id))[0];if(existing&&existing.status!=='Declined')return json({error:'Money-order validation receipt already submitted.'},409);
  const f=form.get('file');if(!f||typeof f==='string'||f.size>MAX_UPLOAD_BYTES||f.size<8)return json({error:'Choose a JPG, PNG, or PDF up to 20 MB.'},400);
  const bytes=new Uint8Array(await f.arrayBuffer()),png=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10',jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,pdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  const type=png?'image/png':jpg?'image/jpeg':pdf?'application/pdf':'';if(type!==f.type||!type)return json({error:'Unsupported or invalid file'},400);
  const rid=crypto.randomUUID(),filePath=u.id+'/'+rid+(png?'.png':jpg?'.jpg':'.pdf'),{url,key}=config();
  const upload=await fetch(url+'/storage/v1/object/receipts/'+filePath,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':type},body:bytes});if(!upload.ok)throw Error('Receipt upload failed.');
  try{await sb('/rest/v1/rpc/submit_rent_special_mailing_receipt',{method:'POST',body:JSON.stringify({actor:u.id,app_id:id,receipt_id:rid,object_path:filePath,file_name:f.name.slice(0,200),tracking_value:String(form.get('tracking')||'').slice(0,200)})})}catch(e){await sb('/storage/v1/object/receipts',{method:'DELETE',body:JSON.stringify({prefixes:[filePath]})}).catch(()=>{});throw e}
  queueEmails();return json({ok:true,message:'Mailing receipt submitted for review'});
 }
 if(path==='utility-hoa-receipt'){
  const form=await readUploadForm(req,u.id,path),id=String(form.get('applicationId'));if(!uuid.test(id))return json({error:'Invalid application'},400);
  const a=(await sb('/rest/v1/applications?id=eq.'+id+'&user_id=eq.'+u.id))[0];if(!a||a.status!=='Approved')return json({error:'Approved application required'},403);
  const utility=(await sb('/rest/v1/utility_hoa?application_id=eq.'+id))[0];const card=(await sb('/rest/v1/access_cards?application_id=eq.'+id))[0];if(!card?.print_approved_at||!utilityReady(card.move_in_charges,utility?.settings))return json({error:'HOA & Utility payment is not available yet.'},403);
  if((await sb('/rest/v1/utility_hoa_receipts?application_id=eq.'+id)).length)return json({error:'Receipt already submitted.'},409);
  const f=form.get('file');if(!f||typeof f==='string'||f.size>MAX_UPLOAD_BYTES||f.size<8)return json({error:'Choose a JPG, PNG, or PDF up to 20 MB.'},400);
  const bytes=new Uint8Array(await f.arrayBuffer()),png=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10',jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,pdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  const type=png?'image/png':jpg?'image/jpeg':pdf?'application/pdf':'';if(type!==f.type||!type)return json({error:'Unsupported or invalid file'},400);
  const rid=crypto.randomUUID(),filePath=u.id+'/'+rid+(png?'.png':jpg?'.jpg':'.pdf'),{url,key}=config();
  const upload=await fetch(url+'/storage/v1/object/receipts/'+filePath,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':type},body:bytes});if(!upload.ok)throw Error('Receipt upload failed.');
  try{await sb('/rest/v1/rpc/submit_utility_hoa_receipt',{method:'POST',body:JSON.stringify({actor:u.id,app_id:id,receipt_id:rid,object_path:filePath,file_name:f.name.slice(0,200)})})}catch(e){await sb('/storage/v1/object/receipts',{method:'DELETE',body:JSON.stringify({prefixes:[filePath]})}).catch(()=>{});throw e}
  queueEmails();return json({ok:true,message:'Money Order or Cashier’s Check submitted for review'});
 }
 if(path==='utility-hoa-mailing-receipt'){
  const form=await readUploadForm(req,u.id,path),id=String(form.get('applicationId'));if(!uuid.test(id))return json({error:'Invalid application'},400);
  const a=(await sb('/rest/v1/applications?id=eq.'+id+'&user_id=eq.'+u.id))[0];if(!a||a.status!=='Approved')return json({error:'Approved application required'},403);
  const payment=(await sb('/rest/v1/utility_hoa_receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];if(!payment)return json({error:'HOA & Utility payment approval is required.'},403);
  const existing=(await sb('/rest/v1/utility_hoa_mailing_receipts?application_id=eq.'+id))[0];if(existing&&existing.status!=='Declined')return json({error:'Money-order validation receipt already submitted.'},409);
  const f=form.get('file');if(!f||typeof f==='string'||f.size>MAX_UPLOAD_BYTES||f.size<8)return json({error:'Choose a JPG, PNG, or PDF up to 20 MB.'},400);
  const bytes=new Uint8Array(await f.arrayBuffer()),png=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10',jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,pdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  const type=png?'image/png':jpg?'image/jpeg':pdf?'application/pdf':'';if(type!==f.type||!type)return json({error:'Unsupported or invalid file'},400);
  const rid=crypto.randomUUID(),filePath=u.id+'/'+rid+(png?'.png':jpg?'.jpg':'.pdf'),{url,key}=config();
  const upload=await fetch(url+'/storage/v1/object/receipts/'+filePath,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':type},body:bytes});if(!upload.ok)throw Error('Receipt upload failed.');
  try{await sb('/rest/v1/rpc/submit_utility_hoa_mailing_receipt',{method:'POST',body:JSON.stringify({actor:u.id,app_id:id,receipt_id:rid,object_path:filePath,file_name:f.name.slice(0,200),tracking_value:String(form.get('tracking')||'').slice(0,200)})})}catch(e){await sb('/storage/v1/object/receipts',{method:'DELETE',body:JSON.stringify({prefixes:[filePath]})}).catch(()=>{});throw e}
  queueEmails();return json({ok:true,message:'Mailing receipt submitted for review'});
 }
 if(path==='access-card'||path==='move-in-mailing-receipt'||path==='move-in-receipt'||path==='receipt'||path==='mailing-receipt'||path==='signed-lease'){
  const accessCard=path==='access-card';
  const moveInMailing=path==='move-in-mailing-receipt';
  const moveIn=path==='move-in-receipt';
  const mailing=path==='mailing-receipt';
  const lease=path==='signed-lease';
  const form=await readUploadForm(req,u.id,path),id=String(form.get('applicationId'));if(!uuid.test(id))return json({error:'Invalid application'},400);
  const a=(await sb('/rest/v1/applications?id=eq.'+id+'&user_id=eq.'+u.id))[0];if(!a||a.status!=='Approved')return json({error:'Approved application required'},403);
  if(path==='receipt'&&!a.payment_released_at)return json({error:'Admin approval after letter download is required before payment.'},403);
  if(accessCard){const approved=(await sb('/rest/v1/move_in_mailing_receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];if(!approved)return json({error:'Move-in mailing receipt approval is required.'},403);if((await sb('/rest/v1/access_cards?application_id=eq.'+id)).length)return json({error:'Access card photo already uploaded.'},409);}
  if(moveInMailing){const approved=(await sb('/rest/v1/move_in_receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];if(!approved)return json({error:'Move-in payment approval is required before mailing receipt submission.'},403);const existing=(await sb('/rest/v1/move_in_mailing_receipts?application_id=eq.'+id))[0];if(existing&&existing.status!=='Declined')return json({error:'Move-in mailing receipt already submitted.'},409);}
  if(moveIn){const approved=(await sb('/rest/v1/signed_leases?application_id=eq.'+id+'&status=eq.Approved'))[0];if(!approved||!(Number(approved.payment_due)>0))return json({error:'Move-in payment has not been released yet.'},403);if((await sb('/rest/v1/move_in_receipts?application_id=eq.'+id)).length)return json({error:'Move-in receipt already submitted.'},409);}
  if(mailing){const approved=(await sb('/rest/v1/receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];if(!approved)return json({error:'Payment approval is required before mailing receipt submission.'},403);}
  if(lease){const approved=(await sb('/rest/v1/mailing_receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];if(!approved)return json({error:'Mailing receipt approval is required before lease submission.'},403);}
  const f=form.get('file');if(!f||typeof f==='string'||f.size>MAX_UPLOAD_BYTES||f.size<8)return json({error:'Choose a JPG, PNG, or PDF up to 20 MB.'},400);
  const bytes=new Uint8Array(await f.arrayBuffer());const png=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10',jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,pdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  const type=png?'image/png':jpg?'image/jpeg':pdf?'application/pdf':'';if(accessCard&&pdf)return json({error:'Choose a JPG or PNG photo.'},400);if(type!==f.type||!type)return json({error:'Unsupported or invalid file'},400);
  const propertyPayment=(await sb('/rest/v1/properties?id=eq.'+a.property_id))[0]?.payment;const p=(path==='receipt'||mailing)?(a.deposit_payment_settings||propertyPayment):propertyPayment;if(!lease&&!accessCard&&(!p?.landlordName||!p?.mailingAddress||(!moveIn&&!(Number(p.amount)>0))))return json({error:'Payment instructions are not available yet.'},409);
  const rid=crypto.randomUUID(),filePath=u.id+'/'+rid+(png?'.png':jpg?'.jpg':'.pdf'),{url,key}=config();
  const upload=await fetch(url+'/storage/v1/object/receipts/'+filePath,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':type},body:bytes});if(!upload.ok)throw Error('Receipt upload failed.');
  const rpc=accessCard?'create_access_card':moveInMailing?'submit_move_in_mailing_receipt':moveIn?'submit_move_in_receipt':lease?'submit_signed_lease':mailing?'submit_mailing_receipt':'submit_receipt';
  const payload=accessCard?{actor:u.id,app_id:id,object_path:filePath,file_name:f.name.slice(0,200)}:lease?{actor:u.id,app_id:id,lease_id:rid,object_path:filePath,file_name:f.name.slice(0,200)}:{actor:u.id,app_id:id,receipt_id:rid,object_path:filePath,file_name:f.name.slice(0,200),tracking_value:String(form.get('tracking')||'').slice(0,200),...(mailing||moveIn||moveInMailing?{}:{amount_value:Number(p.amount),payee_value:p.landlordName})};
  try{await sb('/rest/v1/rpc/'+rpc,{method:'POST',body:JSON.stringify(payload)})}catch(e){await sb('/storage/v1/object/receipts',{method:'DELETE',body:JSON.stringify({prefixes:[filePath]})}).catch(()=>{});throw e}
  queueEmails();return json({ok:true,message:accessCard?'Access card photo uploaded':lease?'Your lease agreement has been successfully uploaded!':mailing?'Mailing receipt submitted for review':'Money Order or Cashier’s Check submitted for review'});
 }
 if(Number(req.headers.get('content-length')||0)>100000)return json({error:'Request too large'},413);
 const b:any=await req.json();
 if(path==='countersign-lease'){if(!isAdmin)return json({error:'Admin access required'},403);const result=await countersignLease(u.id,b);queueEmails();return json(result)}
 else if(path==='profile'){const data=profileSchema.parse(b);await sb('/rest/v1/profiles?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:u.id,data})});}
 else if(path==='property'){if(!isAdmin)return json({error:'Admin access required'},403);const data=propertySchema.parse(b.property),payment=paymentSchema.parse(b.payment);await sb('/rest/v1/properties?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({id:data.id,data,payment})});}
 else if(path==='deposit-settings'){
  if(!isAdmin)return json({error:'Admin access required'},403);
  if(!uuid.test(b.id)||typeof b.version!=='string'||!Number.isFinite(Date.parse(b.version)))return json({error:'Invalid application'},400);
  const settings=paymentSchema.parse(b.settings);
  if(!settings.landlordName||!settings.mailingAddress||!settings.purpose||!settings.city||!settings.state||!/^\d{5}(-\d{4})?$/.test(settings.zipCode||'')||!(Number(settings.amount)>0)||Number(settings.amount)>10000000)return json({error:'Complete the payee, street address, city, state, ZIP code, purpose and deposit amount.'},400);
  await depositReviewRpc('save_deposit_settings',{actor:u.id,app_id:b.id,expected_version:b.version,settings});
 }
 else if(path==='letter-download'){
  if(!uuid.test(b.id)||!b.approval||typeof b.approval!=='object'||Array.isArray(b.approval))return json({error:'Refresh your dashboard before downloading the letter.'},400);
  await sb('/rest/v1/rpc/record_approval_letter_download',{method:'POST',body:JSON.stringify({actor:u.id,app_id:b.id,expected_approval:b.approval})});
 }
 else if(path==='release-payment'){
  if(!isAdmin)return json({error:'Admin access required'},403);
  if(!uuid.test(b.id)||typeof b.version!=='string'||!Number.isFinite(Date.parse(b.version)))return json({error:'Invalid application'},400);
  await depositReviewRpc('release_application_payment',{actor:u.id,app_id:b.id,expected_version:b.version});
 }
 else if(path==='decision'){
  if(!isAdmin)return json({error:'Admin access required'},403);if(!uuid.test(b.id)||!['Approved','Declined','Pending'].includes(b.status)||typeof b.version!=='string')return json({error:'Invalid decision'},400);
  const a=(await sb('/rest/v1/applications?id=eq.'+b.id))[0];if(!a||a.status==='Draft')return json({error:'Submitted application required'},409);
  const p=(await sb('/rest/v1/properties?id=eq.'+a.property_id))[0]?.data;
  const approval=b.status==='Approved'?{approvedAt:new Date().toISOString(),address:p.address+', '+p.city,photo:p.photos[0],deposit:p.deposit,start:a.data.moveIn,end:leaseEnd(a.data.moveIn,a.data.lease)}:null;
  await sb('/rest/v1/rpc/decide_application',{method:'POST',body:JSON.stringify({actor:u.id,app_id:b.id,expected_version:b.version,new_status:b.status,new_note:String(b.note||'').slice(0,1000),approval_data:approval})});
 }
 else if(path==='decide-move-in-mailing'){if(!isAdmin)return json({error:'Admin access required'},403);if(!uuid.test(b.id)||!['Approved','Declined'].includes(b.status))return json({error:'Invalid decision'},400);await sb('/rest/v1/rpc/decide_move_in_mailing_receipt',{method:'POST',body:JSON.stringify({actor:u.id,receipt_id:b.id,new_status:b.status,new_note:String(b.note||'').slice(0,1000)})});}
 else if(path==='approve-move-in-payment'){if(!isAdmin)return json({error:'Admin access required'},403);if(!uuid.test(b.id))return json({error:'Invalid receipt'},400);await sb('/rest/v1/rpc/approve_move_in_receipt',{method:'POST',body:JSON.stringify({actor:u.id,receipt_id:b.id})});}
 else if(path==='approve-payment'){if(!isAdmin)return json({error:'Admin access required'},403);if(!uuid.test(b.id))return json({error:'Invalid receipt'},400);await sb('/rest/v1/rpc/approve_receipt',{method:'POST',body:JSON.stringify({actor:u.id,receipt_id:b.id})});}
 else if(path==='decide-mailing'){if(!isAdmin)return json({error:'Admin access required'},403);if(!uuid.test(b.id)||!['Approved','Declined'].includes(b.status))return json({error:'Invalid decision'},400);await sb('/rest/v1/rpc/decide_mailing_receipt',{method:'POST',body:JSON.stringify({actor:u.id,receipt_id:b.id,new_status:b.status,new_note:String(b.note||'').slice(0,1000)})});}
 else if(path==='approve-lease'){if(!isAdmin)return json({error:'Admin access required'},403);const rent=Number(b.firstMonthRent),deposit=Number(b.securityDeposit);if(!uuid.test(b.id)||![rent,deposit].every(n=>Number.isFinite(n)&&n>0&&Math.abs(n*100-Math.round(n*100))<0.00001)||rent+deposit>10000000)return json({error:'Enter valid first month rent and security deposit amounts'},400);await sb('/rest/v1/rpc/approve_lease_with_breakdown',{method:'POST',body:JSON.stringify({actor:u.id,lease_id:b.id,rent_amount:rent,deposit_amount:deposit})});}
 else if(path==='retry-emails'){if(!isAdmin)return json({error:'Admin access required'},403);}
 else return json({error:'Not found'},404);
 queueEmails();return json({ok:true});
 }catch(e){if(e instanceof UploadError)return json({error:e.message},400);const m=e instanceof Error?e.message:'';return json({error:m==='ADMIN_SESSION_BUSY'?'This administrator account is already signed in on another device. Log out there or wait for the session to expire, then try again.':m==='ADMIN_SESSION_REQUIRED'?'Your administrator session has expired or is not active. Please sign in at the admin login page.':m==='SETUP_REQUIRED'?'Backend setup is required before this action is available.':m==='UNAUTHORIZED'?'Please sign in with a verified account.':m.startsWith('[')?'Please check the submitted fields.':'Unable to complete this action. Refresh and try again; contact the site owner if it continues.'},m==='ADMIN_SESSION_BUSY'?409:m==='ADMIN_SESSION_REQUIRED'?401:m==='SETUP_REQUIRED'?503:m==='UNAUTHORIZED'?401:400)}
}
export const GET=handle;export const POST=handle;
