export type MailingInstructionsCopy={title:string;intro:string;instructions:string;uploadTitle:string;buttonLabel:string};
export type MailingInstructionsSettings={deposit?:MailingInstructionsCopy;moveIn?:MailingInstructionsCopy};
export const defaultMailingCopy:MailingInstructionsCopy={
 title:'Mailing Instructions',
 intro:'Your payment submission has been verified. To complete the process, please upload a copy of your mailing receipt below.',
 instructions:'Please take the sealed envelope to your nearest USPS office and provide the mailing address below to the USPS clerk for delivery.',
 uploadTitle:'Upload mailing receipt',
 buttonLabel:'Mailing order validation'
};
export function mailingCopy(value?:Partial<MailingInstructionsCopy>|null):MailingInstructionsCopy{
 return Object.fromEntries(Object.entries(defaultMailingCopy).map(([key,fallback])=>[key,typeof value?.[key as keyof MailingInstructionsCopy]==='string'&&value[key as keyof MailingInstructionsCopy]!.trim()?value[key as keyof MailingInstructionsCopy]:fallback])) as MailingInstructionsCopy;
}
