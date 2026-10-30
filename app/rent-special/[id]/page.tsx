import SpecialPage from '../../rent-special';
export default async function Page({params}:{params:Promise<{id:string}>}){return <SpecialPage id={(await params).id}/>}
