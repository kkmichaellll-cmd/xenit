import {config} from './server-store';
import {UploadError} from './document-uploads';
// Only expose known workflow errors; never return arbitrary database messages.
export async function depositReviewRpc(action:'save_deposit_settings'|'release_application_payment',body:Record<string,unknown>){
 const {url,key}=config();
 const response=await fetch(url+'/rest/v1/rpc/'+action,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 if(response.ok)return;
 const error=await response.json().catch(()=>({}));
 const known:Record<string,string>={
  'Application changed; refresh':'This application changed while you were reviewing it. Reload saved details, review them and try again.',
  'Letter download required':'The letter download has not been recorded. Ask the tenant to click Download Letter again, then refresh the status.',
  'Complete the deposit settings':'Complete the payee, mailing street address, city, state, ZIP code, payment purpose and deposit amount before saving.',
  'Save complete deposit settings before approval':'Save complete deposit details before approving Submit Deposit.',
  'Deposit details already released':'Deposit submission has already been released. Refresh status to see the current details.',
  'Approved application required':'The application must be approved before reviewing its deposit details.',
  'Not authorized':'Administrator access is required. Please sign in again.'
 };
 const missing=['PGRST202','42883','42703'].includes(error.code);
 throw new UploadError(missing?'The deposit approval database update is missing. Run the included Supabase migrations in the INSTALL.txt order, then retry.':known[error.message]||'Could not save or approve the deposit details. Retry after refreshing the status.');
}
