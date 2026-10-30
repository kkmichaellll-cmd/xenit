import {UtilityHoaSummary} from '../../workspace-ui';
export default async function Page({params}:{params:Promise<{id:string}>}){return <UtilityHoaSummary id={(await params).id}/>;}
