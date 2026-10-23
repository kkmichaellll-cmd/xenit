import {admin,sb,user} from '../../../server-store';
import {fetchCardPropertyImage} from '../../../server-card-image';

export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await user(req),{id}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return new Response('Not found',{status:404});
  const application=(await sb('/rest/v1/applications?id=eq.'+id))[0];
  if(!application||application.status!=='Approved'||application.user_id!==actor.id&&!await admin(actor.id))return new Response('Not found',{status:404});
  const source=application.data?.approval?.photo;
  if(typeof source!=='string'||!source.startsWith('https://'))return new Response('Property photo unavailable',{status:404});
  const image=await fetchCardPropertyImage(source);
  return new Response(new Uint8Array(image.bytes),{headers:{'Content-Type':image.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return new Response('Unable to load property photo',{status:error instanceof Error&&error.message==='UNAUTHORIZED'?401:502});}
}
