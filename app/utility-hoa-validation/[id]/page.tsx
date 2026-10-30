import {UtilityValidationPage} from '../../utility-hoa';
export default async function Page({params}:{params:Promise<{id:string}>}){return <UtilityValidationPage id={(await params).id}/>}
