import {SpecialValidationPage} from '../../rent-special';
export default async function Page({params}:{params:Promise<{id:string}>}){return <SpecialValidationPage id={(await params).id}/>}
