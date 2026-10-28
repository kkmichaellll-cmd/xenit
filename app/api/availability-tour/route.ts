import {after,NextResponse} from 'next/server';
import {sb,deliverEmails} from '../../server-store';
import {tourRequestSchema} from '../../availability-tour-schema';
export const maxDuration=300;
export async function POST(req:Request){
 const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Please submit from the property page.'},403);
 try{
 const raw=await req.text();if(raw.length>4000)return json({error:'Request too large.'},413);
 const value=tourRequestSchema.safeParse(JSON.parse(raw));if(!value.success)return json({error:value.error.issues[0].message},400);
 const v=value.data;
 const result=await sb('/rest/v1/rpc/request_availability_tour',{method:'POST',body:JSON.stringify({request_id:v.id,page_id:v.propertyId,visitor_name:v.name,visitor_email:v.email,starts_at_value:v.startsAt,zone_value:v.timeZone,local_date:v.date,local_time:v.time})});
 if(result==='unavailable')return json({error:'This property page is no longer available.'},404);
 if(result==='limited')return json({error:'Too many requests. Please try again in an hour.'},429);
 if(result!=='ok')return json({error:'Please refresh the page and try again.'},409);
 after(()=>deliverEmails().catch(()=>{}));return json({ok:true});
 }catch(error){return json({error:error instanceof SyntaxError?'Invalid request.':'Could not save your viewing request. Please try again.'},error instanceof SyntaxError?400:503)}
}
