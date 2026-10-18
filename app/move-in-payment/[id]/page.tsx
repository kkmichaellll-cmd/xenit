import {MoveInPayment} from '../../workspace-ui';

export default async function Page({params}:{params:Promise<{id:string}>}){
 return <MoveInPayment id={(await params).id}/>;
}
