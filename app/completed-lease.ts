import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
export type LeaseSignature={landlordName:string;signature:Uint8Array;code:string;tenant:string;property:string;signedAt:string;sourceHash:string};
// Keep every uploaded page and the tenant's visible signature; add a separate signature page.
export async function completeLease(source:Uint8Array,details:LeaseSignature,fontBytes:Uint8Array){
 source=Uint8Array.from(source); // pdf-lib JPEG parsing requires an exact, zero-offset backing buffer.
 const pdf=Buffer.from(source.subarray(0,5)).toString()==='%PDF-';
 const doc=pdf?await PDFDocument.load(source):await PDFDocument.create();
 if(!pdf){const png=source[0]===137;const image=png?await doc.embedPng(source):await doc.embedJpg(source);const page=doc.addPage([612,792]);const size=image.scaleToFit(540,720);page.drawImage(image,{x:(612-size.width)/2,y:(792-size.height)/2,...size});}
 if(!doc.getPageCount())throw Error('The uploaded lease has no pages.');
 doc.registerFontkit(fontkit);const font=await doc.embedFont(fontBytes,{subset:true});
 const page=doc.addPage([612,792]),blue=rgb(.06,.17,.34);let y=736;
 const text=(value:string,size=11)=>{const max=500;let line='';for(const c of value.replace(/[\r\n\t]/g,' ')){if(font.widthOfTextAtSize(line+c,size)>max){page.drawText(line,{x:56,y,font,size,color:blue});y-=size+7;line='';}line+=c;}page.drawText(line,{x:56,y,font,size,color:blue});y-=size+14;};
 text('XENIT REALTY',22);text('LANDLORD SIGNATURE',15);
 text('This signature page forms part of the preceding tenant-submitted lease.');
 text('Application: '+details.code);text('Tenant: '+details.tenant);text('Property: '+details.property);
 text('Landlord: '+details.landlordName,13);
 text('Signed: '+new Date(details.signedAt).toISOString().replace('T',' ').replace('Z',' UTC'));
 text('I have reviewed the attached lease and sign it as landlord or authorized representative.');
 const signature=await doc.embedPng(details.signature);const size=signature.scaleToFit(450,100);
 page.drawImage(signature,{x:56,y:y-110,...size});y-=126;text('Landlord signature',10);
 page.drawLine({start:{x:56,y:100},end:{x:556,y:100},thickness:1,color:rgb(.8,.84,.9)});
 page.drawText('Original tenant upload SHA-256:',{x:56,y:80,font,size:8,color:blue});
 page.drawText(details.sourceHash,{x:56,y:65,font,size:8,color:blue});
 page.drawText('Signature page | '+doc.getPageCount()+' pages in completed lease',{x:56,y:42,font,size:9,color:blue});
 return doc.save();
}
