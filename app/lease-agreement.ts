import {jsPDF} from 'jspdf';
import {leaseLogo} from './lease-brand';
import {resolveLeaseText,type LeaseDraft} from './lease-draft';
export async function createLeaseFromDraft(draft:LeaseDraft,code:string){
 const doc=new jsPDF({unit:'pt',format:'letter'}),W=612,H=792,M=52,width=W-2*M,ink='#12376d';
 for(const [file,style] of [['letter-regular.ttf','normal'],['letter-bold.ttf','bold']]){const r=await fetch('/fonts/'+file);if(!r.ok)throw Error('Lease font could not load');let binary='';for(const byte of new Uint8Array(await r.arrayBuffer()))binary+=String.fromCharCode(byte);doc.addFileToVFS(file,btoa(binary));doc.addFont(file,'Lease',style);}
 doc.setProperties({title:'Xenit Realty Residential Lease Agreement',author:'Xenit Realty',subject:'LA-'+code});
 function header(signature=false){doc.setFillColor(ink);doc.rect(0,0,W,82,'F');doc.addImage(leaseLogo,'PNG',M,20,145,40);doc.setFont('Lease','bold');doc.setFontSize(9);doc.setTextColor('#ffffff');doc.text(signature?'SIGNATURE PAGE':'RESIDENTIAL LEASE AGREEMENT',W-M,43,{align:'right'});}
 header();let y=112;
 function newPage(){doc.addPage();header();y=112;}
 function para(text:string,size=10){doc.setFont('Lease','normal');doc.setFontSize(size);doc.setTextColor('#26374d');const lines:string[]=doc.splitTextToSize(text,width);for(const line of lines){if(y>721)newPage();doc.setFont('Lease','normal');doc.setFontSize(size);doc.setTextColor('#26374d');doc.text(line,M,y);y+=size*1.48;}y+=12;}
 para('Ref No: LA-'+code+'     Date: '+draft.values.agreementDate,8);
 for(const section of draft.sections){doc.setFont('Lease','normal');doc.setFontSize(10);const body=resolveLeaseText(section.body,draft.values);const needed=doc.splitTextToSize(body,width).length*14.8+62;if(y>665||(needed<600&&y+needed>721))newPage();doc.setFont('Lease','bold');doc.setFontSize(10);const titles:string[]=doc.splitTextToSize(section.title,width-18);const height=titles.length*14+12;doc.setFillColor('#edf3fb');doc.roundedRect(M,y-10,width,height,4,4,'F');doc.setTextColor(ink);doc.text(titles,M+9,y+3,{lineHeightFactor:1.4});y+=height+12;para(resolveLeaseText(section.body,draft.values));}
 doc.addPage();header(true);y=114;
 para('The parties have read, understood, and agreed to the terms and conditions of this Residential Lease Agreement and have duly executed it on '+draft.values.agreementDate+'.');
 function box(title:string,top:number){doc.setFillColor('#f0f5fb');doc.roundedRect(M,top,width,164,6,6,'F');doc.setFont('Lease','bold');doc.setFontSize(10);doc.setTextColor(ink);doc.text(title,M+12,top+20);}
 box('LANDLORD',182);box('TENANT',368);
 doc.setFont('Lease','normal');doc.setFontSize(8);doc.setDrawColor('#9eafc4');doc.setTextColor('#64748b');
 for(const top of [182,368]){doc.line(64,top+112,330,top+112);doc.line(426,top+112,548,top+112);doc.text(top===182?'Authorized Signature':'Tenant Signature',64,top+125);doc.text('Date',426,top+125);doc.line(64,top+147,330,top+147);doc.text('Printed Name',64,top+159);}
 doc.setFontSize(9);doc.setTextColor(ink);doc.text(draft.values.tenantName,64,403);
 y=562;para('By signing above, the Tenant acknowledges having read and understood all terms of this Agreement and agrees to be bound by them.',9);
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFillColor(ink);doc.rect(0,H-31,W,31,'F');doc.setFont('Lease','normal');doc.setFontSize(7);doc.setTextColor('#ffffff');doc.text('Ref: LA-'+code+' | Xenit Realty | info@xenitrealty.com | Page '+i+' of '+pages,W/2,H-12,{align:'center'});}
 return doc;
}
