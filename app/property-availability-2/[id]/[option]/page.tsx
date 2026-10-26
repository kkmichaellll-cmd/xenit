import {redirect,notFound} from 'next/navigation';
import {isAvailabilityOption,availabilityPath} from '../../../availability-data';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string;option:string}>}){const {id,option}=await params;if(!isAvailabilityOption(option))notFound();redirect(availabilityPath(id,2));}
