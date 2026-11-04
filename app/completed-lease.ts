import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
export type LeaseSignature={landlordName:string;signature:Uint8Array;code:string;tenant:string;property:string;signedAt:string;sourceHash:string;placement:{page:number;x:number;y:number;width:number}};
// Retain the tenant's uploaded pages and draw only in the admin-confirmed landlord area.
export async function completeLease(source:Uint8Array,details:LeaseSignature,fontBytes:Uint8Array){
 source=Uint8Array.from(source);
 const pdf=Buffer.from(source.subarray(0,5)).toString()==='%PDF-';
 const doc=pdf?await PDFDocument.load(source):await PDFDocument.create();
 if(!pdf){const image=source[0]===137?await doc.embedPng(source):await doc.embedJpg(source);const page=doc.addPage([612,792]);const size=image.scaleToFit(612,792);page.drawImage(image,{x:(612-size.width)/2,y:(792-size.height)/2,...size});}
 if(!doc.getPageCount())throw Error('The uploaded lease has no pages.');
 const placement=details.placement,index=placement.page===0?doc.getPageCount()-1:placement.page-1;
 if(index<0||index>=doc.getPageCount())throw Error('Signature page does not exist.');
 const page=doc.getPage(index);if(page.getRotation().angle!==0)throw Error('Rotate the uploaded page upright before signing.');
 const {width:W,height:H}=page.getSize(),x=W*placement.x/100,top=H*placement.y/100;
 doc.registerFontkit(fontkit);const font=await doc.embedFont(fontBytes,{subset:true});
 const signature=await doc.embedPng(details.signature);const size=signature.scaleToFit(W*placement.width/100,H*.075);
 page.drawImage(signature,{x,y:H-top-size.height,...size});
 const color=rgb(.07,.22,.43),nameSize=Math.min(10,(W*.43)/Math.max(1,font.widthOfTextAtSize(details.landlordName,1)));
 page.drawText(details.landlordName,{x,y:H-top-H*.118,font,size:nameSize,color});
 page.drawText(new Date(details.signedAt).toISOString().slice(0,10),{x:W*.696,y:H-top-H*.073,font,size:9,color});
 doc.setSubject('Xenit Realty countersigned lease; source SHA-256 '+details.sourceHash);
 return doc.save();
}
