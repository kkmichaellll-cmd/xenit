'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';

export default function SiteNavigation(){
 const [open,setOpen]=useState(false);
 const pathname=usePathname();
 const logoOnly=pathname==='/dashboard'||pathname==='/dashboard/';
 const hideNavigation=pathname.startsWith('/property-availability/')||pathname.startsWith('/property-availability-2/');
 const button=useRef<HTMLButtonElement>(null);
 useEffect(()=>setOpen(false),[pathname]);
 useEffect(()=>{
  if(!open)return;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);button.current?.focus();}};
  document.addEventListener('keydown',close);
  return()=>document.removeEventListener('keydown',close);
 },[open]);
 if(hideNavigation)return null;
 return <header className="xenit-site-header">
  <Link className="xenit-site-brand" href="/" aria-label="Xenit Realty home"><img src="/xenit-logo.svg" alt="Xenit Realty" width="195" height="44"/></Link>
  {!logoOnly&&<><button className="xenit-menu-toggle" type="button" ref={button} aria-expanded={open} aria-controls="xenit-site-navigation" aria-label={open?'Close navigation menu':'Open navigation menu'} onClick={()=>setOpen(value=>!value)}>
   <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{open?<path d="m6 6 12 12M18 6 6 18"/>:<path d="M4 6h16M4 12h16M4 18h16"/>}</svg>
  </button>
  <nav id="xenit-site-navigation" className={open?'xenit-site-nav is-open':'xenit-site-nav'} aria-label="Main navigation" onClick={()=>setOpen(false)}>
   <Link href="/#investors">Property Management</Link>
   <Link href="/#residents">Residents</Link>
   <Link href="/#companies">Company</Link>
   <Link href="/#contact">Contact</Link>
   <Link className="xenit-portal-link" href="/portal">Enter Tenant Portal <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></Link>
  </nav></>}
 </header>;
}
