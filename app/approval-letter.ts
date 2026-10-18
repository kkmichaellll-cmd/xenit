import {jsPDF} from 'jspdf';
import type {Application} from './application-data';
import {leaseLabel} from './approval-details';
export async function createApprovalLetter(a:Application){
 if(a.status!=='Approved')throw new Error('Only approved applications have an approval letter.');
 const doc=new jsPDF({unit:'pt',format:'letter'});const W=612,H=792,M=52;
 for(const [file,style] of [['letter-regular.ttf','normal'],['letter-bold.ttf','bold']]){const response=await fetch('/fonts/'+file);if(!response.ok)throw Error('Letter font could not load');const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);doc.addFileToVFS(file,btoa(binary));doc.addFont(file,'Letter',style)}
 const ink='#102c56',green='#245edb',gray='#64748b';
 // Standard PDF fonts: normalize punctuation unsupported by the built-in font.
 const clean=(s:string)=>s.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/[^\x20-\x7E\n\u00A0-\u00FF]/g,'?');
 function paragraph(text:string,y:number,size=10,color=ink,width=508,x=M){doc.setFont('Letter','normal');doc.setFontSize(size);doc.setTextColor(color);const lines=doc.splitTextToSize(clean(text),width);doc.text(lines,x,y,{lineHeightFactor:1.45});return y+lines.length*size*1.45;}
 function header(title:string,page:number){doc.setFillColor(ink);doc.rect(0,0,W,106,'F');doc.setTextColor('#ffffff');doc.setFont('Letter','bold');doc.setFontSize(24);doc.text('Xenit Realty',M,48);doc.setDrawColor('#ffffff');doc.setLineWidth(6);doc.line(520,27,544,59);doc.setDrawColor('#77B6FF');doc.line(544,27,533,42);doc.line(526,51,520,59);doc.setFontSize(9);doc.text(title.toUpperCase(),M,76);doc.setFillColor('#edf4ff');doc.rect(0,106,W,27,'F');doc.setTextColor(green);doc.setFontSize(8);doc.text('APPLICATION APPROVAL - NOT AN EXECUTED LEASE',M,123);doc.setFillColor(ink);doc.rect(0,H-33,W,33,'F');doc.setTextColor('#ffffff');doc.setFont('Letter','normal');doc.setFontSize(8);doc.text('Xenit Realty  |  Tenant Portal',M,H-13);doc.text(`Page ${page} of 2`,W-M,H-13,{align:'right'});}
 header('Application approval letter',1);
 const date=(a.approval?.approvedAt||a.updatedAt).slice(0,10);
 paragraph('Date: '+date,166,9,gray);doc.setFontSize(9);doc.text(clean('Ref: '+(a.code||a.id)),W-M,184,{align:'right'});
 doc.setFont('Letter','bold');doc.setFontSize(21);doc.setTextColor(ink);doc.text('Application Approved',M,220);
 let y=paragraph('Dear '+a.name+',',254,11)+17;
 y=paragraph('Congratulations! Your application for '+a.propertyTitle+' has been approved by Xenit Realty. The proposed residence details are set out below. We look forward to helping you with the next steps.',y,11)+26;
 const rows=[['Property',a.propertyTitle],['Address',a.approval?.address||'To be confirmed'],['Lease dates',leaseLabel(a)],['Monthly rent',new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(a.rent)],['Applicant email',a.email]];
 const rowLines=rows.map(([label,value])=>({label,lines:doc.splitTextToSize(clean(value),326)}));
 const height=48+rowLines.reduce((n,r)=>n+Math.max(24,r.lines.length*13+10),0);
 doc.setFillColor('#f4f7fc');doc.setDrawColor('#d6e0ef');doc.roundedRect(M,y,508,height,10,10,'FD');
 doc.setTextColor(ink);doc.setFont('Letter','bold');doc.setFontSize(12);doc.text('Lease Summary',M+18,y+28);let rowY=y+52;
 for(const row of rowLines){doc.setFont('Letter','normal');doc.setFontSize(9);doc.setTextColor(gray);doc.text(row.label,M+18,rowY);doc.setTextColor(ink);doc.text(row.lines,M+160,rowY,{lineHeightFactor:1.4});rowY+=Math.max(24,row.lines.length*13+10)}
 y+=height+32;doc.setFont('Letter','bold');doc.setFontSize(11);doc.setTextColor(green);doc.text('YOUR NEXT STEPS',M,y);paragraph('Review these details in your dashboard. Use Make payment to view the current payment instructions. Confirm all final lease terms, payment amounts, and refund conditions with the property manager.',y+22,10);
 doc.addPage();header('Reservation & payment information',2);
 let p=paragraph('Application reference: '+(a.code||a.id),171,10,gray)+30;
 doc.setFont('Letter','bold');doc.setFontSize(17);doc.setTextColor(ink);doc.text('Before you move in',M,p);p+=30;
 for(const text of ['Review the proposed lease dates and monthly rent on page 1.','Confirm the final lease and any reservation or deposit terms with the property management team.','Any holding fee, payment deadline, and refund conditions must be confirmed in your agreement with the property manager.','Approval does not execute a lease or confirm a completed payment. Payment receipts remain subject to independent review.']){p=paragraph('- '+text,p,11)+20;}
 p+=12;doc.setFillColor('#edf4ff');doc.setDrawColor('#bdd1ef');doc.roundedRect(M,p,508,88,10,10,'FD');paragraph('Open your Tenant Portal to view your application status, download this letter, or view payment instructions. A receipt upload does not itself confirm payment; the management team will review it.',p+24,10,green,470,M+18);
 p+=125;paragraph('Sincerely,',p,11);doc.setFont('Letter','bold');doc.setFontSize(11);doc.setTextColor(ink);doc.text('Xenit Realty Property Management',M,p+24);
 return doc;
}
