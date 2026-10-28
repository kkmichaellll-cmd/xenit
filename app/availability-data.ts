export const availabilityOptions = {
 rent:{title:'Rent',summary:'Lease the property under a rental agreement.',description:"You've chosen to rent this property under a standard rental agreement."},
 'rent-to-own':{title:'Rent to Own',summary:'Rent the property with an option to purchase later.',description:"You've chosen to rent this property with the option to purchase it in the future."},
 buy:{title:'Buy',summary:'Explore the property’s purchase option.',description:"You've chosen to explore purchasing this property as your own."}
} as const;
export type AvailabilityOption=keyof typeof availabilityOptions;
export const isAvailabilityOption=(value:string):value is AvailabilityOption=>Object.prototype.hasOwnProperty.call(availabilityOptions,value);
export type AvailabilityVersion=1|2;
export type AvailabilityData={pageVersion?:AvailabilityVersion;landlordEmail?:string;landlordPhone?:string;title:string;location:string;houseProfile:string;landlordName:string;landlordProfile:string;monthlyRent:number;monthlyRentToOwn?:number;securityDeposit:number;salesPrice:number;images:string[];videos?:string[];statusNotice:string;tourIntro:string;tourDetails:string};
export type AvailabilityRecord={id:string;data:AvailabilityData;published:boolean;updated_at:string};
export const defaultAvailability:AvailabilityData={
 pageVersion:1,landlordEmail:'',landlordPhone:'',title:'New property',location:'',houseProfile:'',landlordName:'',landlordProfile:'',monthlyRent:1500,monthlyRentToOwn:undefined,securityDeposit:1500,salesPrice:250000,images:['/home-1.jpg'],
 statusNotice:"Hello! My name is Danielle Patchen, and I’ll assist you with scheduling a tour of this property.\n\nAlthough the property is still listed for sale on Zillow, Opendoor, and other platforms, the owner has also made it available for rent or rent-to-own. The sales listings may remain active while rental applications are being considered and will be removed once a rental agreement is finalized.",
 tourIntro:'To schedule a viewing, click the “Schedule a Tour” button below to create your tour account, choose your preferred date and time, and complete identity verification.',
 tourDetails:'Once your request is approved, you’ll receive a door access code to enter the property through the OpenDoor app.'
};
export const availabilityDefaults=(version:AvailabilityVersion):AvailabilityData=>({...defaultAvailability,pageVersion:version});
export const availabilityPath=(id:string,version:AvailabilityVersion=1)=>(version===2?'/property-availability-2/':'/property-availability/')+encodeURIComponent(id);
export const availabilityMoney=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:value%1?2:0}).format(value);
