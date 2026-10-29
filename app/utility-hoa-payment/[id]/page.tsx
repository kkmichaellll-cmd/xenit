import {UtilityPaymentPage} from '../../utility-hoa';
export default async function Page({params}:{params:Promise<{id:string}>}){return <UtilityPaymentPage id={(await params).id}/>}
