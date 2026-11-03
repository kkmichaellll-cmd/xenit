'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {FileText,House,PanelsTopLeft,Layers,Mail,LogOut,Menu,X,ShieldCheck} from 'lucide-react';
import {api,logoutSession} from '../live-client';
import './admin-dashboard.css';
const items=[
 {href:'/admin/applications',label:'Applications',icon:FileText},
 {href:'/admin',label:'Properties',icon:House},
 {href:'/admin/property-availability',label:'Property availability',icon:PanelsTopLeft},
 {href:'/admin/property-availability-2',label:'Property availability 2',icon:Layers},
 {href:'/admin/email',label:'Email',icon:Mail},
];
export default function AdminGate({children}:{children:ReactNode}){
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[leaving,setLeaving]=useState(false);
 const pathname=usePathname();
 const drawer=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{let active=true;const check=()=>api('/admin-session').then(()=>{if(active)setReady(true)}).catch(()=>{if(active){setReady(false);window.location.replace('/admin/login')}});check();const timer=setInterval(check,60000);window.addEventListener('focus',check);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',check)}},[]);
 useEffect(()=>{drawer.current?.close()},[pathname]);
 useEffect(()=>{const media=window.matchMedia('(min-width: 981px)');const close=()=>{if(media.matches)drawer.current?.close()};media.addEventListener('change',close);return()=>media.removeEventListener('change',close)},[]);
 async function logout(){if(leaving)return;setLeaving(true);setError('');try{await logoutSession();window.location.replace('/admin/login')}catch(e){setError((e as Error).message);setLeaving(false)}}
 const navigation=()=> <><div className="dashboard-nav-heading"><span className="eyebrow">ADMIN WORKSPACE</span><p>Property management</p></div><nav className="dashboard-links" aria-label="Admin navigation">{items.map(({href,label,icon:Icon})=>{const active=href==='/admin'?pathname===href:pathname===href||pathname.startsWith(href+'/');return <a key={href} href={href} aria-current={active?'page':undefined}><Icon size={19} aria-hidden="true"/><span>{label}</span></a>})}</nav><div className="dashboard-sidebar-bottom"><div className="dashboard-secure"><ShieldCheck size={18} aria-hidden="true"/><span>Administrator workspace</span></div><button type="button" className="dashboard-logout" disabled={leaving} onClick={()=>void logout()}><LogOut size={18} aria-hidden="true"/>{leaving?'Logging out…':'Logout'}</button>{error&&<p role="alert" className="dashboard-error">{error}</p>}</div></>;
 if(!ready)return <main className="auth-main"><p role="status">Checking administrator access…</p></main>;
 return <div className="dashboard-frame"><a className="dashboard-skip" href="#admin-content">Skip to workspace</a><aside className="dashboard-sidebar">{navigation()}</aside><div className="dashboard-content" id="admin-content" tabIndex={-1}><div className="dashboard-mobile-toolbar"><button type="button" ref={trigger} aria-haspopup="dialog" aria-controls="admin-navigation-drawer" onClick={()=>drawer.current?.showModal()}><Menu size={19} aria-hidden="true"/>Workspace menu</button><span>Admin</span></div>{children}</div><dialog ref={drawer} id="admin-navigation-drawer" className="dashboard-drawer" aria-label="Admin navigation" onClose={()=>trigger.current?.focus()} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close()}}}><div className="dashboard-drawer-top"><img src="/xenit-logo.svg" alt="Xenit Realty" width="155" height="35"/><button type="button" aria-label="Close workspace menu" onClick={()=>drawer.current?.close()}><X size={20}/></button></div>{navigation()}</dialog></div>;
}
