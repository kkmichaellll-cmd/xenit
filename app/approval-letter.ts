import {jsPDF} from 'jspdf';
import type {Application} from './application-data';
import {leaseLabel} from './approval-details';
import {DEFAULT_HOLD_PROPERTY_TEXT} from './hold-property-copy';
import {DEFAULT_LEGAL_REFERENCE_TEXT,DEFAULT_LEGAL_REFERENCE_URL} from './legal-reference-copy';

// Embedded logo keeps downloaded letters branded without a separate asset request.
const approvalLogo='data:image/png;base64,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';

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
  const ink='#12376d',gray='#64748b',blue='#2059df';
  const brand='Xenit Realty';
  doc.setProperties({title:'Xenit Realty — Application Approval Letter',author:brand,creator:brand+' Portal',subject:'Application approval and holding fee agreement'});
  const property=a.approval?.address||a.propertyTitle;
  const date=(a.approval?.approvedAt||a.updatedAt).slice(0,10).split('-').reverse().join('/');
  function paragraph(text:string,y:number,size=10,color=ink,width=content,x=M,bold=false){
    doc.setFont('Letter',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);
    const lines=doc.splitTextToSize(text,width);
    doc.text(lines,x,y,{lineHeightFactor:1.45});
    return y+lines.length*size*1.45;
  }
  function footer(page:number,total:number){
    doc.setFillColor(ink);doc.rect(0,H-34,W,34,'F');
    doc.setFont('Letter','normal');doc.setFontSize(6.5);doc.setTextColor('#ffffff');
    doc.text(`This is an automatically generated official document from the ${brand} Portal. | Page ${page} of ${total}`,W/2,H-13,{align:'center'});
  }
  doc.setFillColor(ink);doc.rect(0,0,W,113,'F');
  doc.addImage(approvalLogo,'PNG',M,31,180,180*64/232);
  doc.setFont('Letter','bold');doc.setTextColor('#ffffff');doc.setFontSize(8);doc.text('OFFICIAL APPROVAL LETTER',W-M,73,{align:'right'});

  paragraph('Date: '+date,170,8,gray);
  doc.text('Ref: '+(a.code||a.id),W-M,170,{align:'right'});
  paragraph('Application Approved',225,18,ink,content,M,true);
  let y=paragraph('Dear '+a.name+',',281,11)+23;
  y=paragraph(`Congratulations! We are delighted to inform you that your application for the residence at ${property} has been officially approved. We were very impressed with your application and are excited to welcome you to the ${brand} community.`,y,10.5)+15;
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
 
