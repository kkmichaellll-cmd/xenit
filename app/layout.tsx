import type { Metadata } from 'next';
import './globals.css';
import './tenant-soft.css';
import './admin-soft.css';
import TenantTheme from './tenant-theme';
export const metadata:Metadata={icons:{icon:'/xenit-mark.svg',apple:'/xenit-mark.svg'},title:'Xenit Realty | Property & Living',description:'Apartment leasing and property management that connects landlords and tenants. Create your tenant profile with Xenit Realty.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><TenantTheme/>{children}</body></html>}
