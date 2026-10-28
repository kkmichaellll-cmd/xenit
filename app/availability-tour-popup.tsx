'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,Check,X} from 'lucide-react';
import styles from './availability.module.css';
export default function AvailabilityTourPopup({propertyId}:{propertyId:string}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),heading=useId(),requestId=useRef('');
 const [open,setOpen]=useState(false),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [zone,setZone]=useState(''),[today,setToday]=useState('');
 useEffect(()=>{setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);const now=new Date();setToday(new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10))},[]);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[open]);
 function close(){if(!busy)dialog.current?.close()}
 return <><button ref={trigger} type="button" className={styles.tourButton} onClick={()=>{if(!requestId.current)requestId.current=crypto.randomUUID();dialog.current?.showModal();setOpen(true)}}>Schedule a Tour Now <ArrowRight size={20}/></button>
 <dialog ref={dialog} className={styles.tourDialog} aria-labelledby={heading} onCancel={e=>{if(busy)e.preventDefault()}} onClose={()=>{setOpen(false);trigger.current?.focus()}} onClick={e=>{if(e.target===e.currentTarget)close()}}>
 <div className={styles.dialogContent}><button type="button" disabled={busy} className={styles.dialogClose} aria-label="Close" onClick={close}><X size={22}/></button>
 {sent?<><span className={styles.confirmIcon}><Check size={32}/></span><h2 id={heading}>Thank you for scheduling your tour.</h2><p>Access code will be sent to you at the scheduled viewing time.</p><button autoFocus type="button" className={styles.dialogDone} onClick={close}>Close</button></>:<><h2 id={heading}>Choose your viewing time</h2><form className={styles.tourForm} onSubmit={async e=>{
 e.preventDefault();if(busy)return;setError('');const f=new FormData(e.currentTarget),date=String(f.get('date')),time=String(f.get('time')),local=new Date(date+'T'+time);
 if(!Number.isFinite(local.getTime())||local.getTime()<=Date.now()){setError('Choose a future date and time.');return}
 setBusy(true);try{const response=await fetch('/api/availability-tour',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId.current,propertyId,name:f.get('name'),email:f.get('email'),phone:f.get('phone'),date,time,timeZone:zone,startsAt:local.toISOString()})});const result=await response.json();if(!response.ok)throw Error(result.error||'Could not submit your request. Please try again.');setSent(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }}><label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={30} placeholder="Include country code"/></label><label>Viewing date<input name="date" type="date" required min={today}/></label><label>Viewing time<input name="time" type="time" required/></label><small>Times are shown in your time zone: {zone||'Loading…'}. Choose the equivalent time for the property’s location.</small><p className={styles.tourError} role="alert">{error}</p><button disabled={busy||!zone} className={styles.dialogDone}>{busy?'Submitting…':'Submit viewing request'}</button></form></>}
 </div></dialog></>;
}
