 'use client';
import {useState} from 'react';
import {UtilityStatus,UtilityAdmin} from './utility-hoa';
import {api} from './live-client';
export type CardReview = {
 application_id:string; photo_filename:string; created_at:string;
 print_requested_at?:string|null; print_approved_at?:string|null;
 move_in_charges?:{hoa:number;electric:number;internet:number;lastRent:number}|null;
};
const items=[['hoa','HOA move-in fee'],['electric','Electric (Xcel Energy)'],['internet','Cable + Internet'],['lastRent',"Last month’s rent"]] as const;
export function AccessCardStatus({id,card}:{id:string;card?:CardReview}) {
 return <>{card?.print_requested_at&&<p className="access-review-status" role="status">Access Card Printing Pending</p>}
 {!card?.print_requested_at&&<a className="button dark" href={'/access-card/'+id}>Print Access Card</a>}
 {card?.print_approved_at&&<UtilityStatus id={id}/>}</>;
}
export function AccessCardReview({card,onSaved}:{card?:CardReview;onSaved:()=>Promise<void>}) {
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(!card?.print_requested_at)return <section><h3>Access-card review</h3><p>Awaiting the tenant’s print request.</p></section>;
 async function save(form:HTMLFormElement,approve:boolean) {
  if(!form.reportValidity())return;
  setBusy(true);setMessage('');
  const data=new FormData(form);
  try {
   await api('/access-card-review',{applicationId:card!.application_id,action:approve?'approve':'save',charges:Object.fromEntries(items.map(([key])=>[key,Number(data.get(key))]))});
   await onSaved();setMessage(approve?'Access card approved. Move-in charges saved.':'Move-in charges saved.');
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="live-card"><h3>Access-card review</h3><p>Print requested: {new Date(card.print_requested_at).toLocaleString()}</p>
 <button type="button" className="button outline" onClick={async()=>{try{const result=await api('/access-card-photo/'+card.application_id);window.open(result.url,'_blank','noopener,noreferrer')}catch(e){setMessage((e as Error).message)}}}>View tenant photo</button>
 <h4>Move-in charges</h4><p>Save these amounts before approving. Approval reveals HOA & Utility on the tenant dashboard while access-card printing remains pending.</p>
 <form className="live-form" onSubmit={e=>{e.preventDefault();void save(e.currentTarget,false)}}>
 <fieldset disabled={busy||!!card.print_approved_at} style={{border:0,padding:0,minWidth:0}}>
 {items.map(([key,label])=><label key={key}>{label} ($)<input name={key} type="number" required min="0" max="10000000" step="0.01" defaultValue={card.move_in_charges?.[key]??''}/></label>)}
 <button className="button outline" type="submit">Save charges</button>
 <button className="button dark" type="button" onClick={e=>void save(e.currentTarget.form!,true)}>Save charges &amp; approve access card</button>
 </fieldset></form>{card.print_approved_at&&<p>Approved on {new Date(card.print_approved_at).toLocaleString()}</p>}<p role="status">{message}</p><UtilityAdmin id={card.application_id}/></section>;
}
