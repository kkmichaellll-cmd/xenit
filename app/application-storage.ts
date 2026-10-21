import {readUploadForm} from './document-uploads';
import {MAX_UPLOAD_BYTES} from './upload-limits';
import {sb,config} from './server-store';
const keys=['idFront','idBack','incomeProof','addressProof'];
export async function saveApplication(req:Request,u:{id:string;email:string},own:any){
 if(!own)throw Error('Complete your profile first');
 const form=await readUploadForm(req,u.id,'application'),id=String(form.get('id')),status=String(form.get('status'));
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['Draft','Pending'].includes(status))throw Error('Invalid application');
 const existing=(await sb('/rest/v1/applications?id=eq.'+id))[0];
 if(existing&&existing.user_id!==u.id)throw Error('Not authorized');
 if(existing&&existing.status!=='Draft')return {id:existing.id,code:existing.code,status:existing.status};
 const {applicationSchema}=await import('./server-store');
 const raw:Record<string,unknown>={...Object.fromEntries(form),id,status,occupants:Number(form.get('occupants')||1),consent:form.get('consent')==='on'};
 const data=status==='Pending'?applicationSchema.parse(raw):applicationSchema.partial().extend({id:applicationSchema.shape.id,propertyId:applicationSchema.shape.propertyId,status:applicationSchema.shape.status}).parse(Object.fromEntries(Object.entries(raw).filter(([,v])=>v!=='')));
 if(status==='Pending'&&!data.consent)throw Error('Please certify your application');
 if(data.moveIn){const date=new Date(data.moveIn+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==data.moveIn||(status==='Pending'&&data.moveIn<new Date().toISOString().slice(0,10)))throw Error('Choose a valid move-in date')}
 const property=(await sb('/rest/v1/properties?id=eq.'+encodeURIComponent(data.propertyId)))[0]?.data;
 if(!property||property.status!=='Available')throw Error('Property unavailable');
 const saved=(await sb('/rest/v1/application_verifications?application_id=eq.'+id))[0];
 const last4=String(form.get('ssnLast4')||'')||saved?.ssn_last4||'';
 if(last4&&!/^\d{4}$/.test(last4))throw Error('Enter exactly four SSN digits');
 const idType=String(form.get('idType')||saved?.id_type||'State ID');
 if(!['State ID','Driver’s License','Passport','Other government ID'].includes(idType))throw Error('Invalid ID type');
 const docs:any={...(saved?.documents||{})},uploaded:string[]=[];
 try{
  for(const key of keys){const f=form.get(key);if(!(f instanceof File)||!f.size)continue;
   if(f.size>MAX_UPLOAD_BYTES)throw Error('Each document must be 20 MB or smaller');
   const bytes=new Uint8Array(await f.arrayBuffer());const png=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10',jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,pdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
   const type=png?'image/png':jpg?'image/jpeg':pdf?'application/pdf':'';
   if(!type||type!==f.type||(key.startsWith('id')&&pdf))throw Error('Choose a valid JPG, PNG or supported PDF');
   const path=u.id+'/application-'+id+'/'+crypto.randomUUID()+(png?'.png':jpg?'.jpg':'.pdf'),{url,key:secret}=config();
   const response=await fetch(url+'/storage/v1/object/receipts/'+path,{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':type},body:bytes});if(!response.ok)throw Error('Document upload failed');
   uploaded.push(path);docs[key]={path,filename:f.name.slice(0,200)};
  }
  const complete=!!last4&&keys.every(k=>docs[k]);
  if(status==='Pending'&&!complete)throw Error('Complete identity verification and upload all four documents');
  const details={...data,idType,verificationComplete:complete,email:u.email,propertyTitle:property.title,rent:property.rent,address:own.data.address,createdAt:existing?.data.createdAt||new Date().toISOString(),decisionNote:''};
  const result=await sb('/rest/v1/rpc/submit_verified_application',{method:'POST',body:JSON.stringify({actor:u.id,app_id:id,property_key:property.id,new_status:status,details,ssn_value:last4,id_type_value:idType,documents_value:docs})});
  return result;
 }catch(e){if(uploaded.length)await sb('/storage/v1/object/receipts',{method:'DELETE',body:JSON.stringify({prefixes:uploaded})}).catch(()=>{});throw e}
}
