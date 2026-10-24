import type {PaymentSettings} from './payment-data';
export type DepositSettings=PaymentSettings&{city:string;state:string;zipCode:string};
export function normalizeDepositSettings(value:Partial<PaymentSettings>):DepositSettings {
 const text=(key:keyof PaymentSettings)=>String(value[key]??'').trim();
 return {...value,landlordName:text('landlordName'),mailingAddress:text('mailingAddress'),city:text('city'),state:text('state'),zipCode:text('zipCode'),purpose:text('purpose'),amount:text('amount'),noPostalMoneyOrders:value.noPostalMoneyOrders!==false};
}
export function depositErrors(settings:DepositSettings):string[]{
 const errors:string[]=[];
 for(const [key,label,max] of [['landlordName','Payee name',150],['mailingAddress','Mailing street address',500],['city','City',100],['state','State',100],['purpose','Payment purpose',100]] as const){const value=settings[key].trim();if(!value)errors.push(label+' is required.');else if(value.length>max)errors.push(label+' is too long.');}
 if(!/^\d{5}(-\d{4})?$/.test(settings.zipCode.trim()))errors.push('ZIP code must contain 5 digits or use ZIP+4 (12345-6789).');
 if(!/^\d{1,8}(\.\d{1,2})?$/.test(settings.amount.trim())||Number(settings.amount)<=0||Number(settings.amount)>10000000)errors.push('Deposit amount must be greater than $0 and no more than $10,000,000, with at most 2 decimal places.');
 if(settings.paymentSteps&&(settings.paymentSteps.length!==4||settings.paymentSteps.some(step=>!step.trim()||step.trim().length>4000)))errors.push('Complete all four payment instructions (1–4,000 characters each).');
 return errors;
}
