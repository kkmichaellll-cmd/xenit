import ApplicationEntry from '../../application-entry';
export default async function Page({params}:{params:Promise<{slug:string}>}){return <ApplicationEntry slug={(await params).slug}/>}
