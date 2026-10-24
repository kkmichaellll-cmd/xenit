"use client";
import {defaultPaymentSteps} from '../payment-steps';
export default function PaymentStepsEditor({value,onChange,noPostalMoneyOrders}:{value?:string[];onChange:(steps:string[])=>void;noPostalMoneyOrders:boolean}) {
 const steps=defaultPaymentSteps.map((fallback,index)=>value?.[index]??fallback);
 return <div style={{display:'grid',gap:16,minWidth:0}}><h4>Numbered payment instructions</h4><p>Edit the four steps shown above the payee details. Use {'{payee}'} to insert the current payee name automatically. Step 4 is shown only when the USPS postal money order restriction is enabled.</p>{steps.map((step,index)=><label key={index}>Step {index+1}{index===3&&!noPostalMoneyOrders?' (currently hidden)':''}<textarea rows={index===2?7:4} maxLength={4000} required value={value?.[index]??step} onChange={e=>onChange(steps.map((text,i)=>i===index?e.target.value:text))}/></label>)}<button type="button" className="button outline" onClick={()=>onChange([...defaultPaymentSteps])}>Restore default steps</button></div>;
}
