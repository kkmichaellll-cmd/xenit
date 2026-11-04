import {z} from 'zod';
import {sb} from './server-store';
import {initialLease,leaseFields} from './lease-draft';
export class LeaseDraftError extends Error {}
const schema=z.object({values:z.record(z.string().max(500)),sections:z.array(z.object({title:z.string().trim().min(1).max(150),body:z.string().trim().min(1).max(12000)}).strict()).min(1).max(80)}).strict();
export async function leaseDraftRequest(req:Request,path:string,actor:string,isAdmin:boolean){
 const id=path.split('/')[1];if(!z.string().uuid().safeParse(id).success)throw new LeaseDraftError('Invalid application');
 const a=(await sb('/rest/v1/applications?id=eq.'+id))[0];if(!a||a.status!=='Approved'||(!isAdmin&&a.user_id!==actor))throw new LeaseDraftError('Not authorized');
 const row=(await sb('/rest/v1/lease_drafts?application_id=eq.'+id))[0];
 const mailing=(await sb('/rest/v1/mailing_receipts?application_id=eq.'+id))[0];
 if(req.method==='GET'){
  if(!isAdmin&&(!row?.released_at||mailing?.status!=='Approved'))throw new LeaseDraftError('The saved lease is not available yet.');
  const p=isAdmin&&!row?(await sb('/rest/v1/properties?id=eq.'+a.property_id))[0]:null;
  return {draft:row?.document||initialLease(a,p),version:row?.version??0,released:!!row?.released_at,code:a.code};
 }
 if(!isAdmin)throw new LeaseDraftError('Admin access required');
 if(req.method!=='POST')throw new LeaseDraftError('Method not allowed');
 if(Number(req.headers.get('content-length')||0)>100000)throw new LeaseDraftError('Lease request is too large.');
 const b=await req.json(),draft=schema.parse(b.draft);
 if(JSON.stringify(draft).length>70000)throw new LeaseDraftError('Lease content is too long.');
 if(b.approve===true&&leaseFields.some(k=>!draft.values[k]?.trim()))throw new LeaseDraftError('Complete all lease details before saving.');
 const tokens=draft.sections.flatMap(s=>[...s.body.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1]));
 if(b.approve===true&&tokens.some(k=>!draft.values[k]?.trim()))throw new LeaseDraftError('A lease placeholder has no value.');
 if(!Number.isInteger(b.version)||b.version<0)throw new LeaseDraftError('Reload the lease before saving.');
 await sb('/rest/v1/rpc/save_application_lease',{method:'POST',body:JSON.stringify({actor,app_id:id,expected_version:b.version,document_value:draft,approve: b.approve===true,new_note:String(b.note||'').slice(0,1000)})});
 return {ok:true};
}
