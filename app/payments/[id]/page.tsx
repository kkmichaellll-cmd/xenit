import {PaymentInstructions} from '../../workspace-ui';
export default async function Page({params}:{params:Promise<{id:string}>}){return <PaymentInstructions id={(await params).id}/>}
