import template from './lease-template.json';
export const leaseFields=['landlordName','landlordAddress','tenantName','propertyAddress','agreementDate','startDate','endDate','leaseTerm','bedrooms','bathrooms','monthlyRent','securityDeposit','rentDueDay','governingState'] as const;
export type LeaseDraft={values:Record<string,string>;sections:{title:string;body:string}[]};
export function resolveLeaseText(text:string,values:Record<string,string>){return text.replace(/\{\{(\w+)\}\}/g,(_,key)=>values[key]||'________________');}
export function initialLease(a:any,p:any):LeaseDraft{
 const date=(s:string)=>s?new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}):'';
 const cash=(n:any)=>n==null?'':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
 const approval=a.data.approval||{};
 return {values:{landlordName:p?.payment?.landlordName||'',landlordAddress:'',tenantName:a.data.name||'',propertyAddress:approval.address||a.data.propertyTitle||'',agreementDate:date(new Date().toISOString()),startDate:date(approval.start||a.data.moveIn),endDate:date(approval.end),leaseTerm:a.data.lease||'',bedrooms:String(p?.data?.beds??''),bathrooms:String(p?.data?.baths??''),monthlyRent:cash(a.data.rent),securityDeposit:cash(approval.deposit),rentDueDay:'',governingState:''},sections:template.map(s=>({...s}))};
}
