'use client';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {validUpload} from './upload-limits';
let client:SupabaseClient|null=null;
export function auth(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw Error('Account services are not configured. The site owner must complete the backend setup before accepting registrations or submissions.');
 return client??=createClient(url,key);
}
export async function api(path:string,body?:unknown){
 if(body instanceof FormData){
  const purpose=path.slice(1),fields:[string,string][]=[],files:[string,File][]=[],uploads:{field:string;ticket:string}[]=[];
  for(const [field,value] of body){if(typeof value==='string')fields.push([field,value]);else if(value.size){if(!validUpload(purpose,field,value.type,value.size))throw Error('Choose a supported JPG, PNG or PDF up to 20 MB per file.');files.push([field,value]);}}
  const tickets:string[]=[];
  try{
   for(const [field,file] of files){
    const grant=await api('/uploads/sign',{purpose,field,type:file.type,size:file.size,name:file.name,applicationId:String(body.get(purpose==='application'?'id':'applicationId')||'')});
    tickets.push(grant.ticket);
    const {error}=await auth().storage.from('receipts').uploadToSignedUrl(grant.path,grant.token,file,{contentType:file.type});
    if(error)throw Error('File upload failed. Each file must be 20 MB or smaller. If it continues, ask the site owner to check the storage limit.');
    uploads.push({field,ticket:grant.ticket});
   }
   return await api(path,{fields,uploads});
  }finally{if(tickets.length)await api('/uploads/cancel',{tickets}).catch(()=>{});}
 }
 const {data:{session}}=await auth().auth.getSession();
 if(!session)throw Error('Please sign in to continue.');
 const response=await fetch('/api/workspace'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+session.access_token,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),cache:'no-store'});
 const data:any=await response.json().catch(()=>({error:'The server could not complete your request. Please try again.'}));if(!response.ok)throw Error(data.error||'Your request could not be completed. Please try again.');return data;
}

export async function logoutSession(){
 // Release only the calling session, never another device's lock.
 await api('/admin-session/logout',{});
 const {error}=await auth().auth.signOut({scope:'local'});if(error)throw error;
}
