export function paymentMailingAddress(settings:{mailingAddress?:string;city?:string;state?:string;zipCode?:string}){
 const locality=[settings.city,settings.state].filter(Boolean).join(', ');
 return [settings.mailingAddress,[locality,settings.zipCode].filter(Boolean).join(' ')].filter(Boolean).join('\n');
}
