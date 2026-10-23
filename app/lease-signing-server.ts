import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {config,sb} from './server-store';
import {storedAttachment} from './notification-attachments';
import {completeLease} from './completed-lease';
import {UploadError} from './document-uploads';
const input=z.object({id:z.string().uuid(),landlordName:z.string().trim().min(2).max(150),signature:z.string().max(90000).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/),consent:z.literal(true)});
export async function countersignLease(actor:string,body:unknown){
 const b=input.parse(body),lease=(await sb('/rest/v1/signed_leases?id=eq.'+b.id))[0];
 if(!lease)throw new UploadError('Tenant-signed lease not found.');
 if(lease.completed_path)return {ok:true};
 const application=(await sb('/rest/v1/applications?id=eq.'+lease.application_id))[0];
 if(application?.status!=='Approved')throw new UploadError('An approved application is required.');
 const signature=Buffer.from(b.signature.split(',')[1],'base64');
 if(signature.length<100||signature.length>65000||!signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||signature.readUInt32BE(16)!==900||signature.readUInt32BE(20)!==240)throw new UploadError('Please draw your signature again.');
 const original=await storedAttachment({path:lease.path,filename:lease.filename},config());
 const source=Buffer.from(original.content,'base64'),hash=createHash('sha256').update(source).digest('hex'),signedAt=new Date().toISOString();
 let bytes:Uint8Array;
 try{bytes=await completeLease(source,{landlordName:b.landlordName,signature,code:application.code,tenant:application.data.name||'',property:application.data.approval?.address||application.data.propertyTitle||'',signedAt,sourceHash:hash},await readFile(path.join(process.cwd(),'public/fonts/letter-regular.ttf')))}catch{throw new UploadError('Unable to read this lease. A readable, unencrypted PDF, JPG or PNG is required. The original upload has been preserved.');}
 if(bytes.length>20*1024*1024)throw new UploadError('The completed lease exceeds 20 MB. Please contact support to reduce the original document size.');
 const objectPath=lease.user_id+'/completed-lease-'+crypto.randomUUID()+'.pdf',filename='Xenit-Realty-Lease-'+application.code+'.pdf';
 const {url,key}=config();const uploaded=await fetch(url+'/storage/v1/object/receipts/'+objectPath,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/pdf'},body:Buffer.from(bytes),signal:AbortSignal.timeout(45000)});
 if(!uploaded.ok)throw new UploadError('The completed lease could not be saved. Please try again.');
 // A unique object per request prevents concurrent signatures from overwriting one another.
 // On an uncertain database response keep this private object: the transaction may have committed.
 await sb('/rest/v1/rpc/countersign_lease',{method:'POST',body:JSON.stringify({actor,lease_id:b.id,expected_source:lease.path,object_path:objectPath,file_name:filename,landlord_name_value:b.landlordName,signed_at_value:signedAt,source_hash:hash})});
 return {ok:true};
}
