'use client';
import PaymentStepsEditor from './payment-steps-editor';
import {useEffect,useRef,useState} from 'react';
import {api} from '../live-client';
import type {Application} from '../application-data';
import {depositErrors,normalizeDepositSettings,type DepositSettings} from '../deposit-review-settings';

type Review={settings:DepositSettings;version:string;saved:boolean;letterDownloadedAt:string|null;paymentReleasedAt:string|null};
export default function DepositReview({application,onSaved}:{application:Application;onSaved:()=>Promise<void>}){
 const [settings,setSettings]=useState(()=>normalizeDepositSettings({})),[review,setReview]=useState<Review|null>(null),[version,setVersion]=useState(''),[dirty,setDirty]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loadError,setLoadError]=useState(''),[showErrors,setShowErrors]=useState(false);
 const inFlight=useRef(false);
 const released=!!(review?.paymentReleasedAt||application.paymentReleasedAt);
 const errors=depositErrors(settings);
 function accept(result:Review){setReview(result);setSettings(normalizeDepositSettings(result.settings));setVersion(result.version);setDirty(false);setLoadError('');}
 useEffect(()=>{let active=true;setLoading(true);api('/deposit-settings/'+application.id).then(result=>{if(active)accept(result)}).catch(e=>{if(active)setLoadError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[application.id]);
 function change<K extends keyof DepositSettings>(key:K,value:DepositSettings[K]){setSettings(s=>({...s,[key]:value}));setDirty(true);setMessage('');}
 async function refresh(){if(inFlight.current)return;inFlight.current=true;setBusy(true);try{const current:Review=await api('/deposit-settings/'+application.id);setReview(current);setLoadError('');if(!dirty)accept(current);setMessage(dirty?'Status refreshed. Your unsaved edits are preserved.':'Deposit settings and letter status refreshed.');await onSaved()}catch(e){setLoadError((e as Error).message)}finally{inFlight.current=false;setBusy(false)}}
 async function submit(approve:boolean){
  if(inFlight.current||released)return;
  setShowErrors(true);setMessage('');
  if(errors.length){setMessage('Complete the fields listed above, then try again.');return;}
  if(!review||!version){setMessage('Load the deposit settings using Retry loading before continuing.');return;}
  inFlight.current=true;setBusy(true);
  try{
   let current:Review=await api('/deposit-settings/'+application.id);setReview(current);
   if(current.paymentReleasedAt){accept(current);await onSaved();setMessage('Deposit submission is already approved.');return;}
   if(dirty||!current.saved){
    if(current.version!==version)throw Error('This application changed while you were editing. Use Reload saved details, review the latest settings, and try again.');
    await api('/deposit-settings',{id:application.id,version,settings:normalizeDepositSettings(settings)});
    current=await api('/deposit-settings/'+application.id);accept(current);
   }else{accept(current);}
   if(!approve){await onSaved();setMessage('Deposit details saved. Select Approve & enable Submit Deposit to continue.');return;}
   const savedErrors=depositErrors(normalizeDepositSettings(current.settings));
   if(savedErrors.length)throw Error('The saved deposit details need attention: '+savedErrors.join(' '));
   if(!current.letterDownloadedAt){await onSaved();throw Error('Deposit details are saved, but no letter download is recorded yet. Ask the tenant to click Download Letter again, then select Refresh status.');}
   await api('/release-payment',{id:application.id,version:current.version});
   setReview({...current,paymentReleasedAt:new Date().toISOString()});
   await onSaved();setMessage('Approved. Submit Deposit is now available to the tenant.');
  }catch(e){setMessage((e as Error).message)}finally{inFlight.current=false;setBusy(false)}
 }
 return <section><h3>Deposit money order settings</h3><p>Review the payee, amount and mailing details for this applicant before approving deposit submission.</p>
 {loading&&<p role="status">Loading deposit settings…</p>}
 {loadError&&<p role="alert">Could not load deposit settings. {loadError}</p>}
 <button type="button" className="button outline" disabled={busy||loading} onClick={refresh}>{loadError?'Retry loading':'Refresh status'}</button>
 {dirty&&<button type="button" className="button outline" disabled={busy||loading} onClick={async()=>{if(!window.confirm('Discard your unsaved edits and reload the saved details?'))return;if(inFlight.current)return;inFlight.current=true;setBusy(true);try{accept(await api('/deposit-settings/'+application.id));setShowErrors(false);setMessage('Saved details reloaded.')}catch(e){setLoadError((e as Error).message)}finally{inFlight.current=false;setBusy(false)}}}>Reload saved details</button>}
 {showErrors&&errors.length>0&&<div role="alert"><strong>Please complete these deposit details:</strong><ul>{errors.map(error=><li key={error}>{error}</li>)}</ul></div>}
 <form className="live-form" noValidate onSubmit={e=>{e.preventDefault();void submit(false)}}>
 <fieldset disabled={busy||released||loading||!review} style={{border:0,padding:0,margin:0,display:'grid',gap:16,minWidth:0}}>
 <label>Payee name<input required maxLength={150} value={settings.landlordName} onChange={e=>change('landlordName',e.target.value)}/></label>
 <label>Payment purpose<input required maxLength={100} value={settings.purpose} onChange={e=>change('purpose',e.target.value)}/></label>
 <label>Deposit amount ($)<input required type="number" min="0.01" max="10000000" step="0.01" value={settings.amount} onChange={e=>change('amount',e.target.value)}/></label>
 <label>Mailing street address<textarea required maxLength={500} rows={3} value={settings.mailingAddress} onChange={e=>change('mailingAddress',e.target.value)}/></label>
 <label>City<input required maxLength={100} value={settings.city} onChange={e=>change('city',e.target.value)}/></label>
 <label>State<input required maxLength={100} value={settings.state} onChange={e=>change('state',e.target.value)}/></label>
 <label>ZIP code<input required maxLength={10} value={settings.zipCode} onChange={e=>change('zipCode',e.target.value)} placeholder="12345 or 12345-6789"/></label>
 <PaymentStepsEditor value={settings.paymentSteps} noPostalMoneyOrders={settings.noPostalMoneyOrders} onChange={value=>change('paymentSteps',value)}/>
 <label className="checkbox-row"><input type="checkbox" checked={settings.noPostalMoneyOrders} onChange={e=>change('noPostalMoneyOrders',e.target.checked)}/>Do not accept USPS postal money orders</label>
 </fieldset>
 {!released&&<button type="submit" className="button outline" disabled={busy||loading||!review}>{busy?'Working…':'Save deposit details'}</button>}
 </form>
 {released?<p>Deposit submission is approved. The released details are shown above.</p>:<><p>{review?.letterDownloadedAt?'Letter download recorded on '+new Date(review.letterDownloadedAt).toLocaleString()+'.':application.letterDownloadedAt?'Letter download recorded. Approval will check the latest status.':'No letter download is currently recorded. Refresh status after the tenant downloads it.'}</p><button type="button" className="button dark" disabled={busy||loading||!review} onClick={()=>submit(true)}>Approve & enable Submit Deposit</button><p>This saves valid edits and checks the latest letter download before enabling Submit Deposit.</p></>}
 <p role="status" aria-live="polite">{message}</p>
 </section>;
}
