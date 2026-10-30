'use client';
import {useId,useRef,useState} from 'react';
import {Download,Printer} from 'lucide-react';
import {api,auth} from './live-client';
import {createAccessCardJpg} from './access-card-export';

type Props={name:string;code:string;photo?:string;propertyPhoto?:string;propertyTitle:string;sample?:boolean;applicationId?:string};
export default function TenantAccessCard({name,code,photo,propertyPhoto,propertyTitle,sample=false,applicationId}:Props){
 const ref=useRef<SVGSVGElement>(null),id=useId().replace(/[^a-zA-Z0-9]/g,''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function download(){
  if(!photo)return;setBusy(true);setMessage('');
  try{
   // Signed tenant photos expire, so obtain a fresh URL for every download.
   const currentPhoto=applicationId?(await api('/access-card-photo/'+applicationId)).url:photo;
   const jpg=await createAccessCardJpg({name,code,photo:currentPhoto,propertyPhoto,sample,
    loadPropertyPhoto:applicationId?async()=>{
     const {data:{session}}=await auth().auth.getSession();
     if(!session)throw Error('Please sign in again before downloading your card.');
     const response=await fetch('/api/access-card-property/'+encodeURIComponent(applicationId),{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
     if(!response.ok)throw Error('The property photo could not be downloaded. Please contact your property manager to check its image link.');
     return response.blob();
    }:undefined});
   const href=URL.createObjectURL(jpg),link=document.createElement('a');link.href=href;link.download='Xenit-Realty-'+(sample?'SAMPLE-':'')+'Access-Card-'+code.replace(/[^a-zA-Z0-9-]/g,'')+'.jpg';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);
   setMessage('Your access card JPG is ready.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to download your access card. Please try again.')}finally{setBusy(false)}
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
 </svg></section>{photo&&<div className="access-card-actions print-hidden"><button className="button dark" disabled={busy} onClick={download}><Download size={20}/>{busy?'Preparing JPG…':'Download JPG'}</button><button className="button outline" disabled={busy} onClick={async()=>{
 if(sample||!applicationId){window.print();return}
 setBusy(true);setMessage('');
 try{await api('/access-card-print',{applicationId});window.location.assign('/dashboard')}
 catch(e){setMessage((e as Error).message);setBusy(false)}
 }}><Printer size={20}/>Print My Access Card</button></div>}{message&&<p className="print-hidden" role="status">{message}</p>}</>;
}
