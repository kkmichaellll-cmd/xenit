import {notFound} from 'next/navigation';
import {sb} from './server-store';
import type {AvailabilityRecord} from './availability-data';
export async function getAvailability(id:string):Promise<AvailabilityRecord>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const rows=await sb('/rest/v1/property_availability?id=eq.'+id+'&published=eq.true&select=id,data,published,updated_at');
 if(!rows[0])notFound();return rows[0];
}
