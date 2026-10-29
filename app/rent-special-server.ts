import {z} from 'zod';
import {sb} from './server-store';
const fee=z.number().finite().min(0).max(10000000).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001);
export async function specialRequest(req:Request,path:string,actor:string,isAdmin:boolean){
 const id=path.split('/')[1];if(!z.string().uuid().safeParse(id).success)throw Error('Invalid application');
 const a=(await sb('/rest/v1/applications?id=eq.'+id))[0];if(!a||(!isAdmin&&a.user_id!==actor)||a.status!=='Approved')throw Error('Not authorized');
 if(req.method==='GET'){
  const row=(await sb('/rest/v1/rent_special?application_id=eq.'+id))[0]||{};
  const receipt=(await sb('/rest/v1/rent_special_receipts?application_id=eq.'+id))[0];
  return {...row,settings:isAdmin||row.released_at?row.settings:null,receipt:receipt?{id:receipt.id,filename:receipt.filename,status:receipt.status,created_at:receipt.created_at,approved_at:receipt.approved_at}:null,name:a.data.name,currentAddress:a.data.address||'',code:a.code,property:a.data.propertyTitle};
 }
 const b=await req.json();if(!isAdmin)throw Error('Admin required');
 if(b.action==='save'){
  await sb('/rest/v1/rpc/save_rent_special',{method:'POST',body:JSON.stringify({actor,app_id:id,amount:fee.refine(n=>n>0).parse(b.amount)})});return {ok:true};
 }
 if(b.action==='release'){
  await sb('/rest/v1/rpc/release_rent_special',{method:'POST',body:JSON.stringify({actor,app_id:id})});return {ok:true};
 }
 if(b.action==='approve'&&z.string().uuid().safeParse(b.receiptId).success){
  const receipt=(await sb('/rest/v1/rent_special_receipts?id=eq.'+b.receiptId+'&application_id=eq.'+id))[0];if(!receipt)throw Error('Receipt not found');
  await sb('/rest/v1/rpc/approve_rent_special_receipt',{method:'POST',body:JSON.stringify({actor,receipt_id:b.receiptId})});return {ok:true};
 }
 throw Error('Invalid action');
}
