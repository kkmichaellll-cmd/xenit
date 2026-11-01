import {attachmentTicket,verifyAttachment,readStoredAttachment} from './admin-email-storage';
import {emailAttachmentsSchema,attachmentType,readEmailBody,type EmailAttachment} from './admin-email-attachments';
// Server-only connection to the existing official mailbox. Credentials never reach the browser.
import {ImapFlow} from 'imapflow';
import {simpleParser} from 'mailparser';
import MailComposer from 'nodemailer/lib/mail-composer';
import {z} from 'zod';

const folderSchema=z.enum(['inbox','sent','drafts','trash']);
type Folder=z.infer<typeof folderSchema>;
const refSchema=z.object({folder:folderSchema,uid:z.number().int().positive(),validity:z.string().regex(/^\d+$/)}).strict();
export type MailRef=z.infer<typeof refSchema>;
const maxMessage=32*1024*1024;
export class MailboxError extends Error {constructor(message:string,public status=400){super(message)}}
export function mailboxConfigured(){return !!(process.env.MAILBOX_IMAP_HOST&&process.env.MAILBOX_IMAP_USER&&process.env.MAILBOX_IMAP_PASSWORD)}
async function connected<T>(fn:(client:ImapFlow)=>Promise<T>):Promise<T>{
 if(!mailboxConfigured())throw new MailboxError('Connect the official mailbox first: add MAILBOX_IMAP_HOST, MAILBOX_IMAP_USER and MAILBOX_IMAP_PASSWORD in Vercel, then redeploy.',503);
 const client=new ImapFlow({host:process.env.MAILBOX_IMAP_HOST!,port:993,secure:true,auth:{user:process.env.MAILBOX_IMAP_USER!,pass:process.env.MAILBOX_IMAP_PASSWORD!},logger:false,disableAutoIdle:true,connectionTimeout:15000,greetingTimeout:10000,socketTimeout:20000,maxLiteralSize:maxMessage,maxResponseSize:40*1024*1024});
 client.on('error',()=>{});
 try{await client.connect();return await fn(client)}catch(e){if(e instanceof MailboxError||e instanceof z.ZodError)throw e;console.error('Official mailbox operation failed');throw new MailboxError('Could not connect to or update the mailbox. Check the IMAP settings and mailbox password in Vercel, then refresh and retry.',503)}finally{if(client.usable)await client.logout().catch(()=>client.close());else client.close()}
}
async function folderPath(client:ImapFlow,folder:Folder,create=false){
 if(folder==='inbox')return 'INBOX';
 const override=process.env['MAILBOX_'+folder.toUpperCase()+'_FOLDER'];
 const boxes=await client.list();
 if(override){if(boxes.some(b=>b.path===override))return override;throw new MailboxError('The configured '+folder+' folder was not found. Check MAILBOX_'+folder.toUpperCase()+'_FOLDER.',503)}
 const special={sent:'\\Sent',drafts:'\\Drafts',trash:'\\Trash'}[folder];
 const found=boxes.find(b=>b.specialUse===special)||boxes.find(b=>b.name.toLowerCase()===folder);
 if(found)return found.path;
 if(!create)return null;
 const inbox=boxes.find(b=>b.path==='INBOX');
 const prefix=inbox?.delimiter&&boxes.some(b=>b.path.startsWith('INBOX'+inbox.delimiter))?'INBOX'+inbox.delimiter:'';
 const path=prefix+{sent:'Sent',drafts:'Drafts',trash:'Trash'}[folder];
 await client.mailboxCreate(path);return path;
}
function validity(client:ImapFlow){if(!client.mailbox)throw new MailboxError('Refresh this folder.',409);return String(client.mailbox.uidValidity)}
async function selected<T>(client:ImapFlow,ref:MailRef,fn:()=>Promise<T>){
 const path=await folderPath(client,ref.folder);if(!path)throw new MailboxError('This message no longer exists.',404);
 const lock=await client.getMailboxLock(path);
 try{if(validity(client)!==ref.validity)throw new MailboxError('This folder changed. Refresh it before continuing.',409);const msg=await client.fetchOne(String(ref.uid),{uid:true},{uid:true});if(!msg)throw new MailboxError('This message no longer exists. Refresh the folder.',404);return await fn()}finally{lock.release()}
}
function address(items:any[]|undefined){return (items||[]).map(a=>a.name?`${a.name} <${a.address||''}>`:a.address||'').join(', ')}
async function parsedMessage(client:ImapFlow,uid:number){
 const meta=await client.fetchOne(String(uid),{size:true},{uid:true});if(!meta)throw new MailboxError('Message not found.',404);
 if((meta.size||0)>maxMessage)throw new MailboxError('This message is larger than 32 MB. Open it in your existing webmail.',413);
 const data=await client.fetchOne(String(uid),{source:true},{uid:true});if(!data||!data.source)throw new MailboxError('Message could not be loaded.',404);
 return simpleParser(data.source,{skipHtmlToText:false,skipTextToHtml:true});
}
export async function mailboxRequest(req:Request,actor:string){
 if(req.method==='GET'){
 const url=new URL(req.url),folder=folderSchema.parse(url.searchParams.get('folder')||'inbox'),uid=url.searchParams.get('uid');
 if(!mailboxConfigured())return {configured:false,messages:[]};
 return connected(async client=>{
 if(uid){const ref=refSchema.parse({folder,uid:Number(uid),validity:url.searchParams.get('validity')});return selected(client,ref,async()=>{
 const mail=await parsedMessage(client,ref.uid);
 const supportedDraft=folder==='drafts'&&mail.attachments.length<=10&&mail.attachments.reduce((sum,a)=>sum+a.size,0)<=20*1024*1024&&mail.attachments.every(a=>a.size>0&&a.filename&&a.filename.length<=180&&!/[\x00-\x1f\x7f/\\]/.test(a.filename)&&attachmentType(a.filename)&&a.contentDisposition!=='inline'&&!a.cid);
 const draftFiles=supportedDraft?mail.attachments.map((a,index)=>({filename:a.filename!,size:a.size,ticket:attachmentTicket({uid:actor,filename:a.filename!,size:a.size,expires:Date.now()+24*60*60*1000,source:{...ref,folder:'drafts',index}})})):undefined;
 await client.messageFlagsAdd(String(ref.uid),['\\Seen'],{uid:true});
 return {ref,subject:mail.subject||'(No subject)',from:mail.from?.text||'',to:Array.isArray(mail.to)?mail.to.map(v=>v.text).join(', '):mail.to?.text||'',recipient:(Array.isArray(mail.to)?mail.to[0]:mail.to)?.value[0]?.address||'',replyTo:mail.replyTo?.value[0]?.address||mail.from?.value[0]?.address||'',text:(mail.text||(folder==='drafts'?'':'No plain-text preview available. Open this message in webmail.')).slice(0,200000),date:mail.date?.toISOString()||'',attachments:mail.attachments.map(a=>({name:a.filename||'Attachment',size:a.size})),draftAttachments:draftFiles,editable:supportedDraft&&!mail.cc&&!mail.bcc&&(Array.isArray(mail.to)?mail.to.flatMap(v=>v.value):mail.to?.value||[]).length<=1};
 })}
 const page=z.coerce.number().int().min(0).max(10000).parse(url.searchParams.get('page')||0),path=await folderPath(client,folder);
 if(!path)return {configured:true,messages:[],hasMore:false};
 const lock=await client.getMailboxLock(path);try{
 const count=client.mailbox?client.mailbox.exists:0,end=count-page*30,start=Math.max(1,end-29),messages=[];
 if(end>0)for await(const m of client.fetch(`${start}:${end}`,{uid:true,envelope:true,flags:true,internalDate:true}))messages.push({ref:{folder,uid:m.uid,validity:validity(client)},subject:m.envelope?.subject||'(No subject)',from:address(m.envelope?.from),to:address(m.envelope?.to),date:(m.envelope?.date instanceof Date?m.envelope.date.toISOString():m.envelope?.date)||(m.internalDate instanceof Date?m.internalDate.toISOString():''),unread:!m.flags?.has('\\Seen')});
 return {configured:true,messages:messages.reverse(),hasMore:start>1,total:count};
 }finally{lock.release()}
 });
 }
 if(req.method!=='POST')throw new MailboxError('Method not allowed.',405);
 const b=await readEmailBody(req);
 if(b.action==='draft'){
 const data=z.object({action:z.literal('draft'),recipient:z.string().trim().max(254),subject:z.string().max(160),message:z.string().max(10000),attachments:emailAttachmentsSchema,ref:refSchema.optional()}).strict().parse(b);
 if(data.recipient&&!z.string().email().safeParse(data.recipient).success)throw new MailboxError('Enter a valid recipient email address, or leave it blank for now.');
 if(data.ref&&data.ref.folder!=='drafts')throw new MailboxError('Only drafts can be edited.');
 const attachments=await resolveEmailAttachments(data.attachments,actor);
 return connected(async client=>{
 const path=(await folderPath(client,'drafts',true))!;
 const raw=await new MailComposer({from:'Xenit Realty <info@xenitrealty.com>',to:data.recipient||undefined,subject:data.subject,text:data.message,attachments:mimeAttachments(attachments),disableFileAccess:true,disableUrlAccess:true}).compile().build();
 const save=async()=>{
 const saved=await client.append(path,raw,['\\Draft','\\Seen']);
 if(!saved||!saved.uid||!saved.uidValidity)throw new MailboxError('The server did not confirm the draft identifier. Refresh Drafts to check whether it was saved.',503);
 let warning='';if(data.ref){try{if(!client.capabilities.has('UIDPLUS'))throw Error();await client.messageDelete(String(data.ref.uid),{uid:true})}catch{warning='The new draft was saved. The older copy could not be removed; you can delete it from Drafts.'}}
 return {ok:true,ref:{folder:'drafts',uid:saved.uid,validity:String(saved.uidValidity)},attachments:attachments.map((a,index)=>({filename:a.filename,size:Buffer.byteLength(a.content,'base64'),ticket:attachmentTicket({uid:actor,filename:a.filename,size:Buffer.byteLength(a.content,'base64'),expires:Date.now()+24*60*60*1000,source:{folder:'drafts',uid:saved.uid!,validity:String(saved.uidValidity),index}})})),warning};
 };
 return data.ref?selected(client,data.ref,save):save();
 });
 }
 const data=z.object({action:z.enum(['trash','restore','delete']),ref:refSchema}).strict().parse(b);
 if(data.action==='delete'&&data.ref.folder!=='trash')throw new MailboxError('Move the message to Trash first.');
 if(data.action==='restore'&&data.ref.folder!=='trash')throw new MailboxError('Only messages in Trash can be restored.');
 return connected(async client=>{
 const destination=data.action==='delete'?null:await folderPath(client,data.action==='restore'?'inbox':'trash',true);
 return selected(client,data.ref,async()=>{
 // Require targeted expunge; never expunge unrelated messages marked Deleted by another mail client.
 if(!client.capabilities.has('UIDPLUS'))throw new MailboxError('This server does not support safe targeted deletion. Please manage deletions in webmail.',409);
 const result=data.action==='delete'?await client.messageDelete(String(data.ref.uid),{uid:true}):await client.messageMove(String(data.ref.uid),destination!,{uid:true});
 if(!result)throw new MailboxError('The mailbox did not confirm this change. Refresh before retrying.',503);
 return {ok:true};
 });
 });
}
export async function archiveSentEmail(data:{recipient:string;subject:string;message:string;attachments?:EmailAttachment[]},html:string,providerId:string){
 await connected(async client=>{
 const path=(await folderPath(client,'sent',true))!,lock=await client.getMailboxLock(path);
 try{
 const messageId=`<${providerId.replace(/[^a-zA-Z0-9-]/g,'')}@xenitrealty.com>`;
 const exists=await client.search({header:{'Message-ID':messageId}},{uid:true});if(exists&&exists.length)return;
 const raw=await new MailComposer({from:'Xenit Realty <info@xenitrealty.com>',replyTo:'info@xenitrealty.com',to:data.recipient,subject:data.subject,text:data.message,html,messageId,attachments:mimeAttachments(data.attachments||[]),disableFileAccess:true,disableUrlAccess:true}).compile().build();
 if(!await client.append(path,raw,['\\Seen']))throw new MailboxError('Sent copy could not be saved.',503);
 }finally{lock.release()}
 });
}

function mimeAttachments(files:EmailAttachment[]){return files.map(file=>({filename:file.filename,content:Buffer.from(file.content,'base64'),contentType:attachmentType(file.filename)}))}

export async function resolveEmailAttachments(files:{ticket:string}[],actor:string):Promise<EmailAttachment[]>{
 const grants=files.map(f=>verifyAttachment(f.ticket,actor));if(grants.reduce((sum,g)=>sum+g.size,0)>20*1024*1024)throw new MailboxError('Attachments must total 20 MB or less.');
 const result:EmailAttachment[]=[];
 for(const g of grants){
 let bytes:Buffer;
 if(g.path)bytes=await readStoredAttachment(g);
 else if(g.source){const source=g.source;bytes=await connected(client=>selected(client,source,async()=>{const mail=await parsedMessage(client,source.uid),a=mail.attachments[source.index];if(!a||a.filename!==g.filename||a.size!==g.size)throw new MailboxError('Draft attachment changed. Reopen the draft.');return a.content}));}
 else throw new MailboxError('Invalid attachment.');
 result.push({filename:g.filename,content:bytes.toString('base64')});
 }
 return result;
}
