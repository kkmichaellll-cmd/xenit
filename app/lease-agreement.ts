import {jsPDF} from 'jspdf';
import type {Application} from './application-data';
import {money} from './property-data';

export async function createLeaseAgreement(a:Application,landlordName:string){
 const doc=new jsPDF({unit:'mm',format:'letter'}),left=18,right=198,width=180;
 const addHeader=()=>{doc.setFillColor(12,35,78);doc.rect(0,0,216,34,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text('XENIT REALTY',left,16);doc.setFontSize(8);doc.text('RESIDENTIAL LEASE AGREEMENT',left,24);doc.setTextColor(31,49,76)};
 const section=(title:string,y:number)=>{doc.setFillColor(12,35,78);doc.rect(left,y,width,8,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(title,left+4,y+5.5);doc.setTextColor(31,49,76);return y+14};
 const para=(text:string,y:number)=>{doc.setFont('helvetica','normal');doc.setFontSize(9.5);const lines=doc.splitTextToSize(text,width);doc.text(lines,left,y);return y+lines.length*5+3};
 const ensure=(y:number,need=35)=>{if(y+need>263){doc.addPage();addHeader();return 44}return y};
 addHeader();doc.setFontSize(8);doc.text('Agreement reference: LA-'+(a.code||a.id).slice(0,18),left,42);doc.text('Generated: '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}),right,42,{align:'right'});
 let y=52;y=section('1. THE PARTIES',y);y=para(`This Residential Lease Agreement is between ${landlordName||'the property owner'} (Landlord) and ${a.name} (Tenant). Xenit Realty provides the property-management portal and document delivery service.`,y);
 y=ensure(y);y=section('2. PROPERTY AND TERM',y);y=para(`Property: ${a.approval?.address||a.propertyTitle}. The lease begins on ${a.approval?.start||a.moveIn} and ends on ${a.approval?.end||'the date agreed in writing'}. Occupancy is limited to ${a.occupants} approved occupant${a.occupants===1?'':'s'}.`,y);
 y=ensure(y);y=section('3. RENT AND DEPOSIT',y);y=para(`Monthly rent is ${money(Number(a.rent))}, due on the first day of each month using the payment method specified by the Landlord. The security deposit is ${money(Number(a.approval?.deposit||0))}. Late fees, returned-payment charges, and deposit handling are subject to the signed terms and applicable state and local law.`,y);
 y=ensure(y);y=section('4. USE, CARE, AND ACCESS',y);y=para('The Tenant will use the property only as a private residence, keep it reasonably clean and safe, promptly report damage or needed repairs, and comply with applicable laws and property rules. The Landlord may enter with legally required notice, except in an emergency.',y);
 y=ensure(y);y=section('5. UTILITIES, PETS, AND ALTERATIONS',y);y=para(`Unless a written addendum says otherwise, the Tenant is responsible for utilities serving the property. Pets disclosed in the application: ${a.pets}. No material alteration, sublease, or additional occupant is permitted without prior written approval.`,y);
 y=ensure(y);y=section('6. DEFAULT, NOTICES, AND GOVERNING LAW',y);y=para('Failure to pay rent or a material breach may result in remedies allowed by applicable law after any required notice. Notices must be delivered using the addresses or methods agreed by the parties. This agreement is governed by the law where the property is located.',y);
 y=ensure(y,52);y=section('7. ENTIRE AGREEMENT AND SIGNATURES',y);y=para('This document, together with signed addenda and required disclosures, contains the parties’ agreement. Changes must be in writing and signed. Each party should retain a completed copy. This generated document should be reviewed for compliance with the law where the property is located before signing.',y);
 y+=6;doc.line(left,y,left+72,y);doc.line(left+100,y,right,y);doc.setFontSize(8);doc.text('Tenant signature / date',left,y+5);doc.text('Landlord or authorized agent / date',left+100,y+5);
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setDrawColor(219,227,239);doc.line(left,270,right,270);doc.setFontSize(7);doc.setTextColor(104,119,143);doc.text(`Xenit Realty · ${a.code||a.id} · Page ${i} of ${pages}`,108,276,{align:'center'})}
 return doc;
}
