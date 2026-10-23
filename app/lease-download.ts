import {api} from './live-client';
export async function downloadCompletedLease(id:string){
 const {url,filename}=await api('/completed-lease/'+id);
 const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Unable to download the completed lease. Please try again.');
 const blob=await response.blob(),objectUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=objectUrl;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
}
