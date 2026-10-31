import {jsPDF} from 'jspdf';
import type {Application} from './application-data';
import {leaseLabel} from './approval-details';

export async function createApprovalLetter(a:Application){
  if(a.status!=='Approved')throw new Error('Only approved applications have an approval letter.');
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=56,content=W-2*M;
  for(const [file,style] of [['letter-regular.ttf','normal'],['letter-bold.ttf','bold']]){
    const response=await fetch('/fonts/'+file);
    if(!response.ok)throw Error('Letter font could not load');
    const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
    for(const byte of bytes)binary+=String.fromCharCode(byte);
    doc.addFileToVFS(file,btoa(binary));doc.addFont(file,'Letter',style);
  }
  const ink='#0f172a',gray='#64748b',green='#008b3a';
  const brand='15 Capital Property';
  const property=a.approval?.address||a.propertyTitle;
  const date=(a.approval?.approvedAt||a.updatedAt).slice(0,10).split('-').reverse().join('/');
  function paragraph(text:string,y:number,size=10,color=ink,width=content,x=M,bold=false){
    doc.setFont('Letter',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);
    const lines=doc.splitTextToSize(text,width);
    doc.text(lines,x,y,{lineHeightFactor:1.45});
    return y+lines.length*size*1.45;
  }
  function footer(page:number){
    doc.setFillColor(ink);doc.rect(0,H-34,W,34,'F');
    doc.setFont('Letter','normal');doc.setFontSize(6.5);doc.setTextColor('#ffffff');
    doc.text(`This is an automatically generated official document from the ${brand} Portal. | Page ${page} of 2`,W/2,H-13,{align:'center'});
  }
  doc.setFillColor(ink);doc.rect(0,0,W,113,'F');
  paragraph(brand,73,23,'#ffffff',300,M,true);
  doc.setFontSize(7);doc.text('OFFICIAL APPROVAL LETTER',W-M,73,{align:'right'});
  footer(1);
  paragraph('Date: '+date,170,8,gray);
  doc.text('Ref: '+(a.code||a.id),W-M,170,{align:'right'});
  paragraph('Application Approved',225,18,ink,content,M,true);
  let y=paragraph('Dear '+a.name+' ,',281,11)+23;
  y=paragraph(`Congratulations! We are delighted to inform you that your application for the residence at ${property} has been officially approved. We were very impressed with your application and are excited to welcome you to the ${brand} community.`,y,10.5)+35;
  const rows=[['Property:',property],['Lease Term:',leaseLabel(a)],['Monthly Rent:',new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(a.rent)]];
  doc.setFontSize(10);
  const rowLines=rows.map(([label,value])=>({label,lines:doc.splitTextToSize(value,content-190)}));
  const height=62+rowLines.reduce((n,r)=>n+Math.max(28,r.lines.length*14+10),0);
  doc.setFillColor('#f8fafc');doc.setDrawColor('#cbd5e1');doc.roundedRect(M,y,content,height,12,12,'FD');
  paragraph('Lease Summary',y+35,12,ink,content-40,M+22,true);
  let rowY=y+70;
  for(const row of rowLines){
    paragraph(row.label,rowY,9,ink,140,M+22);
    doc.setFont('Letter','bold');doc.setFontSize(9);doc.text(row.lines,M+170,rowY,{lineHeightFactor:1.45});
    rowY+=Math.max(28,row.lines.length*14+10);
  }
  y+=height+40;
  y=paragraph('HOLD THE PROPERTY',y,11,green,content,M,true)+10;
  y=paragraph('To hold your approved property, a one-time security deposit of 300 dollars is required. The deposit is refundable upon completion of the leasing process.',y,9,gray)+12;
  paragraph('Approved applicants must submit the security deposit within 24 hours of approval to secure the property. If the deposit is not received within this period, the property may be made available to other applicants.',y,9,gray);

  doc.addPage();doc.setFillColor(ink);doc.rect(0,0,W,91,'F');footer(2);
  doc.setFont('Letter','bold');doc.setFontSize(17);doc.setTextColor('#ffffff');
  doc.text('HOLDING FEE AGREEMENT',W/2,56,{align:'center'});
  let p=136;
  for(const text of [
    'This Holding Fee will be credited toward the required Security Deposit.',
    "The Holding Fee is not applied toward the first month's rent.",
    'Once credited, it becomes the Security Deposit held by the Owner under the Lease Agreement.',
    'The Security Deposit shall accrue interest as required by Minnesota State Law.'
  ])p=paragraph('• '+text,p,10)+10;
  p+=15;
  p=paragraph('Security Deposit Terms (as required by Minnesota State Law)',p,10,ink,content,M,true)+16;
  doc.setDrawColor('#cbd5e1');doc.line(M,p-14,W-M,p-14);
  for(const text of [
    'The landlord must hold the Security Deposit in a separate account.',
    'The landlord must pay interest on the Security Deposit as required.',
    'The landlord must return the deposit plus interest at the end of the lease, unless there are lawful deductions for damages or unpaid rent.'
  ])p=paragraph('• '+text,p,10)+10;
  p+=20;
  const reservation='To reserve the approved property, click the "Submit Deposit" button on your portal to submit the 300 dollars security deposit. This will officially hold the property while your lease is being finalized.';
  doc.setFont('Letter','bold');doc.setFontSize(10);
  const boxHeight=doc.splitTextToSize(reservation,content-36).length*14.5+32;
  doc.setFillColor('#f0fdf4');doc.setDrawColor('#86efac');doc.roundedRect(M,p,content,boxHeight,10,10,'FD');
  paragraph(reservation,p+23,10,green,content-36,M+18,true);
  p+=boxHeight+45;
  paragraph('Sincerely,',p,11);
  paragraph(brand+' Management Team',p+25,11,ink,content,M,true);
  return doc;
}
