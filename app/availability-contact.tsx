import {Mail,Phone,UserRound} from 'lucide-react';
import styles from './availability.module.css';
export type LandlordContact={name?:string;email?:string;phone?:string};
export default function AvailabilityContact({name,email,phone}:LandlordContact){
 if(!name&&!email&&!phone)return null;
 return <address className={styles.contactDetails}>
 {name&&<div><UserRound size={18}/><span><small>Landlord</small><strong>{name}</strong></span></div>}
 {email&&<a href={'mailto:'+encodeURIComponent(email)}><Mail size={18}/><span><small>Email</small>{email}</span></a>}
 {phone&&<a href={'tel:'+phone.replace(/[^\d+]/g,'')}><Phone size={18}/><span><small>Phone</small>{phone}</span></a>}
 </address>;
}
