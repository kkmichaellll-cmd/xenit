'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {api,logoutSession} from '../live-client';
export default function AdminGate({children}:{children:ReactNode}){
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;const check=()=>api('/admin-session').then(()=>{if(active)setReady(true)}).catch(()=>{if(active){setReady(false);window.location.replace('/admin/login')}});check();const timer=setInterval(check,60000);window.addEventListener('focus',check);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',check)}},[]);
 if(!ready)return <main className="auth-main"><p>Checking administrator access…</p></main>;
 return <><div className="admin-session-bar"><a href="/admin/applications">Application workspace</a><a href="/admin/property-availability">Property availability</a><a href="/admin/property-availability-2">Property availability 2</a><button onClick={async()=>{try{await logoutSession();window.location.replace('/admin/login')}catch(e){setError((e as Error).message)}}}>Logout</button><span role="status">{error}</span></div>{children}</>;
}
