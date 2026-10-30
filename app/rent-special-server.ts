import {z} from 'zod';
import {sb} from './server-store';
export async function specialRequest(req:Request,path:string,actor:string,isAdmin:boolean){
 const id=path.split('/')[1];if(!z.string().uuid().safeParse(id).success)throw Error('Invalid application');
 const a=(await sb('/rest/v1/applications?id=eq.'+id))[0];if(!a||(!isAdmin&&a.user_id!==actor)||a.status!=='Approved')throw Error('Not authorized');
 if(req.method==='GET'){
  const stored=(await sb('/rest/v1/rent_special?application_id=eq.'+id))[0]||{};
  const previous=(await sb('/rest/v1/utility_hoa_mailing_receipts?application_id=eq.'+id+'&status=eq.Approved'))[0];
  const row={...stored,released_at:previous&&stored.settings?.hoa>0?stored.released_at:null};
  const receipt=row.released_at?(await sb('/rest/v1/rent_special_receipts?application_id=eq.'+id))[0]:null;
  const validation=receipt?.status==='Approved'?(await sb('/rest/v1/rent_special_mailing_receipts?application_id=eq.'+id))[0]:null;
  return {...row,settings:isAdmin||row.released_at?row.settings:null,receipt:receipt?{id:receipt.id,filename:receipt.filename,status:receipt.status,created_at:receipt.created_at,approved_at:receipt.approved_at}:null,validation:validation?{id:validation.id,filename:validation.filename,tracking:validation.tracking,status:validation.status,decision_note:validation.decision_note,created_at:validation.created_at,decided_at:validation.decided_at}:null,name:a.data.name,currentAddress:a.data.address||'',code:a.code,property:a.data.propertyTitle};
 }
 const b=await req.json();if(!['approve','decide-validation'].includes(b.action)||!isAdmin)throw Error('Not authorized');
 if(b.action==='approve'){
  if(!z.string().uuid().safeParse(b.receiptId).success)throw Error('Invalid receipt');
  if(!(await sb('/rest/v1/rent_special_receipts?id=eq.'+b.receiptId+'&application_id=eq.'+id))[0])throw Error('Receipt not found');
  await sb('/rest/v1/rpc/approve_rent_special_receipt',{method:'POST',body:JSON.stringify({actor,receipt_id:b.receiptId})});return {ok:true};
 }
 if(b.action==='decide-validation'){
  if(!z.string().uuid().safeParse(b.receiptId).success||!['Approved','Declined'].includes(b.status))throw Error('Invalid decision');
  if(!(await sb('/rest/v1/rent_special_mailing_receipts?id=eq.'+b.receiptId+'&application_id=eq.'+id))[0])throw Error('Receipt not found');
  await sb('/rest/v1/rpc/decide_rent_special_mailing_receipt',{method:'POST',body:JSON.stringify({actor,receipt_id:b.receiptId,new_status:b.status,new_note:String(b.note||'').slice(0,1000)})});return {ok:true};
 }
 throw Error('Invalid action.');
}
