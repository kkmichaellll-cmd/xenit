 'use client';
import {UtilityStatus,UtilityAdmin} from './utility-hoa';
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
 if(!card?.print_requested_at)return <section><h3>Access-card review</h3><p>Awaiting the tenant’s print request.</p></section>;
 return <UtilityAdmin id={card.application_id} onSaved={onSaved}/>;
}
