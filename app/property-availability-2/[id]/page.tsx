import {getAvailability} from '../../availability-public';
import {AvailabilityView} from '../../availability-view';
export const dynamic='force-dynamic';
export const metadata={title:'Property Availability 2 | Xenit Realty'};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AvailabilityView record={await getAvailability(id,2)}/>}
