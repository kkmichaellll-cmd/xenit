'use client';
import {useState} from 'react';
import {ArrowRight,Building2,Check,ChevronDown,House,KeyRound} from 'lucide-react';
import {availabilityOptions,type AvailabilityOption} from './availability-data';
import styles from './availability.module.css';
const optionIcons={rent:KeyRound,'rent-to-own':House,buy:Building2};
export default function AvailabilityPreference(){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<AvailabilityOption|null>(null);
 return <section className={styles.preferenceSection} aria-labelledby="preference-heading">
  <button type="button" className={styles.preferenceToggle} aria-expanded={open} aria-controls="preference-options" onClick={()=>setOpen(value=>!value)}><span id="preference-heading">Select your preference</span><ChevronDown size={21} className={open?styles.chevronOpen:''}/></button>
  {open&&<div id="preference-options" className={styles.options}>{(Object.keys(availabilityOptions) as AvailabilityOption[]).map(key=>{const item=availabilityOptions[key],Icon=optionIcons[key],active=selected===key;return <button type="button" key={key} className={styles.optionCard} aria-pressed={active} onClick={()=>{setSelected(key);setOpen(false)}}><span className={styles.optionHeading}><span className={styles.iconTile}><Icon size={24}/></span><span className={styles.optionTitle}>{item.title}</span></span><p>{item.summary}</p><span className={styles.optionAction}>{active?'Selected':'Choose '+item.title}{active?<Check size={21}/>:<ArrowRight size={21}/>}</span></button>})}</div>}
  {selected&&<div className={styles.selectedMessage} role="status" aria-live="polite"><span className={styles.selectedBadge}><Check size={16}/> Your preference</span><h2>You&apos;ve Selected: {availabilityOptions[selected].title}</h2><p>{availabilityOptions[selected].description}</p></div>}
 </section>;
}
