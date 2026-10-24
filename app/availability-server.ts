import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {sb,config} from './server-store';
import {availabilitySaveSchema} from './availability-schema';
import {defaultAvailability} from './availability-data';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const schemaId=z.string().uuid();
export async function availabilityAdmin(req:Request,path:string,isAdmin:boolean,actor:string){
 if(!isAdmin)return json({error:'Admin access required'},403);
 try{
  if(req.method==='GET'&&path==='availability')return json(await sb('/rest/v1/property_availability?order=updated_at.desc'));
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const raw=await req.text();if(new TextEncoder().encode(raw).length>100000)return json({error:'Request too large'},413);
  const body=JSON.parse(raw);
  if(path==='availability/create'){
   const rows=await sb('/rest/v1/property_availability',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:randomUUID(),data:defaultAvailability,published:false})});return json(rows[0]);
  }
  if(path==='availability/duplicate'){
   const {id}=z.object({id:schemaId}).parse(body);
   const source=(await sb('/rest/v1/property_availability?id=eq.'+id))[0];if(!source)return json({error:'Page not found'},404);
   const rows=await sb('/rest/v1/property_availability',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:randomUUID(),data:{...source.data,title:source.data.title.slice(0,113)+' (copy)'},published:false})});return json(rows[0]);
  }
  if(path==='availability/save'){
   const value=availabilitySaveSchema.parse(body);
   const rows=await sb('/rest/v1/property_availability?id=eq.'+value.id+'&updated_at=eq.'+encodeURIComponent(value.version),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data:value.data,published:value.published,updated_at:new Date().toISOString()})});
   if(!rows.length)return json({error:'This page changed in another window. Reload the saved page before editing again.'},409);return json(rows[0]);
  }
  if(path==='availability/image-upload'){
   const {type,size}=z.object({type:z.enum(['image/jpeg','image/png','image/webp']),size:z.number().int().positive().max(20*1024*1024)}).parse(body);
   const {url,key}=config(),client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const name=actor+'/'+randomUUID()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type]);
   const {data,error}=await client.storage.from('availability-images').createSignedUploadUrl(name);if(error)throw error;
   return json({path:name,token:data.token,url:client.storage.from('availability-images').getPublicUrl(name).data.publicUrl});
  }
  return json({error:'Not found'},404);
 }catch(error){
  if(error instanceof z.ZodError)return json({error:error.issues.map(item=>(item.path.join('.')||'Field')+': '+item.message).join(' ')},400);
  if(error instanceof SyntaxError)return json({error:'Invalid request'},400);
  return json({error:'Could not load or save availability pages. Check your connection and run supabase/migrations/20261028_property_availability.sql if it has not been installed.'},503);
 }
}
