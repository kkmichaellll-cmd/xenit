'use client';
import {useState} from 'react';
import styles from './property-videos.module.css';
export default function PropertyVideos({videos=[],title}:{videos?:string[];title:string}){
 const [failed,setFailed]=useState<Record<string,boolean>>({});
 if(!videos.length)return null;
 return <section className={styles.section} aria-label="Apartment videos"><h2>Explore the apartment</h2><div className={styles.grid}>{videos.map((src,i)=><div className={styles.card} key={src}>{failed[src]?<p>This video could not be played. <a href={src} target="_blank" rel="noopener noreferrer">Open video</a></p>:<video controls playsInline preload="none" aria-label={title+' — video '+(i+1)} src={src} onError={()=>setFailed(s=>({...s,[src]:true}))}/>}</div>)}</div></section>
}
