'use client';
import {useRef,useState,type PointerEvent} from 'react';
import {api} from '../live-client';
import {downloadCompletedLease} from '../lease-download';
export default function LeaseSigning({lease,onSaved}:{lease:{id:string;completed?:boolean;landlord_name?:string};onSaved:()=>Promise<void>}){
 const canvas=useRef<HTMLCanvasElement>(null),drawing=useRef(false),[ink,setInk]=useState(false),[name,setName]=useState(lease.landlord_name||''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 function point(e:PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)*900/r.width,y:(e.clientY-r.top)*240/r.height};}
 function start(e:PointerEvent<HTMLCanvasElement>){if(busy)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;const ctx=e.currentTarget.getContext('2d')!,p=point(e);ctx.strokeStyle='#102c56';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(p.x,p.y);}
 function move(e:PointerEvent<HTMLCanvasElement>){if(!drawing.current||busy)return;const p=point(e),ctx=e.currentTarget.getContext('2d')!;ctx.lineTo(p.x,p.y);ctx.stroke();setInk(true);}
 if(lease.completed)return <div><p>Landlord signature submitted: {lease.landlord_name}</p><button className="button outline" onClick={async()=>{try{await downloadCompletedLease(lease.id)}catch(e){setMessage((e as Error).message)}}}>Download Lease</button><p role="status">{message}</p></div>;
 return <form className="live-form" onSubmit={async e=>{e.preventDefault();if(!ink||!consent)return;setBusy(true);setMessage('');try{await api('/countersign-lease',{id:lease.id,landlordName:name,signature:canvas.current!.toDataURL('image/png'),consent});await onSaved();setMessage('Completed lease saved. The tenant can now download it.')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}>
 <h4>Landlord signature</h4><p>Review the tenant-signed document above. Your signature will be added on a separate page in the completed PDF, preserving the tenant’s uploaded pages.</p>
 <label>Landlord name<input required minLength={2} maxLength={150} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
 <label>Draw landlord signature<canvas ref={canvas} width={900} height={240} aria-label="Draw landlord signature using a mouse, stylus or finger" style={{width:'100%',height:'auto',display:'block',touchAction:'none',background:'white',border:'1px solid #cbd5e1',borderRadius:16}} onPointerDown={start} onPointerMove={move} onPointerUp={()=>drawing.current=false} onPointerCancel={()=>drawing.current=false} onLostPointerCapture={()=>drawing.current=false}/></label>
 <button type="button" className="button outline" disabled={busy} onClick={()=>{canvas.current?.getContext('2d')?.clearRect(0,0,900,240);setInk(false);setConsent(false)}}>Clear signature</button>
 <label className="checkbox-row"><input type="checkbox" required checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>I have reviewed the tenant-signed lease and authorize this landlord name and signature to be added to it.</label>
 <p>You can edit the name or redraw the signature before submitting. The completed copy is locked after submission.</p>
 <button className="button dark" disabled={busy||!ink||!consent||name.trim().length<2}>{busy?'Saving signed lease…':'Submit landlord-signed lease'}</button><p role="status">{message}</p></form>;
}
