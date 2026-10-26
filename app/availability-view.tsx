import Link from 'next/link';
import PropertyVideos from './property-videos';
import {ArrowUpRight,MapPin,CalendarDays,Info,KeyRound,Wallet,Landmark} from 'lucide-react';
import {availabilityMoney,type AvailabilityRecord} from './availability-data';
import AvailabilityTourPopup from './availability-tour-popup';
import AvailabilityGallery from './availability-gallery';
import AvailabilityPreference from './availability-preference';
import styles from './availability.module.css';
export function AvailabilityView({record}:{record:AvailabilityRecord}){
 const {data}=record,version=data.pageVersion??1,pageName=version===2?'Property availability 2':'Property availability';
 return <main className={styles.page}><div className={styles.container}>
  <div className={styles.breadcrumb}><Link href="/">Home</Link><span>/</span><span>{pageName}</span></div>
  <AvailabilityPreference/>
  <section className={styles.propertyPanel} aria-labelledby="property-title">
   <div className={styles.propertyIdentity}><div><h1 id="property-title">{data.title}</h1>{data.location&&<p><MapPin size={17}/>{data.location}</p>}</div></div>
   <AvailabilityGallery images={data.images} title={data.title}/>
  </section>
  <section className={styles.financials} aria-label="Property pricing"><div className={styles.priceGrid}>{([[KeyRound,'Est. Monthly Rent',data.monthlyRent],[Wallet,'Security Deposit',data.securityDeposit],[Landmark,'Estimated Sales Price',data.salesPrice]] as const).map(([Icon,label,value])=><div className={styles.priceCard} key={label}><span><Icon size={19}/>{label}</span><strong>{availabilityMoney(value)}</strong></div>)}</div></section>
  <PropertyVideos videos={data.videos} title={data.title}/>
  <div className={styles.singleFlow}><section className={styles.notice}><span className={styles.iconTile}><Info size={24}/></span><h2>Property Status Notice</h2><div className={styles.prose}>{data.statusNotice.split(/\n\s*\n/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div></section>
  <section className={styles.tourCard}><span className={styles.iconTile}><CalendarDays size={27}/></span><span className={styles.eyebrow}>COME TAKE A LOOK</span><h2>Schedule a Property Tour</h2><p>{data.tourIntro}</p><p>{data.tourDetails}</p>{version===2?<AvailabilityTourPopup/>:<><a className={styles.tourButton} href="https://opentournow.com" target="_blank" rel="noopener noreferrer">Schedule a Tour Now <ArrowUpRight size={20}/></a><small>Opens opentournow.com in a new tab.</small></>}</section></div>
 </div></main>;
}
