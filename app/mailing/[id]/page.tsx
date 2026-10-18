import {MailingInstructions} from '../../workspace-ui';
export default async function Page({params}:{params:Promise<{id:string}>}){return <MailingInstructions id={(await params).id}/>}
