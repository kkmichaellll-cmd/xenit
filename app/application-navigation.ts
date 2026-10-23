'use client';
import {useEffect,useState} from 'react';

// Only return to an application on this site, never an arbitrary URL.
export function safeApplicationNext(value:string|null|undefined):string{
 return value&&/^\/apply\/[A-Za-z0-9_-]+(?:\?draft=[A-Za-z0-9_-]+)?$/.test(value)?value:'';
}
export function applicationNextFromSearch(search:string):string{
 return safeApplicationNext(new URLSearchParams(search).get('next'));
}
export function withApplicationNext(path:string,next:string):string{
 const safe=safeApplicationNext(next);
 return safe?path+'?next='+encodeURIComponent(safe):path;
}
export function useApplicationNext(){
 const [next,setNext]=useState('');
 useEffect(()=>{setNext(applicationNextFromSearch(window.location.search));},[]);
 return next;
}
