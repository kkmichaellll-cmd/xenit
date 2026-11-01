import {z} from 'zod';
// Shared validation for manual admin emails only; tenant uploads are unchanged.
export const EMAIL_ATTACHMENT_BYTES=20*1024*1024;
export const EMAIL_ATTACHMENT_COUNT=10;
export const EMAIL_BODY_BYTES=100000;
export const attachmentTypes:Record<string,string>={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',csv:'text/csv',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',zip:'application/zip'};
export const attachmentAccept=Object.keys(attachmentTypes).map(ext=>'.'+ext).join(',');
export const attachmentType=(name:string)=>attachmentTypes[name.split('.').pop()?.toLowerCase()||''];
export const attachmentSize=(content:string)=>content.length/4*3-(content.endsWith('==')?2:content.endsWith('=')?1:0);
export type EmailAttachment={filename:string;content:string};
export const emailAttachmentsSchema=z.array(z.object({ticket:z.string().min(1).max(4000)}).strict()).max(EMAIL_ATTACHMENT_COUNT).optional().default([]);
// Read a bounded body even when a client omits or falsifies Content-Length.
export async function readEmailBody(req:Request){
 const invalid=()=>new z.ZodError([{code:z.ZodIssueCode.custom,path:['attachments'],message:'The email is too large. Attachments must total 20 MB or less.'}]);
 if(Number(req.headers.get('content-length')||0)>EMAIL_BODY_BYTES)throw invalid();
 const reader=req.body?.getReader();if(!reader)throw invalid();
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>EMAIL_BODY_BYTES){await reader.cancel();throw invalid()}chunks.push(value)}}finally{reader.releaseLock()}
 const buffer=new Uint8Array(length);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder().decode(buffer))}catch{throw new z.ZodError([{code:z.ZodIssueCode.custom,path:[],message:'Invalid email request.'}])}
}
