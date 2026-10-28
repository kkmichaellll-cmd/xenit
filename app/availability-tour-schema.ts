import {z} from 'zod';
export const tourRequestSchema=z.object({
 id:z.string().uuid(),propertyId:z.string().uuid(),name:z.string().trim().min(2).max(100),email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),
 phone:z.string().trim().min(7).max(30).refine(v=>/^\+?[0-9() .-]+$/.test(v)&&v.replace(/\D/g,'').length>=7&&v.replace(/\D/g,'').length<=15,'Enter a valid phone number.'),
 date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^\d{2}:\d{2}$/),timeZone:z.string().max(100),startsAt:z.string().datetime()
}).strict().superRefine((v,ctx)=>{
 const at=new Date(v.startsAt),delta=at.getTime()-Date.now();
 if(delta<=0||delta>180*86400000)ctx.addIssue({code:'custom',message:'Choose a viewing time within the next 180 days.'});
 try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:v.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);const get=(t:string)=>parts.find(p=>p.type===t)?.value;
 if(`${get('year')}-${get('month')}-${get('day')}`!==v.date||`${get('hour')}:${get('minute')}`!==v.time)throw Error();
 }catch{ctx.addIssue({code:'custom',message:'The selected date, time or time zone is invalid. Please choose again.'})}
});
