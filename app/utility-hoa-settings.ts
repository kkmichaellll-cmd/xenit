import {z} from 'zod';
import {defaultMailingCopy} from './mailing-instructions-copy';
const fee=z.number().finite().min(0).max(10000000).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001);
const text=(max:number)=>z.string().trim().min(1).max(max);
const mailingCopy=z.object({instructions:text(4000)}).transform(value=>({...defaultMailingCopy,instructions:value.instructions,buttonLabel:'Validate money order'}));
export const utilitySettingsSchema=z.object({
 hoa:fee,electric:fee,internet:fee,lastRent:fee,
 landlordName:text(150),mailingAddress:text(500),city:text(100),state:text(100),zipCode:z.string().trim().regex(/^\d{5}(-\d{4})?$/),purpose:text(100),
 paymentSteps:z.array(text(4000)).length(4),additionalInstructions:z.string().trim().max(4000).default(''),mailingValidation:mailingCopy,noPostalMoneyOrders:z.boolean()
}).strict();

export function utilityReady(charges:unknown,settings:unknown){
 const amounts=z.object({hoa:fee,electric:fee,internet:fee,lastRent:fee}).safeParse(charges);
 return amounts.success&&utilitySettingsSchema.safeParse({...settings as object,...amounts.data}).success;
}
export function fixedUtilityCopy(value?:{instructions?:string}|null){return {...defaultMailingCopy,instructions:value?.instructions||defaultMailingCopy.instructions,buttonLabel:'Validate money order'};}
