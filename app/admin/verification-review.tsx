'use client';
import {useState} from 'react';
import {api} from '../live-client';
export default function VerificationReview({id}:{id:string}){
 const [record,setRecord]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <section><h3>Identity, income &amp; address verification</h3><button className="button outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{setRecord(await api('/application-verification/'+id))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>{busy?'Loading…':'View verification documents'}</button>{record&&<><p>Government ID: {record.idType||'Not provided'}</p><p>SSN last four: {record.ssnLast4||'Not provided'}</p>{record.documents.map((d:any)=><p key={d.kind}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.kind==='idFront'?'ID front':d.kind==='idBack'?'ID back':d.kind==='incomeProof'?'Proof of income':'Proof of address'} — {d.filename}</a></p>)}{!record.documents.length&&<p>No documents were submitted with this application.</p>}<small>Document links expire after one minute. Select View verification documents to refresh.</small></>}<p role="status">{error}</p></section>;
}
