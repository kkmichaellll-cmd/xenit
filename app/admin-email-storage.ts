// Server-only, admin-authorized callers. Private direct-to-storage email uploads.
import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {config} from './server-store';
import {EMAIL_ATTACHMENT_BYTES,attachmentType} from './admin-email-attachments';
export type AttachmentGrant={uid:string;filename:string;size:number;expires:number;path?:string;source?:{folder:'drafts';uid:number;validity:string;index:number}};
function sign(value:string){return createHmac('sha256',config().key).update('admin-email:'+value).digest()}
export function attachmentTicket(g:AttachmentGrant){const value=Buffer.from(JSON.stringify(g)).toString('base64url');return value+'.'+sign(value).toString('base64url')}
export function verifyAttachment(ticket:string,uid:string){
 const [value,mac,...extra]=ticket.split('.');if(!value||!mac||extra.length)throw Error('Invalid attachment. Select the file again.');const a=Buffer.from(mac,'base64url'),b=sign(value);if(a.length!==b.length||!timingSafeEqual(a,b))throw Error('Invalid attachment. Select the file again.');
 const g=JSON.parse(Buffer.from(value,'base64url').toString()) as AttachmentGrant;
 if(g.uid!==uid||g.expires<Date.now()||g.size<1||g.size>EMAIL_ATTACHMENT_BYTES||!attachmentType(g.filename))throw Error('Attachment expired or invalid. Select the file again, or reopen the saved draft.');return g;
}
export async function prepareEmailUpload(req:Request,uid:string){
 const text=await req.text();if(text.length>2000)throw Error('Upload request too large.');const b=JSON.parse(text);
 if(typeof b.filename!=='string'||b.filename.length>180||/[\x00-\x1f\x7f/\\]/.test(b.filename)||!attachmentType(b.filename)||!Number.isInteger(b.size)||b.size<1||b.size>EMAIL_ATTACHMENT_BYTES)throw Error('Choose a supported file up to 20 MB.');
 const g:AttachmentGrant={uid,filename:b.filename,size:b.size,expires:Date.now()+24*60*60*1000,path:uid+'/'+randomUUID()};
 const {url,key}=config(),storage=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('email-attachments');
 // Best-effort cleanup of expired staging uploads from this admin only.
 try{const {data:old}=await storage.list(uid,{limit:100,sortBy:{column:'created_at',order:'asc'}});const expired=(old||[]).filter(o=>o.created_at&&Date.parse(o.created_at)<Date.now()-24*60*60*1000).map(o=>uid+'/'+o.name);if(expired.length)await storage.remove(expired)}catch{}
 const {data,error}=await storage.createSignedUploadUrl(g.path!);if(error||!data)throw Error('Could not prepare email attachment upload. Run the email attachments storage migration first.');
 return {path:g.path,token:data.token,ticket:attachmentTicket(g)};
}
export async function readStoredAttachment(g:AttachmentGrant){
 if(!g.path?.startsWith(g.uid+'/'))throw Error('Invalid attachment path.');const {url,key}=config();
 const r=await fetch(url+'/storage/v1/object/authenticated/email-attachments/'+g.path,{headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store'});if(!r.ok||!r.body)throw Error('Attachment upload not found. Select the file again.');
 const reader=r.body.getReader(),chunks:Uint8Array[]=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>g.size){await reader.cancel();throw Error('Attachment size changed. Upload it again.')}chunks.push(value)}}finally{reader.releaseLock()}
 if(size!==g.size)throw Error('Attachment upload is incomplete. Select the file again.');return Buffer.concat(chunks);
}
