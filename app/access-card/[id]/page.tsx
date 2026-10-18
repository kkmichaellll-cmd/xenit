import {AccessCard} from '../../workspace-ui';
export default async function Page({params}:{params:Promise<{id:string}>}){return <AccessCard id={(await params).id}/>}
