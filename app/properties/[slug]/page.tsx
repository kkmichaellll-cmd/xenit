import PropertyView from '../../property-views';
export default async function Property({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <PropertyView slug={slug}/>}