// Keep the editable section and its mandatory legal reference within printable bounds.
  // If the text is long, continue on a properly branded page rather than clipping it.
  const bottomLimit = H - 65;
  function continuationPage(){
    doc.addPage();
    doc.setFillColor(ink);doc.rect(0,0,W,91,'F');
    doc.addImage(approvalLogo,'PNG',M,24,150,150*64/232);
    y=132;
  }
  function measuredHeight(text:string,size=11){
    doc.setFont('Letter','normal');doc.setFontSize(size);
    return doc.splitTextToSize(text,content).length*size*1.45;
  }
  if(y+55>bottomLimit)continuationPage();
  y = paragraph('HOLD THE PROPERTY',y,11,blue,content,M,true)+18;
  const holdPropertyText=(a.approval as (typeof a.approval & {holdPropertyText?:string})|undefined)?.holdPropertyText?.trim()||DEFAULT_HOLD_PROPERTY_TEXT;
  // Wrap at word boundaries so long admin text cannot hide the legal reference.
  for(const block of holdPropertyText.split(/\n\s*\n/).filter(Boolean)){
    doc.setFont('Letter','normal');doc.setFontSize(11);
    const lines:string[]=doc.splitTextToSize(block,content);
    for(const line of lines){
      if(y+16>bottomLimit)continuationPage();
      y=paragraph(line,y,11,gray)+0;
    }
    y+=18;
  }
  // Keep the heading, reference text and URL together whenever they fit on one page.
  const approvalLegal=a.approval as (typeof a.approval & {legalReferenceText?:string;legalReferenceUrl?:string})|undefined;
  const legalText=approvalLegal?.legalReferenceText?.trim()||DEFAULT_LEGAL_REFERENCE_TEXT;
  const legalUrl=approvalLegal?.legalReferenceUrl?.trim()||DEFAULT_LEGAL_REFERENCE_URL;
  doc.setFont('Letter','normal');doc.setFontSize(11);
  const legalLines=doc.splitTextToSize(legalText,content) as string[];
  doc.setFont('Letter','normal');doc.setFontSize(10);
  const urlLines=doc.splitTextToSize(legalUrl,content) as string[];
  // paragraph() advances 11*1.45 per legal line; URL lines advance 15pt.
  const headingHeight=11*1.45+10;
  const referenceHeight=legalLines.length*11*1.45+6;
  const urlHeight=urlLines.length*15;
  const legalGroupHeight=headingHeight+referenceHeight+urlHeight+8;
  if(y+legalGroupHeight>bottomLimit)continuationPage();
  y=paragraph('Official Legal Reference:',y,11,ink,content,M,true)+10;
  for(const line of legalLines){
    // Extremely long admin references may exceed a full page; break only then.
    if(y+11*1.45+6>bottomLimit)continuationPage();
    y=paragraph(line,y,11,gray);
  }
  y+=6;
  for(const line of urlLines){
    if(y+15>bottomLimit)continuationPage();
    doc.setFont('Letter','normal');doc.setFontSize(10);doc.setTextColor(blue);
    doc.textWithLink(line,M,y,{url:legalUrl});
    y+=15;
  }

  doc.addPage();doc.setFillColor(ink);doc.rect(0,0,W,91,'F');
  doc.addImage(approvalLogo,'PNG',M,24,150,150*64/232);
  doc.setFont('Letter','bold');doc.setFontSize(10);doc.setTextColor('#ffffff');
  
  let p=136;

  p = paragraph(
  'HOLDING FEE AGREEMENT',
  p,
  11,
  blue,
  content,
  M,
  true
) + 24;
  
  for(const text of [
    'This Holding Fee will be credited toward the required Security Deposit.',
    "The Holding Fee is not applied toward the first month's rent.",
    'Once credited, it becomes the Security Deposit held by the Owner under the Lease Agreement.',
    'The Security Deposit shall accrue interest as required by the above State Law.'
  ])p=paragraph('• '+text,p,12)+13;
  p+=15;
  p=paragraph('Security Deposit Terms (as required by the above State Law)',p,10,ink,content,M,true)+16;
  doc.setDrawColor('#cbd5e1');doc.line(M,p-14,W-M,p-14);
  for(const text of [
    'The landlord must hold the Security Deposit in a separate account.',
    'The landlord must pay interest on the Security Deposit as required.',
    'The landlord must return the deposit plus interest at the end of the lease, unless there are lawful deductions for damages or unpaid rent.'
  ])p=paragraph('• '+text,p,12)+13;
  p+=20;
  const reservation='To reserve the approved property, click the "Submit Deposit" button on your portal to submit the security deposit. This will officially hold the property while your lease is being finalized.';
  doc.setFont('Letter','bold');doc.setFontSize(10);
  const boxHeight=doc.splitTextToSize(reservation,content-36).length*14.5+32;
  doc.setFillColor('#eff4fc');doc.setDrawColor('#cfdbea');doc.roundedRect(M,p,content,boxHeight,10,10,'FD');
  paragraph(reservation,p+23,10,blue,content-36,M+18,true);
  p+=boxHeight+45;
  paragraph('Sincerely,',p,11);
  paragraph(brand+' Management Team',p+25,11,ink,content,M,true);
  const totalPages=doc.getNumberOfPages();
  for(let page=1;page<=totalPages;page++){doc.setPage(page);footer(page,totalPages);}
  return doc;
}
