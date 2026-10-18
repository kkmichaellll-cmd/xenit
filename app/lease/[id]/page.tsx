import {LeaseAgreement} from '../../workspace-ui';
export default async function Page({params}:{params:Promise<{id:string}>}){return <LeaseAgreement id={(await params).id}/>}
