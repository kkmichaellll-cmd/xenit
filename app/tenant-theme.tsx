'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

const tenantRoots=['/portal','/signup','/complete-profile','/forgot-password','/reset-password','/dashboard','/apply','/application','/payment','/access-card','/lease','/move-in'];

export default function TenantTheme(){
 const pathname=usePathname();
 useEffect(()=>{
  const area=pathname.startsWith('/admin')?'admin':tenantRoots.some(route=>pathname===route||pathname.startsWith(route+'/'))?'tenant':'';
  if(area)document.body.dataset.xenitArea=area;
  else delete document.body.dataset.xenitArea;
  return()=>{delete document.body.dataset.xenitArea};
 },[pathname]);
 return null;
}
