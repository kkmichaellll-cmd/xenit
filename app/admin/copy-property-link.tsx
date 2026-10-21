'use client';
import {useState} from 'react';

function fallbackCopy(value:string){
 const previous=document.activeElement as HTMLElement|null;
 const field=document.createElement('textarea');
 field.value=value;field.readOnly=true;
 field.style.cssText='position:fixed;left:0;top:0;opacity:0;font-size:16px;pointer-events:none';
 document.body.appendChild(field);
 try{field.focus();field.select();field.setSelectionRange(0,value.length);return document.execCommand('copy');}
 catch{return false;}
 finally{field.remove();previous?.focus({preventScroll:true});}
}
export default function CopyPropertyLink({propertyId}:{propertyId:string}){
 const [status,setStatus]=useState(''),[manualUrl,setManualUrl]=useState('');
 async function copy(){
  const url=new URL('/properties/'+encodeURIComponent(propertyId),window.location.origin).href;
  setManualUrl('');let copied=false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);copied=true;}}catch{}
  if(!copied)copied=fallbackCopy(url);
  setStatus(copied?'Property link copied.':'Select and copy the property link below.');
  if(!copied)setManualUrl(url);
 }
 return <div><button type="button" className="copy-property" onClick={copy}>Copy link</button>
  {status&&<p role="status" style={{fontSize:12,lineHeight:1.5,margin:'8px 0',overflowWrap:'anywhere'}}>{status}</p>}
  {manualUrl&&<input aria-label="Property page link" value={manualUrl} readOnly onFocus={e=>e.currentTarget.select()}/>}
 </div>;
}
