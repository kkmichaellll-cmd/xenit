import {RentalApplication} from '../../workspace-ui';
export default async function Page({params}:{params:Promise<{slug:string}>}){return <RentalApplication slug={(await params).slug}/>}
