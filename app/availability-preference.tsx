'use client';
import {useState} from 'react';
import {Check,ChevronDown} from 'lucide-react';
import {availabilityOptions,type AvailabilityOption} from './availability-data';
import styles from './availability.module.css';
export default function AvailabilityPreference(){
 const [selected,setSelected]=useState<AvailabilityOption|''>('');
 return <section className={styles.preferenceSection}>
 <label className={styles.preferenceLabel} htmlFor="availability-preference">Select your preference</label>
 <div className={styles.preferenceField}><select id="availability-preference" className={styles.preferenceSelect} value={selected} onChange={e=>setSelected(e.target.value as AvailabilityOption)}>
 <option value="" disabled>Select your preference</option>
 {(Object.keys(availabilityOptions) as AvailabilityOption[]).map(key=><option key={key} value={key}>{availabilityOptions[key].title}</option>)}
 </select><span className={styles.preferenceChevron} aria-hidden="true"><ChevronDown size={20}/></span></div>
 {selected&&<div className={styles.selectedMessage} role="status" aria-live="polite"><span className={styles.selectedBadge}><Check size={16}/> Your preference</span><h2>You&apos;ve Selected: {availabilityOptions[selected].title}</h2><p>{availabilityOptions[selected].description}</p></div>}
 </section>;
}
