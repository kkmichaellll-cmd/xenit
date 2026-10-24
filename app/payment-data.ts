import type {MailingInstructionsSettings} from './mailing-instructions-copy';
export type PaymentSettings={paymentSteps?:string[];additionalInstructions?:string;mailingInstructions?:MailingInstructionsSettings;landlordName:string;mailingAddress:string;city?:string;state?:string;zipCode?:string;amount:string;purpose:string;noPostalMoneyOrders:boolean};
export const emptyPaymentSettings:PaymentSettings={landlordName:'',mailingAddress:'',city:'',state:'',zipCode:'',amount:'',purpose:'Holding fee',noPostalMoneyOrders:true};
