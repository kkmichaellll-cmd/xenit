'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,Check,X} from 'lucide-react';
import styles from './availability.module.css';
export default function AvailabilityTourPopup(){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),heading=useId();
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[open]);
 function close(){dialog.current?.close()}
 return <><button ref={trigger} type="button" className={styles.tourButton} onClick={()=>{dialog.current?.showModal();setOpen(true)}}>Schedule a Tour Now <ArrowRight size={20}/></button>
 <dialog ref={dialog} className={styles.tourDialog} aria-labelledby={heading} onClose={()=>{setOpen(false);trigger.current?.focus()}} onClick={e=>{if(e.target===e.currentTarget)close()}}>
 <div className={styles.dialogContent}><button type="button" className={styles.dialogClose} aria-label="Close tour confirmation" onClick={close}><X size={22}/></button><span className={styles.confirmIcon}><Check size={32}/></span><h2 id={heading}>Thank you for scheduling your tour.</h2><p>Please contact the landlord for your access code</p><button autoFocus type="button" className={styles.dialogDone} onClick={close}>Close</button></div>
 </dialog></>;
}
