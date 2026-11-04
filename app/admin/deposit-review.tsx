'use client';
import PaymentStepsEditor from './payment-steps-editor';
import {useEffect,useRef,useState} from 'react';
import {api} from '../live-client';
import type {Application} from '../application-data';
import {depositErrors,normalizeDepositSettings,type DepositSettings} from '../deposit-review-settings';

type Review={settings:DepositSettings;version:string;saved:boolean;letterDownloadedAt:string|null;paymentReleasedAt:string|null};
export default function DepositReview({application,onSaved,note}:{application:Application;note:string;onSaved:()=>Promise<void>}){
 const [settings,setSettings]=useState(()=>normalizeDepositSettings({})),[review,setReview]=useState<Review|null>(null),[version,setVersion]=useState(''),[dirty,setDirty]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loadError,setLoadError]=useState(''),[showErrors,setShowErrors]=useState(false);
 const inFlight=useRef(false);
 const released=!!(review?.paymentReleasedAt||application.paymentReleasedAt);
 const errors=depositErrors(settings);
 function accept(result:Review){setReview(result);setSettings(normalizeDepositSettings(result.settings));setVersion(result.version);setDirty(false);setLoadError('');}
 useEffect(()=>{let active=true;setLoading(true);api('/deposit-settings/'+application.id).then(result=>{if(active)accept(result)}).catch(e=>{if(active)setLoadError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[application.id]);
 function change<K extends keyof DepositSettings>(key:K,value:DepositSettings[K]){setSettings(s=>({...s,[key]:value}));setDirty(true);setMessage('');}
 async function refresh(){if(inFlight.current)return;inFlight.current=true;setBusy(true);try{const current:Review=await api('/deposit-settings/'+application.id);setReview(current);setLoadError('');if(!dirty)accept(current);setMessage(dirty?'Status refreshed. Your unsaved edits are preserved.':'Deposit settings and letter status refreshed.');await onSaved()}catch(e){setLoadError((e as Error).message)}finally{inFlight.current=false;setBusy(false)}}
 async function submit(){
  if(inFlight.current||released)return;
  setShowErrors(true);setMessage('');
  if(errors.length){setMessage('Complete the fields listed above, then try again.');return;}
  if(!review||!version)return;
  inFlight.current=true;setBusy(true);
  try{
   await api('/approve-with-deposit',{id:application.id,version,settings:normalizeDepositSettings(settings),note});
   accept(await api('/deposit-settings/'+application.id));
   await onSaved();setMessage('Application approved. Submit Deposit will unlock 10 seconds after the tenant downloads the approval letter.');
  }catch(e){setMessage((e as Error).message)}finally{inFlight.current=false;setBusy(false)}
 }
 return <section><h3>Deposit money order settings</h3><p>Review the payee, amount and mailing details for this applicant before approving the application. Blank fields are optional and hidden from the tenant.</p>
 {loading&&<p role="status">Loading deposit settings…</p>}
 {loadError&&<p role="alert">Could not load deposit settings. {loadError}</p>}
 <button type="button" className="button outline" disabled={busy||loading} onClick={refresh}>{loadError?'Retry loading':'Refresh status'}</button>
 {dirty&&<button type="button" className="button outline" disabled={busy||loading} onClick={async()=>{if(!window.confirm('Discard your unsaved edits and reload the saved details?'))return;if(inFlight.current)return;inFlight.current=true;setBusy(true);try{accept(await api('/deposit-settings/'+application.id));setShowErrors(false);setMessage('Saved details reloaded.')}catch(e){setLoadError((e as Error).message)}finally{inFlight.current=false;setBusy(false)}}}>Reload saved details</button>}
 {showErrors&&errors.length>0&&<div role="alert"><strong>Please complete these deposit details:</strong><ul>{errors.map(error=><li key={error}>{error}</li>)}</ul></div>}
 <form className="live-form" noValidate onSubmit={e=>{e.preventDefault();void submit()}}>
 <fieldset disabled={busy||released||loading||!review} style={{border:0,padding:0,margin:0,display:'grid',gap:16,minWidth:0}}>
 <label>Payee name<input maxLength={150} value={settings.landlordName} onChange={e=>change('landlordName',e.target.value)}/></label>
 <label>Payment purpose<input maxLength={100} value={settings.purpose} onChange={e=>change('purpose',e.target.value)}/></label>
 <label>Deposit amount ($)<input type="number" min="0.01" max="10000000" step="0.01" value={settings.amount} onChange={e=>change('amount',e.target.value)}/></label>
 <label>Mailing street address<textarea maxLength={500} rows={3} value={settings.mailingAddress} onChange={e=>change('mailingAddress',e.target.value)}/></label>
 <label>City<input maxLength={100} value={settings.city} onChange={e=>change('city',e.target.value)}/></label>
 <label>State<input maxLength={100} value={settings.state} onChange={e=>change('state',e.target.value)}/></label>
 <label>ZIP code<input maxLength={10} value={settings.zipCode} onChange={e=>change('zipCode',e.target.value)} placeholder="12345 or 12345-6789"/></label>
 <label>Additional instructions<textarea maxLength={4000} value={settings.additionalInstructions||''} onChange={e=>change('additionalInstructions',e.target.value)}/></label>
 <PaymentStepsEditor value={settings.paymentSteps} noPostalMoneyOrders={settings.noPostalMoneyOrders} onChange={value=>change('paymentSteps',value)}/>
 <label className="checkbox-row"><input type="checkbox" checked={settings.noPostalMoneyOrders} onChange={e=>change('noPostalMoneyOrders',e.target.checked)}/>Do not accept USPS postal money orders</label>
 </fieldset>
 {!released&&<button type="submit" className="button outline" disabled={busy||loading||!review}>{busy?'Working…':'Save money order settings & approve application'}</button>}
 </form>
 {released?<p>Deposit access is scheduled or already available. The saved details are shown above.</p>:<p>Approval saves these settings together. The tenant can then download the letter; Submit Deposit appears 10 seconds later.</p>}
 <p role="status" aria-live="polite">{message}</p>
 </section>;
}
