import {notFound} from 'next/navigation';
import {getAvailability} from '../../../availability-public';
import {AvailabilityView} from '../../../availability-view';
import {isAvailabilityOption} from '../../../availability-data';
export const dynamic='force-dynamic';
export const metadata={title:'Your Property Selection | Xenit Realty'};
export default async function Page({params}:{params:Promise<{id:string;option:string}>}){const {id,option}=await params;if(!isAvailabilityOption(option))notFound();return <AvailabilityView record={await getAvailability(id,2)} option={option}/>}
