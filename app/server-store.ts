// Server-only access. Never import into a client component.
import {z} from 'zod';
import {notificationEmail} from './notification-email';
import {sendNotificationParts,storedAttachment} from './notification-attachments';
export function config(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('SETUP_REQUIRED');return {url,key}}
export async function sb(path:string,init:RequestInit={}){const {url,key}=config();const r=await fetch(url+path,{...init,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...init.headers},cache:'no-store'});if(!r.ok)throw Error('Storage request failed ('+r.status+').');if(r.status===204)return null;const text=await r.text();return text?JSON.parse(text):null}
export async function user(request:Request){const {url,key}=config();const token=request.headers.get('authorization');if(!token?.startsWith('Bearer '))throw Error('UNAUTHORIZED');const r=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:token},cache:'no-store'});if(!r.ok)throw Error('UNAUTHORIZED');const u:any=await r.json();if(!u.id||!u.email_confirmed_at)throw Error('UNAUTHORIZED');return u as {id:string,email:string}}
export async function admin(id:string){const rows=await sb('/rest/v1/admins?user_id=eq.'+encodeURIComponent(id)+'&select=user_id');return rows.length>0}
export const str=(n=200)=>z.string().trim().max(n);
export const profileSchema=z.object({name:str(100).min(2),address:str(500).min(5),phone:str(30).min(7)});
export const propertySchema=z.object({id:z.string().regex(/^[a-z0-9-]{1,80}$/),title:str(100).min(1),address:str(200).min(1),city:str(100).min(1),rent:z.number().min(0).max(1e7),beds:z.number().int().min(0).max(100),baths:z.number().min(0).max(100),area:z.number().min(0).max(1e7),type:str(50),status:z.enum(['Available','Coming soon','Leased']),description:str(6000).min(1),amenities:z.array(str(100)).max(50),photos:z.array(str(1000).refine(v=>/^https:\/\/[^\s]+$/.test(v)||/^\/(?!\/)[\w/.-]+$/.test(v))).min(1).max(6),lease:str(50),deposit:z.number().min(0).max(1e7)});
const mailingCopySchema=z.object({title:str(100).min(1),intro:str(2000).min(1),instructions:str(4000).min(1),uploadTitle:str(100).min(1),buttonLabel:str(80).min(1)});
export const paymentSchema=z.object({paymentSteps:z.array(str(4000).min(1)).length(4).optional(),additionalInstructions:str(4000).optional(),mailingInstructions:z.object({deposit:mailingCopySchema.optional(),moveIn:mailingCopySchema.optional()}).optional(),landlordName:str(150),mailingAddress:str(500),city:str(100).optional(),state:str(100).optional(),zipCode:str(10).regex(/^$|^\d{5}(-\d{4})?$/).optional(),amount:z.string().regex(/^$|^\d{1,8}(\.\d{1,2})?$/),purpose:str(100),noPostalMoneyOrders:z.boolean()});
export const applicationSchema=z.object({id:z.string().uuid(),propertyId:z.string().regex(/^[a-z0-9-]{1,80}$/),name:str(100).min(2),phone:str(30).min(7),moveIn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),occupants:z.number().int().min(1).max(20),lease:z.enum(['Month to month','6 months','12 months','24 months']),employment:z.enum(['Employed','Self-employed','Retired','Student','Other']),income:z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),eviction:z.enum(['Yes','No']),pets:z.enum(['Yes','No']),notes:str(3000),consent:z.boolean(),status:z.enum(['Draft','Pending'])});
export async function deliverEmails(){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM||!process.env.NEXT_PUBLIC_SITE_URL)return;
 const deadline=Date.now()+210000;
 const jobs=await sb('/rest/v1/notifications?status=eq.pending&order=created_at.asc&limit=20');
 for(const job of jobs){if(Date.now()>deadline)break;try{
  const recipients=job.audience==='tenant'?[job.recipient]:String(process.env.ADMIN_EMAIL||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!recipients.length||recipients.some((email:string)=>!email||!email.includes('@')))throw Error('Missing recipient');
  await sendNotificationParts(job,notificationEmail(job,process.env.NEXT_PUBLIC_SITE_URL!),{
   shouldPause:()=>Date.now()>deadline,
   load:doc=>storedAttachment(doc,config()),
   send:async(body,key)=>{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:process.env.EMAIL_FROM,to:recipients,...body as object}),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Email provider returned '+r.status);return (await r.json()).id;},
   ack:async(completed,total,id)=>{await sb('/rest/v1/rpc/mark_notification_part_sent',{method:'POST',body:JSON.stringify({job_id:job.id,completed_parts:completed,total_parts:total,sent_provider_id:id})});}
  });
 }catch{await sb('/rest/v1/notifications?id=eq.'+job.id,{method:'PATCH',body:JSON.stringify({last_error:'Email or attachment delivery failed. Check the uploaded document and email configuration, then retry.'})}).catch(()=>{});}}
}

// Decode only after user() has verified this exact bearer token with Supabase.
export function adminSessionId(request:Request){
 try{const token=request.headers.get('authorization')!.slice(7);const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.session_id))throw Error();return payload.session_id as string}catch{throw Error('ADMIN_SESSION_REQUIRED')}
}
export async function adminSession(request:Request,id:string,action:'claim'|'check'|'release'){
 const result=await sb('/rest/v1/rpc/admin_session_'+action,{method:'POST',body:JSON.stringify({actor:id,session:adminSessionId(request)})});
 if(result!==true)throw Error(action==='claim'?'ADMIN_SESSION_BUSY':'ADMIN_SESSION_REQUIRED');
}
