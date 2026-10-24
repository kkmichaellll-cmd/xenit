export const availabilityOptions = {
 rent:{title:'Rent',summary:'Lease the property under a rental agreement.',description:"You've chosen to rent this property under a standard rental agreement."},
 'rent-to-own':{title:'Rent to Own',summary:'Rent the property with an option to purchase later.',description:"You've chosen to rent this property with the option to purchase it in the future."},
 buy:{title:'Buy',summary:'Explore the property’s purchase option.',description:"You've chosen to explore purchasing this property as your own."}
} as const;
export type AvailabilityOption=keyof typeof availabilityOptions;
export const isAvailabilityOption=(value:string):value is AvailabilityOption=>Object.prototype.hasOwnProperty.call(availabilityOptions,value);
export type AvailabilityData={title:string;location:string;houseProfile:string;landlordName:string;landlordProfile:string;monthlyRent:number;securityDeposit:number;salesPrice:number;images:string[];statusNotice:string;tourIntro:string;tourDetails:string};
export type AvailabilityRecord={id:string;data:AvailabilityData;published:boolean;updated_at:string};
export const defaultAvailability:AvailabilityData={
 title:'New property',location:'',houseProfile:'',landlordName:'',landlordProfile:'',monthlyRent:1500,securityDeposit:1500,salesPrice:250000,images:['/home-1.jpg'],
 statusNotice:'This property is currently listed for sale. However, the owner has recently decided to make it available for rent as well, including a rent-to-own option.\n\nProspective residents can choose the option that best suits their needs.\n\nPlease note that existing sales advertisements may remain active on Zillow, Opendoor, and other listing platforms while the owner considers rental applications. Because the property was previously marketed for sale, you may also notice remnants of its earlier marketing when you visit, including signage that may not yet have been removed.\n\nThe owner intends to remove the sales listings once a rental agreement has been finalized.',
 tourIntro:'Interested in viewing this property? Select the button below to create your tour account.',
 tourDetails:'Once your account is created, you can choose your preferred viewing date and time and complete the required identity verification. Your tour request will then be reviewed for approval. If approved, you will receive instructions for obtaining your door access code through the OpenDoor app.'
};
export const availabilityPath=(id:string)=>'/property-availability/'+encodeURIComponent(id);
export const availabilityMoney=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:value%1?2:0}).format(value);
