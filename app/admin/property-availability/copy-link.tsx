'use client';
import {useState} from 'react';
import {Copy,Check} from 'lucide-react';
import {availabilityPath} from '../../availability-data';
export default function CopyAvailabilityLink({id}:{id:string}){
 const [status,setStatus]=useState(''),[manual,setManual]=useState('');
 async function copy(){const url=new URL(availabilityPath(id),window.location.origin).href;let copied=false;setManual('');try{await navigator.clipboard.writeText(url);copied=true}catch{
  const input=document.createElement('textarea'),previous=document.activeElement as HTMLElement|null;input.value=url;input.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.appendChild(input);try{input.focus();input.select();copied=document.execCommand('copy')}catch{}finally{input.remove();previous?.focus()}
 }setStatus(copied?'Link copied.':'Copy the link below.');if(!copied)setManual(url)}
 return <div><button type="button" className="button outline" onClick={copy}>{status==='Link copied.'?<Check size={17}/>:<Copy size={17}/>}Copy link</button>{status&&<small role="status">{status}</small>}{manual&&<input readOnly aria-label="Availability page link" value={manual} onFocus={e=>e.currentTarget.select()}/>}</div>;
}
