'use client';
import {useEffect,useState} from 'react';
import {api} from '../live-client';
import type {Application} from '../application-data';

type Settings={landlordName:string;mailingAddress:string;city:string;state:string;zipCode:string;purpose:string;amount:string;noPostalMoneyOrders:boolean};
const empty:Settings={landlordName:'',mailingAddress:'',city:'',state:'',zipCode:'',purpose:'Deposit',amount:'',noPostalMoneyOrders:true};
export default function DepositReview({application,onSaved}:{application:Application;onSaved:()=>Promise<void>}){
 const [settings,setSettings]=useState<Settings>(empty),[version,setVersion]=useState(''),[saved,setSaved]=useState(false),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const released=!!application.paymentReleasedAt;
 async function load(){const result=await api('/deposit-settings/'+application.id);setSettings({...empty,...result.settings});setVersion(result.version);setSaved(result.saved);setDirty(false);}
 useEffect(()=>{let active=true;api('/deposit-settings/'+application.id).then(result=>{if(active){setSettings({...empty,...result.settings});setVersion(result.version);setSaved(result.saved);setDirty(false);}}).catch(e=>{if(active)setMessage(e.message)});return()=>{active=false}},[application.id,application.updatedAt]);
 function change<K extends keyof Settings>(key:K,value:Settings[K]){setSettings(s=>({...s,[key]:value}));setDirty(true);setMessage('');}
 const complete=!!settings.landlordName.trim()&&!!settings.mailingAddress.trim()&&!!settings.city.trim()&&!!settings.state.trim()&&/^\d{5}(-\d{4})?$/.test(settings.zipCode)&&!!settings.purpose.trim()&&/^\d{1,8}(\.\d{1,2})?$/.test(settings.amount)&&Number(settings.amount)>0&&Number(settings.amount)<=10000000;
 return <section><h3>Deposit money order settings</h3><p>Review the payee, amount and mailing details for this applicant before approving deposit submission. These details apply to this application’s deposit and its mailing receipt.</p>
 <form className="live-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{await api('/deposit-settings',{id:application.id,version,settings});await load();await onSaved();setMessage('Deposit details saved. You can approve deposit submission once the letter has been downloaded.')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}>
 <fieldset disabled={busy||released||!version} style={{border:0,padding:0,margin:0,display:'grid',gap:16,minWidth:0}}>
 <label>Payee name<input required maxLength={150} value={settings.landlordName} onChange={e=>change('landlordName',e.target.value)}/></label>
 <label>Payment purpose<input required maxLength={100} value={settings.purpose} onChange={e=>change('purpose',e.target.value)}/></label>
 <label>Deposit amount ($)<input required type="number" min="0.01" max="10000000" step="0.01" value={settings.amount} onChange={e=>change('amount',e.target.value)}/></label>
 <label>Mailing street address<textarea required maxLength={500} rows={3} value={settings.mailingAddress} onChange={e=>change('mailingAddress',e.target.value)}/></label>
 <label>City<input required maxLength={100} value={settings.city} onChange={e=>change('city',e.target.value)}/></label>
 <label>State<input required maxLength={100} value={settings.state} onChange={e=>change('state',e.target.value)}/></label>
 <label>ZIP code<input required maxLength={10} value={settings.zipCode} onChange={e=>change('zipCode',e.target.value)}/></label>
 <label className="checkbox-row"><input type="checkbox" checked={settings.noPostalMoneyOrders} onChange={e=>change('noPostalMoneyOrders',e.target.checked)}/>Do not accept USPS postal money orders</label>
 </fieldset>
 {!released&&<button className="button outline" disabled={busy||!version||!complete||saved&&!dirty}>{busy?'Saving…':'Save deposit details'}</button>}
 </form>
 {released?<p>Deposit submission is approved. The released details are shown above.</p>:<><p>{application.letterDownloadedAt?'Letter downloaded on '+new Date(application.letterDownloadedAt).toLocaleString()+'.':'Waiting for the tenant to download the approval letter.'}</p><button type="button" className="button dark" disabled={busy||!version||!saved||dirty||!complete||!application.letterDownloadedAt} onClick={async()=>{setBusy(true);setMessage('');try{await api('/release-payment',{id:application.id,version});await onSaved();setMessage('Approved. Submit Deposit is now available to the tenant.')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}>Approve & enable Submit Deposit</button>{dirty&&<p>Save your changes before approving.</p>}</>}
 <p role="status">{message}</p>
 </section>;
}
