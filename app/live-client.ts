'use client';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|null=null;
export function auth(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw Error('Account services are not configured. The site owner must complete the backend setup before accepting registrations or submissions.');
 return client??=createClient(url,key);
}
export async function api(path:string,body?:unknown){
 const {data:{session}}=await auth().auth.getSession();
 if(!session)throw Error('Please sign in to continue.');
 const response=await fetch('/api/workspace'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+session.access_token,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),cache:'no-store'});
 const data:any=await response.json();if(!response.ok)throw Error(data.error||'Your request could not be completed. Please try again.');return data;
}

export async function logoutSession(){
 // Release only the calling session, never another device's lock.
 await api('/admin-session/logout',{});
 const {error}=await auth().auth.signOut({scope:'local'});if(error)throw error;
}
