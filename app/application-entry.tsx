'use client';
import {useEffect,useState} from 'react';
import {api,auth} from './live-client';
import {safeApplicationNext,withApplicationNext} from './application-navigation';
import {RentalApplication} from './workspace-ui';

export default function ApplicationEntry({slug}:{slug:string}){
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;
  async function open(){
   try{
    const next=safeApplicationNext('/apply/'+slug+window.location.search)||safeApplicationNext('/apply/'+slug);
    const {data:{session},error}=await auth().auth.getSession();
    if(error)throw error;
    if(cancelled)return;
    if(!session){window.location.replace(withApplicationNext('/signup',next));return;}
    const state=await api('/state');
    if(cancelled)return;
    if(!state.profile){window.location.replace(withApplicationNext('/complete-profile',next));return;}
    setReady(true);
   }catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Unable to open your application. Please refresh and try again.');}
  }
  open();
  return()=>{cancelled=true;};
 },[slug]);
 if(!ready)return <main className="auth-main"><section className="auth-panel"><h1>Rental Application</h1><p role="status">{error||'Opening your application…'}</p>{error&&<button className="button dark" onClick={()=>window.location.reload()}>Try again</button>}</section></main>;
 return <RentalApplication slug={slug}/>;
}
