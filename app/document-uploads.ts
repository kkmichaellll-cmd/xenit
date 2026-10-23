import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {config,sb} from './server-store';
import {MAX_UPLOAD_BYTES,validUpload} from './upload-limits';

export class UploadError extends Error {}
type Grant={uid:string;purpose:string;applicationId:string;field:string;type:string;size:number;name:string;path:string;expires:number};
const fail=()=>{throw new UploadError('Upload could not be verified. Please choose the file and try again.');};
function signature(value:string){return createHmac('sha256',config().key).update(value).digest();}
function ticket(g:Grant){const value=Buffer.from(JSON.stringify(g)).toString('base64url');return value+'.'+signature(value).toString('base64url');}
function verify(value:unknown,uid:string):Grant{
 if(typeof value!=='string'||value.length>4000)return fail();
 const [payload,mac,...rest]=value.split('.');if(!payload||!mac||rest.length)return fail();
 const actual=Buffer.from(mac,'base64url'),expected=signature(payload);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return fail();
 const g:Grant=JSON.parse(Buffer.from(payload,'base64url').toString());
 if(g.uid!==uid||!g.path.startsWith(uid+'/pending-uploads/')||!validUpload(g.purpose,g.field,g.type,g.size))return fail();
 return g;
}
export async function uploadControl(req:Request,uid:string,action:string){
 const text=await req.text();if(text.length>20000)throw new UploadError('Upload request is too large.');
 const b=JSON.parse(text);
 if(action==='cancel'){
  if(!Array.isArray(b.tickets)||b.tickets.length>4)return fail();
  const paths=b.tickets.map((t:unknown)=>verify(t,uid).path);
  if(paths.length)await sb('/storage/v1/object/receipts',{method:'DELETE',body:JSON.stringify({prefixes:paths})});
  return {ok:true};
 }
 if(!validUpload(b.purpose,b.field,b.type,b.size))throw new UploadError('Choose a supported JPG, PNG or PDF up to 20 MB per file.');
 if(typeof b.applicationId!=='string'||! /^[0-9a-f-]{36}$/i.test(b.applicationId))return fail();
 const a=(await sb('/rest/v1/applications?id=eq.'+b.applicationId))[0];
 if(a&&a.user_id!==uid)return fail();
 if(b.purpose!=='application'&&(!a||a.status!=='Approved'))throw new UploadError('Approved application required');
 if(b.purpose==='receipt'&&!a?.payment_released_at)throw new UploadError('Admin approval after letter download is required before payment.');
 if(b.purpose==='application'&&a&&a.status!=='Draft')throw new UploadError('This application has already been submitted.');
 const ext=b.type==='image/png'?'.png':b.type==='image/jpeg'?'.jpg':'.pdf';
 const g:Grant={uid,purpose:b.purpose,applicationId:b.applicationId,field:b.field,type:b.type,size:b.size,name:String(b.name||'document').slice(0,200),path:uid+'/pending-uploads/'+randomUUID()+ext,expires:Date.now()+30*60*1000};
 const {url,key}=config(),storage=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('receipts');
 const {data,error}=await storage.createSignedUploadUrl(g.path);
 if(error||!data)throw new UploadError('Could not prepare upload. Check the private receipts storage bucket.');
 return {path:g.path,token:data.token,ticket:ticket(g)};
}
export async function readUploadForm(req:Request,uid:string,purpose:string){
 if(!req.headers.get('content-type')?.includes('application/json'))throw new UploadError('Please refresh this page to use the updated upload form.');
 const text=await req.text();if(text.length>100000)throw new UploadError('Submission is too large.');
 const b=JSON.parse(text),form=new FormData();
 if(!Array.isArray(b.fields)||b.fields.length>100||!Array.isArray(b.uploads)||b.uploads.length>(purpose==='application'?4:1))return fail();
 for(const entry of b.fields){if(!Array.isArray(entry)||entry.length!==2||entry.some(v=>typeof v!=='string'))return fail();form.append(entry[0],entry[1]);}
 const appId=form.get(purpose==='application'?'id':'applicationId'),seen=new Set<string>();
 for(const upload of b.uploads){
  const g=verify(upload.ticket,uid);
  if(g.expires<Date.now()||g.purpose!==purpose||g.applicationId!==appId||g.field!==upload.field||seen.has(g.field))return fail();
  seen.add(g.field);
  const {url,key}=config();
  const response=await fetch(url+'/storage/v1/object/authenticated/receipts/'+g.path,{headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store'});
  if(!response.ok||!response.body)throw new UploadError('Uploaded file was not found. Please upload it again.');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_UPLOAD_BYTES||size>g.size){await reader.cancel();throw new UploadError('Each file must be 20 MB or smaller.');}chunks.push(value);}}finally{reader.releaseLock();}
  if(size!==g.size)return fail();
  form.set(g.field,new File([Buffer.concat(chunks)],g.name,{type:g.type}));
 }
 return form;
}
