import Link from 'next/link';
import {ArrowRight,ArrowUpRight,ArrowLeft,MapPin,House,KeyRound,UserRound,CalendarDays,Info,Check,Building2,Wallet,Landmark} from 'lucide-react';
import {availabilityOptions,availabilityPath,availabilityMoney,type AvailabilityRecord,type AvailabilityOption} from './availability-data';
import AvailabilityGallery from './availability-gallery';
import styles from './availability.module.css';
const optionIcons={rent:KeyRound,'rent-to-own':House,buy:Building2};
function Footer(){return <div className={styles.footer}><Link href="/" aria-label="Xenit Realty home"><img src="/xenit-logo.svg" width="160" height="36" alt="Xenit Realty"/></Link><span>A place for your next chapter.</span><Link href="/portal">Enter Tenant Portal <ArrowUpRight size={16}/></Link></div>}
export function AvailabilityView({record,option}:{record:AvailabilityRecord;option?:AvailabilityOption}){
 const {data,id}=record,base=availabilityPath(id);
 return <main className={styles.page}><div className={styles.container}>
 <div className={styles.breadcrumb}><Link href="/">Home</Link><span>/</span>{option?<><Link href={base}>Property availability</Link><span>/</span><span>{availabilityOptions[option].title}</span></>:<span>Property availability</span>}</div>
 {option?<>
  <Link href={base} className={styles.back}><ArrowLeft size={17}/> Change your selection</Link>
  <section className={styles.selectionHero}><div className={styles.selectionText}><span className={styles.eyebrow}>YOUR NEXT CHAPTER</span><span className={styles.selectedBadge}><Check size={16}/> Your preference</span><h1>You&apos;ve Selected: {availabilityOptions[option].title}</h1><p>{availabilityOptions[option].description}</p><div className={styles.selectedProperty}><House size={20}/><span>{data.title}{data.location&&<small>{data.location}</small>}</span></div></div><img className={styles.selectionImage} src={data.images[0]} alt={data.title}/></section>
  <div className={styles.nextGrid}><section className={styles.notice}><span className={styles.iconTile}><Info size={24}/></span><h2>Property Status Notice</h2><div className={styles.prose}>{data.statusNotice.split(/\n\s*\n/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div></section>
  <section className={styles.tourCard}><span className={styles.iconTile}><CalendarDays size={27}/></span><span className={styles.eyebrow}>COME TAKE A LOOK</span><h2>Schedule a Property Tour</h2><p>{data.tourIntro}</p><p>{data.tourDetails}</p><a className={styles.tourButton} href="https://opentournow.com" target="_blank" rel="noopener noreferrer">Schedule a Tour Now <ArrowUpRight size={20}/></a></section></div>
 </>:<>
  <div className={styles.heading}><div><span className={styles.eyebrow}>PROPERTY AVAILABILITY</span><h1>{data.title}</h1>{data.location&&<p className={styles.location}><MapPin size={18}/>{data.location}</p>}</div><span className={styles.choiceBadge}>One home. More possibilities.</span></div>
  <AvailabilityGallery images={data.images} title={data.title}/>
  <div className={styles.profileGrid}><section className={styles.profileCard}><span className={styles.iconTile}><House size={23}/></span><h2>House Profile</h2><p className={styles.preserve}>{data.houseProfile}</p></section><section className={styles.profileCard}><span className={styles.iconTile}><UserRound size={23}/></span><h2>Landlord Profile</h2>{data.landlordName&&<h3>{data.landlordName}</h3>}<p className={styles.preserve}>{data.landlordProfile}</p></section></div>
  <section className={styles.financials}><div className={styles.sectionHeading}><span className={styles.eyebrow}>THE DETAILS, AT A GLANCE</span><h2>Property Pricing &amp; Financial Details</h2></div><div className={styles.priceGrid}>{([[KeyRound,'Est. Monthly Rent',data.monthlyRent],[Wallet,'Security Deposit',data.securityDeposit],[Landmark,'Estimated Sales Price',data.salesPrice]] as const).map(([Icon,label,value])=><div className={styles.priceCard} key={label}><span><Icon size={19}/>{label}</span><strong>{availabilityMoney(value)}</strong></div>)}</div></section>
  <section className={styles.optionsSection}><div className={styles.sectionHeading}><span className={styles.eyebrow}>MAKE YOURSELF AT HOME</span><h2>Choose Your Preferred Option</h2><p>Find the path that feels right for you.</p></div><div className={styles.options}>{(Object.keys(availabilityOptions) as AvailabilityOption[]).map(key=>{const item=availabilityOptions[key],Icon=optionIcons[key];return <Link key={key} href={base+'/'+key} className={styles.optionCard}><span className={styles.iconTile}><Icon size={26}/></span><h3>{item.title}</h3><p>{item.summary}</p><span className={styles.optionAction}>Choose {item.title}<ArrowRight size={21}/></span></Link>})}</div></section>
 </>}
 <Footer/>
 </div></main>;
}
