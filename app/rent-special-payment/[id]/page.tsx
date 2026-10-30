import {SpecialPaymentPage} from '../../rent-special';
export default async function Page({params}:{params:Promise<{id:string}>}){return <SpecialPaymentPage id={(await params).id}/>}
