'use client';
import {defaultMailingCopy,type MailingInstructionsSettings} from '../mailing-instructions-copy';
export default function MailingInstructionsEditor({value,onChange}:{value?:MailingInstructionsSettings;onChange:(value:MailingInstructionsSettings)=>void}){
 return <fieldset><legend>Mailing receipt page instructions</legend><p className="editor-hint">Edit the deposit and move-in mailing receipt pages separately. Saved instructions update for all applicants at this property, including existing applications. The mailing address and upload limits are managed separately.</p>
 {(['deposit','moveIn'] as const).map(stage=>{const copy={...defaultMailingCopy,...value?.[stage]};return <section key={stage} style={{marginTop:24}}><h3>{stage==='deposit'?'Deposit mailing receipt':'Move-in mailing receipt'}</h3><div className="editor-fields">
 {([['title','Page heading',100],['intro','Introduction shown below the greeting',2000],['instructions','Mailing instructions above the address',4000],['uploadTitle','Upload section heading',100],['buttonLabel','Submit button label',80]] as const).map(([key,label,max])=><label className="wide" key={key}>{label}{key==='intro'||key==='instructions'?<textarea required rows={4} maxLength={max} value={copy[key]} onChange={e=>onChange({...value,[stage]:{...copy,[key]:e.target.value}})}/>:<input required maxLength={max} value={copy[key]} onChange={e=>onChange({...value,[stage]:{...copy,[key]:e.target.value}})}/>}</label>)}
 </div><button className="button outline" type="button" onClick={()=>onChange({...value,[stage]:{...defaultMailingCopy}})}>Restore default instructions</button></section>})}
 </fieldset>;
}
