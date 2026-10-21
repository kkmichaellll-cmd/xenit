'use client';
import {useState} from 'react';
import Link from 'next/link';
import s from './homepage.module.css';

const ArrowUpRight=()=> <svg className={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>;
const ArrowDown=()=> <svg className={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>;
const MenuIcon=()=> <svg className={s.menuIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
const CloseIcon=()=> <svg className={s.menuIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>;
const PlayIcon=()=> <svg className={s.playIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10-6.5-10-6.5Z"/></svg>;

const services = [
 {id:'investors',label:'Investors',title:'Your property. A simpler way forward.',text:'Explore property management with Xenit Realty. Talk with us about your residence, your plans, and the support you need.',cta:'Discuss Your Property',href:'mailto:info@xenitrealty.com?subject=Property%20management'},
 {id:'residents',label:'Residents',title:'Make room for your next chapter.',text:'Manage your application and move-in documents in one place. Your tenant portal keeps the next step within reach.',cta:'Enter Tenant Portal',href:'/portal'},
 {id:'agents',label:'Agents',title:'Keep your clients in good hands.',text:'Let’s talk about working together when your clients need a rental or property management assistance.',cta:'Connect With Xenit',href:'mailto:info@xenitrealty.com?subject=Agent%20enquiry'},
 {id:'vendors',label:'Vendor Partners',title:'Great homes take great partners.',text:'Introduce your business and the services you provide. Contact our team to discuss opportunities to work together.',cta:'Introduce Your Business',href:'mailto:info@xenitrealty.com?subject=Vendor%20enquiry'},
 {id:'companies',label:'Property Management Companies',title:'Start a conversation about what’s next.',text:'Have a collaboration in mind? Tell us about your company and what you would like to build together.',cta:'Talk to Our Team',href:'mailto:info@xenitrealty.com?subject=Business%20enquiry'},
 {id:'careers',label:'Careers',title:'Bring your perspective to property.',text:'Interested in working with Xenit Realty? Reach out to ask about current opportunities and introduce yourself.',cta:'Enquire About Opportunities',href:'mailto:info@xenitrealty.com?subject=Careers%20enquiry'}
];
export default function Home(){
 const [open,setOpen]=useState(false);
 return <div className={s.home}>
  <header className={s.header}><Link href="/" aria-label="Xenit Realty home"><img className={s.logo} src="/xenit-logo.svg" alt="Xenit Realty"/></Link><button className={s.menu} type="button" aria-label={open?'Close navigation menu':'Open navigation menu'} aria-expanded={open} aria-controls="xenit-nav" onClick={()=>setOpen(!open)}>{open?<CloseIcon/>:<MenuIcon/>}</button><nav id="xenit-nav" className={`${s.nav} ${open?s.open:''}`} aria-label="Main navigation"><a href="#investors" onClick={()=>setOpen(false)}>Property Management</a><a href="#residents" onClick={()=>setOpen(false)}>Residents</a><a href="#companies" onClick={()=>setOpen(false)}>Company</a><a href="#contact" onClick={()=>setOpen(false)}>Contact</a><Link className={s.primary} href="/portal">Enter Tenant Portal <ArrowUpRight/></Link></nav></header>
  <main>
   <section className={s.hero} aria-labelledby="home-title"><div className={s.heroCopy}><div className={s.switch} aria-label="Tenant experience selected"><button type="button" aria-pressed="true" disabled>Tenant</button><button type="button" aria-pressed="false" disabled>Investor</button></div><p className={s.eyebrow}>WELCOME TO XENIT REALTY</p><h1 id="home-title">A place to live.<br/>A place to belong.</h1><p className={s.lead}>Take your next step with Xenit Realty. Sign in to manage your application, documents, and move-in progress.</p><div className={s.actions}><Link className={s.primary} href="/portal">Enter Tenant Portal <ArrowUpRight/></Link><a className={s.secondary} href="#residents">Explore Resident Services <ArrowDown/></a></div></div><div className={s.heroArt}><img src="/xenit-home/hero-home-v2.png" alt="Welcoming contemporary home with a landscaped garden and front porch" width="1672" height="941" fetchPriority="high"/></div></section>
   <img className={s.houses} src="/xenit-home/houses.png" alt=""/>
   {services.map((item,index)=><section id={item.id} className={`${s.row} ${index%2?s.reverse:''}`} key={item.id}><div className={s.art}><img src={`/xenit-home/${item.id}.png`} alt={`${item.label} illustration`} loading="lazy"/></div><div className={s.copy}><p className={s.eyebrow}>{item.label}</p><h2>{item.title}</h2><p>{item.text}</p><a className={s.primary} href={item.href}>{item.cta}<ArrowUpRight/></a></div></section>)}
   <section className={s.videos} aria-labelledby="stories"><p className={s.eyebrow}>RESIDENT STORIES</p><h2 id="stories">At home with Xenit.</h2><div>{[1,2,3].map(n=><div className={s.video} key={n} role="img" aria-label={`Video testimonial placeholder ${n}`}><img src={`/home-${n}.jpg`} alt="" loading="lazy"/><span aria-hidden="true"><PlayIcon/></span></div>)}</div></section>
   <section className={s.banner}><div><p className={s.eyebrow}>LET’S WORK TOGETHER</p><h2>Start your next chapter<br/>with Xenit Realty.</h2></div><a className={s.primary} href="mailto:info@xenitrealty.com">Contact Our Team <ArrowUpRight/></a></section>
  </main>
  <footer className={s.footer} id="contact"><div><img src="/xenit-logo-white.svg" alt="Xenit Realty"/><p>Property. People. Possibility.</p></div><div><h3>Explore</h3><a href="#investors">Property Management</a><a href="#residents">Residents</a><a href="#agents">Agents</a><a href="#vendors">Vendors</a></div><div><h3>Let’s connect</h3><a href="mailto:info@xenitrealty.com">info@xenitrealty.com</a><Link className={s.footerPortal} href="/portal">Enter Tenant Portal <ArrowUpRight/></Link><Link href="/admin/login">Admin Login</Link></div><div className={s.bottom}>© {new Date().getFullYear()} Xenit Realty. All rights reserved.</div></footer>
 </div>;
}
