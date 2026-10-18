import {MoveInMailingInstructions} from '../../workspace-ui';
export default async function Page({params}:{params:Promise<{id:string}>}){return <MoveInMailingInstructions id={(await params).id}/>}
