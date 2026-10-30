import {z} from 'zod';
import {sb} from './server-store';
import {utilitySettingsSchema,utilityReady,fixedUtilityCopy} from './utility-hoa-settings';
export async function utilityRequest(req:Request,path:string,actor:string,isAdmin:boolean){
 const id=path.split('/')[1];if(!z.string().uuid().safeParse(id).success)throw Error('Invalid application');
 const a=(await sb('/rest/v1/applications?id=eq.'+id))[0];if(!a||(!isAdmin&&a.user_id!==actor)||a.status!=='Approved')throw Error('Not authorized');
 if(req.method==='GET'){
  const card=(await sb('/rest/v1/access_cards?application_id=eq.'+id))[0];
  const stored=(await sb('/rest/v1/utility_hoa?application_id=eq.'+id))[0]||{};
  const row={...stored,printed_at:card?.print_requested_at,released_at:card?.print_approved_at&&utilityReady(card.move_in_charges,stored.settings)?card.print_approved_at:null,settings:stored.settings?{...stored.settings,...card?.move_in_charges,mailingValidation:fixedUtilityCopy(stored.settings.mailingValidation)}:null};
  // Later-stage tables must not block an eligible tenant’s access card.
  const receipt=row.released_at?(await sb('/rest/v1/utility_hoa_receipts?application_id=eq.'+id))[0]:null;
  const validation=receipt?.status==='Approved'?(await sb('/rest/v1/utility_hoa_mailing_receipts?application_id=eq.'+id))[0]:null;
  return {...row,settings:isAdmin||row.released_at?row.settings:null,receipt:receipt?{id:receipt.id,filename:receipt.filename,status:receipt.status,created_at:receipt.created_at,approved_at:receipt.approved_at}:null,validation:validation?{id:validation.id,filename:validation.filename,tracking:validation.tracking,status:validation.status,decision_note:validation.decision_note,created_at:validation.created_at,decided_at:validation.decided_at}:null,name:a.data.name,currentAddress:a.data.address||'',code:a.code,property:a.data.propertyTitle};
 }
 const b=await req.json();if(!['save','approve','decide-validation'].includes(b.action)||!isAdmin)throw Error('Not authorized');
 if(b.action==='approve'){
  if(!z.string().uuid().safeParse(b.receiptId).success)throw Error('Invalid receipt');
  if(!(await sb('/rest/v1/utility_hoa_receipts?id=eq.'+b.receiptId+'&application_id=eq.'+id))[0])throw Error('Receipt not found');
  await sb('/rest/v1/rpc/approve_utility_hoa_receipt',{method:'POST',body:JSON.stringify({actor,receipt_id:b.receiptId})});return {ok:true};
 }
 if(b.action==='decide-validation'){
  if(!z.string().uuid().safeParse(b.receiptId).success||!['Approved','Declined'].includes(b.status))throw Error('Invalid decision');
  if(!(await sb('/rest/v1/utility_hoa_mailing_receipts?id=eq.'+b.receiptId+'&application_id=eq.'+id))[0])throw Error('Receipt not found');
  await sb('/rest/v1/rpc/decide_utility_hoa_mailing_receipt',{method:'POST',body:JSON.stringify({actor,receipt_id:b.receiptId,new_status:b.status,new_note:String(b.note||'').slice(0,1000)})});return {ok:true};
 }
 await sb('/rest/v1/rpc/utility_hoa_action',{method:'POST',body:JSON.stringify({actor,app_id:id,action:b.action,details:b.action==='save'?utilitySettingsSchema.parse(b.settings):null})});return {ok:true};
}
