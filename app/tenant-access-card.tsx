'use client';
import {useId,useRef,useState} from 'react';
import {Download,Printer} from 'lucide-react';

type Props={name:string;code:string;photo?:string;propertyPhoto?:string;propertyTitle:string;sample?:boolean};
function dataURL(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Unable to read the card image.'));reader.readAsDataURL(blob)})}
export default function TenantAccessCard({name,code,photo,propertyPhoto,propertyTitle,sample=false}:Props){
 const ref=useRef<SVGSVGElement>(null),id=useId().replace(/[^a-zA-Z0-9]/g,''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function download(){
  if(!photo||!ref.current)return;setBusy(true);setMessage('');let url='';
  try{
   const svg=ref.current.cloneNode(true) as SVGSVGElement;let propertyUnavailable=false;
   // Embed all images so the resulting JPEG contains no remote dependencies.
   await Promise.all(Array.from(svg.querySelectorAll('image')).map(async image=>{
    try{const response=await fetch(image.getAttribute('href')!,{mode:'cors',credentials:'omit'});if(!response.ok)throw Error();image.setAttribute('href',await dataURL(await response.blob()))}
    catch{if(image.dataset.optional==='true'){image.remove();propertyUnavailable=true}else throw Error('Could not load your photo or logo. Refresh this page and try again.');}
   }));
   svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','1700');svg.setAttribute('height','1000');
   url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}));
   const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Unable to create the card image.'));image.src=url});
   const canvas=document.createElement('canvas');canvas.width=1700;canvas.height=1000;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image downloads are unavailable in this browser.');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1700,1000);ctx.drawImage(image,0,0,1700,1000);
   const jpg=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Unable to save JPG.')),'image/jpeg',0.95));
   const href=URL.createObjectURL(jpg),link=document.createElement('a');link.href=href;link.download='Xenit-Realty-'+(sample?'SAMPLE-':'')+'Access-Card-'+code.replace(/[^a-zA-Z0-9-]/g,'')+'.jpg';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);
   setMessage(propertyUnavailable?'JPG downloaded with a branded property background because the property image could not be exported.':'Your access card JPG is ready.');
  }catch(e){setMessage((e as Error).message)}finally{if(url)URL.revokeObjectURL(url);setBusy(false)}
 }
 return <><section className="access-card-print access-card-svg" aria-label="Xenit Realty tenant access card"><svg ref={ref} viewBox="0 0 1700 1000" role="img" aria-label={`${name}, ${code}, Xenit Realty tenant access card`} style={{display:'block',width:'100%',height:'100%'}}>
 <defs><linearGradient id={id+'bg'} x2="1" y2="1"><stop stopColor="#082455"/><stop offset="1" stopColor="#1766dc"/></linearGradient><clipPath id={id+'photo'}><circle cx="255" cy="560" r="160"/></clipPath><clipPath id={id+'property'}><path d="M1250 300H1700V1000H890Z"/></clipPath></defs>
 <rect width="1700" height="1000" fill={'url(#'+id+'bg)'}/><path d="M0 1000 730 270 1250 1000Z" fill="#3e8cff" opacity=".16"/>
 <image href="/xenit-logo-white.svg" x="85" y="80" width="530" height="146"/>
 <text x="85" y="275" fill="#bed8ff" fontFamily="Arial, sans-serif" fontSize="28" fontWeight="700" letterSpacing="5">TENANT ACCESS CARD</text>
 <text x="1600" y="110" textAnchor="end" fill="#bed8ff" fontFamily="Arial, sans-serif" fontSize="24" letterSpacing="3">CURRENT STATUS</text><text x="1600" y="165" textAnchor="end" fill="white" fontFamily="Arial, sans-serif" fontSize="46" fontWeight="700">Renting</text>
 <path d="M1250 300H1700V1000H890Z" fill="#10366a"/>
 <text x="1440" y="600" textAnchor="middle" fill="#bed8ff" fontFamily="Arial, sans-serif" fontSize="24">YOUR RESIDENCE</text>
 {propertyPhoto&&<image data-optional="true" href={propertyPhoto} x="890" y="300" width="810" height="700" preserveAspectRatio="xMidYMid slice" clipPath={'url(#'+id+'property)'}/>}
 <circle cx="255" cy="560" r="168" fill="#8ebfff"/><circle cx="255" cy="560" r="160" fill="#eaf2ff"/>
 {photo?<image href={photo} x="95" y="400" width="320" height="320" preserveAspectRatio="xMidYMid slice" clipPath={'url(#'+id+'photo)'}/>:<text x="255" y="568" textAnchor="middle" fill="#145ac7" fontFamily="Arial, sans-serif" fontSize="26" fontWeight="700">UPLOAD PHOTO</text>}
 <text x="85" y="825" fill="white" fontFamily="Arial, sans-serif" fontSize={name.length>28?32:name.length>20?40:48} fontWeight="700" {...(name.length>38?{textLength:760,lengthAdjust:'spacingAndGlyphs' as const}:{})}>{name}</text>
 <text x="85" y="880" fill="#c9ddff" fontFamily="Arial, sans-serif" fontSize="27" letterSpacing="2">{code}</text>
 <rect x="1040" y="910" width="660" height="90" fill="#082455" opacity=".85"/><text x="1600" y="960" textAnchor="end" fill="white" fontFamily="Arial, sans-serif" fontSize="21" letterSpacing="2">{sample?'SAMPLE — NOT VALID FOR ACCESS':'FOR APPROVED TENANTS ONLY'}</text>
 <title>{propertyTitle}</title>
 </svg></section>{photo&&<div className="access-card-actions print-hidden"><button className="button dark" disabled={busy} onClick={download}><Download size={20}/>{busy?'Preparing JPG…':'Download JPG'}</button><button className="button outline" onClick={()=>window.print()}><Printer size={20}/>Print My Access Card</button></div>}{message&&<p className="print-hidden" role="status">{message}</p>}</>;
}
