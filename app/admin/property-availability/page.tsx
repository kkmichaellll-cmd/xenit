import AdminGate from '../admin-gate';
import AvailabilityAdmin from './availability-admin';
export const metadata={title:'Manage Property Availability | Xenit Realty'};
export default function Page(){return <AdminGate><AvailabilityAdmin/></AdminGate>}
