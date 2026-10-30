'use client';
import {useRef,useState,type FormEvent} from 'react';
import {resolvePaymentSteps} from './payment-steps';
import {Fragment} from 'react';
import {CreditCard,Upload} from 'lucide-react';
export function PaymentCard({payee,address,code,name,currentAddress,additionalInstructions,paymentSteps,noPostalMoneyOrders=true,status,busy=false,demo=false,onSubmit}:{payee:string;address:string;code:string;name:string;currentAddress:string;additionalInstructions?:string;paymentSteps?:string[];noPostalMoneyOrders?:boolean;status?:string;busy?:boolean;demo?:boolean;onSubmit:(form:FormData)=>void|Promise<void>}){
 const [file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[dragging,setDragging]=useState(false);const input=useRef<HTMLInputElement>(null);
 function choose(selected:File|null){setError('');if(selected&&(!['image/jpeg','image/png','application/pdf'].includes(selected.type)||selected.size>20*1024*1024)){setFile(null);if(input.current)input.current.value='';setError('Choose a JPG, PNG or PDF file no larger than 20 MB.');return}setFile(selected)}
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!file&&!demo)return;const form=new FormData(e.currentTarget);if(file)form.set('file',file);onSubmit(form)}
 return <section className="live-card payment-instruction-card"><header className="payment-instruction-heading"><div><h2>Money Order or Cashier’s Check</h2><p>Follow the steps below to complete your payment.</p></div><span className="payment-method-icon"><CreditCard size={25}/></span></header>
 {demo&&<p className="security-note">PREVIEW ONLY — do not send money. These are sample details; no file is uploaded.</p>}
 <ol className="payment-numbered-steps">
 {resolvePaymentSteps(paymentSteps).map((step,index)=>index===3&&!noPostalMoneyOrders?null:<li key={index} className="preserve-lines">{step.split('{payee}').map((part,i)=><Fragment key={i}>{i>0&&<strong>{payee}</strong>}{part}</Fragment>)}</li>)}
 </ol>
 <dl className="payment-info-blocks">
 <div><dt>PAYEE</dt><dd>{payee}</dd></div>
 <div><dt>MEMO</dt><dd><strong>Enter only your application code</strong><span className="payment-code">{code}</span></dd></div>
 <div><dt>MAILING ADDRESS</dt><dd className="preserve-lines">{address}</dd></div>
 <div><dt>SENDER SECTION</dt><dd><ul><li><strong>From:</strong> Your full legal name{ name&&<span className="payment-sender-value">{name}</span>}</li><li><strong>Address:</strong> Your current residential address{currentAddress&&<span className="payment-sender-value preserve-lines">{currentAddress}</span>}</li></ul></dd></div>
 </dl>
 {additionalInstructions&&<p className="preserve-lines">{additionalInstructions}</p>}
 <div className="payment-review-note">Once the money order has been completed, upload a clear image of it through the upload section in your portal. Our Payment Services Department will review and verify the payment.</div>
 {status?<p className="live-badge" role="status">{status==='Approved'?'Payment approved':'Processing Payment — receipt submitted for review'}</p>:<form className="live-form payment-receipt-form" onSubmit={submit}>
 <label className={'payment-drop-zone'+(dragging?' dragging':'')} onDragOver={e=>{e.preventDefault();if(!busy)setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(!busy)choose(e.dataTransfer.files[0]||null)}}>
 <Upload size={36}/><span>{file?file.name:<>Click to upload receipt <span className="payment-drop-hint">or drag and drop</span></>}</span>
 <input ref={input} name="file" type="file" aria-label="Upload proof of payment" accept="image/jpeg,image/png,application/pdf" disabled={busy} onChange={e=>choose(e.target.files?.[0]||null)}/><small>PNG, JPG or PDF · maximum 20 MB</small>
 </label>{error&&<p role="alert">{error}</p>}
 <button className="button dark" disabled={busy||(!demo&&!file)}>{busy?'Submitting…':'Submit'}</button>
 </form>}
 </section>;
}
