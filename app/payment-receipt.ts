import {jsPDF} from 'jspdf';
export type PaymentReceipt={kind:'deposit'|'rent';code:string;name:string;property:string;address:string;amount:number;payee:string;reference:string;approvedAt:string;sample?:boolean;combined?:boolean};
export async function downloadPaymentReceipt(r:PaymentReceipt){
 if(!Number.isFinite(r.amount)||r.amount<=0)throw Error('The approved payment amount is unavailable.');
 const doc=new jsPDF({unit:'pt',format:'letter'});
 for(const [file,style] of [['letter-regular.ttf','normal'],['letter-bold.ttf','bold']]){const response=await fetch('/fonts/'+file);if(!response.ok)throw Error('Receipt font could not load');const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);doc.addFileToVFS(file,btoa(binary));doc.addFont(file,'Receipt',style)}
 const title=r.kind==='deposit'?'Security Deposit':'First Month Rent';
 doc.setFillColor('#102c56');doc.rect(0,0,612,112,'F');doc.setFont('Receipt','bold');doc.setFontSize(26);doc.setTextColor('#ffffff');doc.text('Xenit Realty',48,49);doc.setFontSize(12);doc.text(title.toUpperCase()+' RECEIPT',48,81);
 doc.setTextColor('#245edb');doc.setFontSize(19);doc.text(r.sample?'SAMPLE — PAID':'PAID',48,151);
 let y=183;doc.setFontSize(10);
 const rows=[['Receipt reference',(r.kind==='deposit'?'DEP-':'RENT-')+r.reference],['Application number',r.code],['Tenant',r.name],['Residence',r.property],['Property address',r.address],['Payee',r.payee],['Final approval date',r.approvedAt?.slice(0,10)||'Not recorded'],['Payment coverage',title],[r.combined?'Combined move-in payment':'Amount paid',new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(r.amount)]];
 for(const [label,value] of rows){doc.setFont('Receipt','normal');doc.setTextColor('#64748b');doc.text(label,48,y);doc.setFont('Receipt','bold');doc.setTextColor('#102c56');const lines=doc.splitTextToSize(value||'Not recorded',320);doc.text(lines,236,y);y+=Math.max(30,lines.length*14+14)}
 doc.setFillColor('#edf4ff');doc.roundedRect(48,y+8,516,102,10,10,'F');doc.setFont('Receipt','normal');doc.setFontSize(10);doc.setTextColor('#102c56');doc.text(doc.splitTextToSize((r.combined?'This receipt confirms that the '+title.toLowerCase()+' is marked paid following management approval. This older record contains only the combined first month rent and security deposit amount. Both receipts refer to the same transaction; do not add their totals together.':'This receipt confirms payment of the '+title.toLowerCase()+' amount shown above following management approval of the payment and mailing receipt. The other move-in charge is recorded on its separate receipt.'),480),66,y+32,{lineHeightFactor:1.4});
 doc.setFontSize(9);doc.setTextColor('#64748b');doc.text(r.sample?'SAMPLE PREVIEW — NOT PROOF OF PAYMENT':'Generated from the approved Xenit Realty payment record.',48,738);
 doc.save('Xenit-Realty-'+(r.sample?'SAMPLE-':'')+r.kind+'-Receipt-'+r.code.replace(/[^a-zA-Z0-9-]/g,'')+'.pdf');
}
