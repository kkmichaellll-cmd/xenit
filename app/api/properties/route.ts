import {NextResponse} from 'next/server';
import {sb} from '../../server-store';
export const dynamic='force-dynamic';
export async function GET(){try{const rows=await sb('/rest/v1/properties?order=created_at.asc');return NextResponse.json(rows.map(({data}:any)=>{const {lease:_lease,deposit:_deposit,...publicData}=data;return publicData}),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Property listings are being configured.'},{status:503})}}
