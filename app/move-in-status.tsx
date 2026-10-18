import {money} from './property-data';

export function MoveInStatus({amount,status,mailingStatus,onReceipt}:{amount:number;status?:string;mailingStatus?:string;onReceipt?:(kind:'deposit'|'rent')=>void}){
 if(status==='Approved')return <div className={mailingStatus==='Approved'?'payment-paid':'payment-waiting'}>{(['deposit','rent'] as const).map(kind=><p key={kind} style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><span>{kind==='deposit'?'Security Deposit':'First Month Rent'}: <strong>{mailingStatus==='Approved'?'Paid':'Waiting'}</strong></span>{mailingStatus==='Approved'&&onReceipt&&<button className="code-copy" style={{marginLeft:'auto',textDecoration:'underline'}} onClick={()=>onReceipt(kind)} aria-label={'Download '+(kind==='deposit'?'security deposit':'first month rent')+' receipt'}>↓ Receipt</button>}</p>)}</div>;
 return <p className="revealed-payment">First Month Rent + Security Deposit: <strong>{money(amount)}</strong></p>;
}
export function MoveInAction({status,mailingStatus,onPay,href,applicationId}:{status?:string;mailingStatus?:string;onPay?:()=>void;href?:string;applicationId?:string}){
 if(status==='Approved'){
  if(mailingStatus==='Approved')return applicationId?<a className="button dark" href={'/access-card/'+applicationId}>Print Access Card</a>:<button className="button dark" onClick={onPay}>Print Access Card</button>;
  if(mailingStatus==='Submitted')return <button className="button dark" disabled>Reviewing mailing receipt</button>;
  if(mailingStatus==='Declined')return applicationId?<a className="button dark" href={'/move-in-mailing/'+applicationId}>Mailing order validation</a>:<button className="button dark" onClick={onPay}>Mailing order validation</button>;
  return applicationId?<a className="button dark" href={'/move-in-mailing/'+applicationId}>Mailing order validation</a>:<button className="button dark" onClick={onPay}>Mailing order validation</button>;
 }
 if(status)return <button className="button dark" disabled>Processing Payment</button>;
 return href?<a className="button dark" href={href}>Pay First Month Rent + Security Deposit</a>:<button className="button dark" onClick={onPay}>Pay First Month Rent + Security Deposit</button>;
}
