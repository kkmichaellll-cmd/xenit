import AdminGate from '../admin-gate';
import AvailabilityAdmin from '../property-availability/availability-admin';
export const metadata={title:'Manage Property Availability 2 | Xenit Realty'};
export default function Page(){return <AdminGate><AvailabilityAdmin key="2" version={2}/></AdminGate>}
