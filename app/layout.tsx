import type { Metadata } from 'next';
import './globals.css';
import './sitewide-soft.css';
import SiteNavigation from './site-navigation';
export const metadata:Metadata={icons:{icon:'/xenit-mark.svg',apple:'/xenit-mark.svg'},title:'Xenit Realty | Property & Living',description:'Apartment leasing and property management that connects landlords and tenants. Create your tenant profile with Xenit Realty.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className="xenit-site"><SiteNavigation/><div className="xenit-page-content">{children}</div></body></html>}
