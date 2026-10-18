import type {Application} from './application-data';
export type Approval={approvedAt:string;address:string;photo:string;deposit:number;start:string;end:string};
export function leaseEnd(start:string,term:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||term==='Month to month')return '';
 const months=Number.parseInt(term,10);if(!Number.isFinite(months)||months<1)return '';
 const [y,m,d]=start.split('-').map(Number);const end=new Date(Date.UTC(y,m-1+months,1));
 const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
 end.setUTCDate(Math.min(d,last));end.setUTCDate(end.getUTCDate()-1);return end.toISOString().slice(0,10);
}
export function leaseLabel(a:Application){const start=a.approval?.start||a.moveIn;const end=a.approval?.end||leaseEnd(start,a.lease);return start?`${start} ${end?'to '+end:' · '+a.lease}`:'Move-in date to be confirmed'}
