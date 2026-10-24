'use client';
import {useState} from 'react';
import {ImageIcon,ChevronLeft,ChevronRight} from 'lucide-react';
import styles from './availability.module.css';
export default function AvailabilityGallery({images,title}:{images:string[];title:string}){
 const [active,setActive]=useState(0),[broken,setBroken]=useState<Record<string,boolean>>({});
 const index=Math.min(active,images.length-1),src=images[index];
 return <div className={styles.gallery}>
  <div className={styles.mainPhoto}>{broken[src]?<div className={styles.photoFallback}><ImageIcon size={40}/><span>Property photo unavailable</span></div>:<img src={src} alt={title+' — property photo '+(index+1)} fetchPriority="high" onError={()=>setBroken(value=>({...value,[src]:true}))}/>}
   <span className={styles.photoCounter}>{index+1} / {images.length}</span>
   {images.length>1&&<div className={styles.photoControls}><button type="button" aria-label="Previous property photo" onClick={()=>setActive((index+images.length-1)%images.length)}><ChevronLeft size={20}/></button><button type="button" aria-label="Next property photo" onClick={()=>setActive((index+1)%images.length)}><ChevronRight size={20}/></button></div>}
  </div>
  {images.length>1&&<div className={styles.thumbnails} aria-label="Property photos">{images.map((url,i)=><button key={i} type="button" className={index===i?styles.activeThumbnail:''} onClick={()=>setActive(i)} aria-label={'Show property photo '+(i+1)} aria-pressed={index===i}><img src={url} alt="" loading="lazy"/></button>)}</div>}
 </div>;
}
