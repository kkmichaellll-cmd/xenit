import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={icons:{icon:'/xenit-mark.svg',apple:'/xenit-mark.svg'},title:'Xenit Realty | Property & Living',description:'Apartment leasing and property management that connects landlords and tenants. Create your tenant profile with Xenit Realty.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
