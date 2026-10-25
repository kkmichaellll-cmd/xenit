'use client';
import {useRef,useState} from 'react';
import {api,auth} from '../live-client';
import styles from '../property-videos.module.css';
export default function PropertyVideoEditor({videos=[],onChange,disabled=false,onBusy}:{videos?:string[];onChange:(videos:string[])=>void;disabled?:boolean;onBusy:(busy:boolean)=>void}){
 const [uploading,setUploading]=useState(false),[message,setMessage]=useState('');const lock=useRef(false);
 async function upload(files:File[]){
 if(!files.length||lock.current||disabled)return;
 if(videos.length+files.length>6){setMessage('Use up to 6 videos per apartment.');return}
 if(files.some(f=>!['video/mp4','video/webm'].includes(f.type)||!f.size||f.size>20*1024*1024)){setMessage('Choose MP4 or WebM videos up to 20 MB each.');return}
 lock.current=true;setUploading(true);onBusy(true);let added=[...videos];
 try{for(let i=0;i<files.length;i++){const file=files[i];setMessage('Uploading video '+(i+1)+' of '+files.length+'…');const grant=await api('/availability/video-upload',{type:file.type,size:file.size});const {error}=await auth().storage.from('property-videos').uploadToSignedUrl(grant.path,grant.token,file,{contentType:file.type});if(error)throw Error('Video upload failed. Check your connection and the property-videos bucket setup.');added=[...added,grant.url];onChange(added)}setMessage('Videos added to draft. Save the page to publish your changes.')}catch(e){setMessage((e as Error).message+' Any completed uploads remain in this draft.')}finally{lock.current=false;setUploading(false);onBusy(false)}
 }
 function move(i:number,j:number){const next=[...videos];[next[i],next[j]]=[next[j],next[i]];onChange(next)}
 return <fieldset className={styles.editor} disabled={disabled||uploading}><legend>Apartment videos</legend><p>Upload MP4 or WebM, up to 20 MB each and 6 videos per apartment. MP4 with H.264 video and AAC audio is recommended for compatibility. Videos play directly on the website. Uploaded media is public, even before the page is published.</p>{videos.map((src,i)=><div className={styles.item} key={src}><strong>Video {i+1}</strong><video src={src} controls playsInline preload="none" aria-label={'Preview video '+(i+1)}/><div className={styles.actions}><button type="button" className="button outline" onClick={()=>onChange(videos.filter((_,j)=>j!==i))}>Remove</button><button type="button" className="button outline" disabled={i===0||disabled||uploading} onClick={()=>move(i,i-1)}>Move up</button><button type="button" className="button outline" disabled={i===videos.length-1||disabled||uploading} onClick={()=>move(i,i+1)}>Move down</button></div></div>)}<label className={styles.upload}>Upload videos<input type="file" accept="video/mp4,video/webm,.mp4,.webm" multiple disabled={disabled||uploading||videos.length>=6} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';void upload(files)}}/></label>{message&&<p role="status" className={styles.status}>{message}</p>}</fieldset>
}
