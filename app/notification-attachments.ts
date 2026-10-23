// Server only. Only snapshot-owned storage paths may become email attachments.
type Document={path:string;filename:string};
type Submission={ownerId:string;details:Record<string,unknown>;documents:Document[]};
export type EmailAttachment={filename:string;content:string};
export function submissionParts(job:any):{summary:EmailAttachment;documents:Document[];ownerId:string}|null{
 if(job.audience!=='admin'||!job.payload?.submission)return null;
 const s=job.payload.submission as Submission;
 if(!/^[0-9a-f-]{36}$/i.test(s.ownerId)||!Array.isArray(s.documents)||s.documents.length>4)throw Error('Invalid attachment snapshot');
 for(const d of s.documents){if(typeof d.path!=='string'||!d.path.startsWith(s.ownerId+'/')||d.path.split('/').some(x=>x==='.'||x==='..'||!x))throw Error('Invalid attachment ownership');}
 const text=['Xenit Realty — '+job.kind,'Reference: '+job.reference,'Submitted: '+job.created_at,'',...Object.entries(s.details||{}).map(([k,v])=>k+': '+(typeof v==='object'?JSON.stringify(v):String(v??'')))].join('\n');
 return {ownerId:s.ownerId,documents:s.documents,summary:{filename:'Xenit-submission-'+String(job.reference).replace(/[^\w-]/g,'')+'.txt',content:Buffer.from(text).toString('base64')}};
}
export async function storedAttachment(document:Document,storage:{url:string;key:string},fetcher:typeof fetch=fetch):Promise<EmailAttachment>{
 const path=document.path.split('/').map(encodeURIComponent).join('/');
 const response=await fetcher(storage.url+'/storage/v1/object/authenticated/receipts/'+path,{headers:{apikey:storage.key,Authorization:'Bearer '+storage.key},cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok||!response.body)throw Error('Submission attachment unavailable');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20*1024*1024){await reader.cancel();throw Error('Attachment exceeds upload limit');}chunks.push(value);}}finally{reader.releaseLock();}
 if(!size)throw Error('Empty attachment');
 const bytes=Buffer.concat(chunks),pdf=bytes.subarray(0,5).toString()==='%PDF-',png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!pdf&&!png&&!jpg)throw Error('Unsupported attachment');
 const base=String(document.filename||'submission').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,140)||'submission';
 return {filename:base+(pdf?'.pdf':png?'.png':'.jpg'),content:bytes.toString('base64')};
}

export async function sendNotificationParts(job:any,template:{subject:string;html:string;text:string},dependencies:{shouldPause?:()=>boolean;load:(doc:Document)=>Promise<EmailAttachment>;send:(body:unknown,key:string)=>Promise<string>;ack:(completed:number,total:number,id:string)=>Promise<void>}){
 const parts=submissionParts(job),total=Math.max(1,parts?.documents.length||0);
 if(job.status==='sent')return;
 if(parts&&job.kind==='Application submitted'){
  if(dependencies.shouldPause?.())return;
  // One immutable application bundle, including retries of older partially delivered jobs.
  const attachments:EmailAttachment[]=[parts.summary];
  const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const entries=Object.entries(job.payload.submission.details||{}).map(([key,value])=>[key.replace(/([a-z])([A-Z])/g,'$1 $2'),typeof value==='object'?JSON.stringify(value):String(value??'')]);
  const detailText=entries.map(([key,value])=>key+': '+value).join('\n');
  const detailHtml='<h2>Rental application details</h2><table role="presentation" style="width:100%;border-collapse:collapse">'+entries.map(([key,value])=>'<tr><th scope="row" style="text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #e2e8f0">'+escape(key)+'</th><td style="padding:8px;border-bottom:1px solid #e2e8f0;white-space:pre-wrap;overflow-wrap:anywhere">'+escape(value)+'</td></tr>').join('')+'</table>';
  // Leave headroom below Resend's 40 MB encoded-message limit for MIME headers and wrapping.
  let encodedBytes=Buffer.byteLength(template.html+template.text+detailText+detailHtml)+parts.summary.content.length;
  let oversized=false;
  for(const doc of parts.documents){
   if(dependencies.shouldPause?.())return;
   const attachment=await dependencies.load(doc);encodedBytes+=attachment.content.length+Buffer.byteLength(attachment.filename)+2048;
   if(encodedBytes>36_000_000){oversized=true;attachments.splice(1);break;}
   attachments.push(attachment);
  }
  const note=oversized?'The uploaded documents exceed the single-email size limit. The complete application details are included here and attached as a summary. Use Review Submission to sign in to the secure admin workspace and download all documents. No documents have been split into separate emails.':'The complete application details and all uploaded documents are attached together in this email.';
  const fileList=parts.documents.map(d=>d.filename).join('\n');
  const section='<section style="padding:24px;font-family:Arial,sans-serif;color:#102c56">'+detailHtml+'<h3>Submitted documents</h3><ul>'+parts.documents.map(d=>'<li>'+escape(d.filename)+'</li>').join('')+'</ul><p>'+escape(note)+'</p></section>';
  const body={...template,text:template.text+'\n\nRental application details\n'+detailText+'\n\nSubmitted documents\n'+fileList+'\n\n'+note,html:template.html.replace('</body>',section+'</body>'),attachments};
  if(dependencies.shouldPause?.())return;
  const id=await dependencies.send(body,job.id+'-application-bundle-v1');
  // Monotonic acknowledgements also finish jobs that had old per-document parts sent.
  const completed=Math.max(1,job.parts_sent||0);
  await dependencies.ack(completed,completed,id);
  return;
 }
 for(let index=job.parts_sent||0;index<total;index++){
  if(dependencies.shouldPause?.())return;
  const attachments=parts?[parts.summary,...(parts.documents[index]?[await dependencies.load(parts.documents[index])]:[])]:undefined;
  const suffix=total>1?' — Part '+(index+1)+' of '+total:'';
  const note=attachments?'Submission details and uploaded documents are attached to this email'+(total>1?' (part '+(index+1)+' of '+total+')':'')+'.':'';
  const id=await dependencies.send({...template,subject:template.subject+suffix,text:template.text+(note?'\n\n'+note:''),html:template.html.replace('</body>',(note?'<p style="padding:16px;font-family:Arial,sans-serif">'+note+'</p>':'')+'</body>'),...(attachments?{attachments}:{})},parts?job.id+'-submission-'+index:job.id);
  await dependencies.ack(index+1,total,id);
 }
}
