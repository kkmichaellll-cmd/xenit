export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_FIELDS = ['idFront', 'idBack', 'incomeProof', 'addressProof'];
export const UPLOAD_PURPOSES = ['application', 'receipt', 'mailing-receipt', 'signed-lease', 'move-in-receipt', 'move-in-mailing-receipt', 'access-card', 'utility-hoa-receipt', 'utility-hoa-mailing-receipt', 'rent-special-receipt', 'rent-special-mailing-receipt'];
export function validUpload(purpose:string, field:string, type:string, size:number){
 return UPLOAD_PURPOSES.includes(purpose) && (purpose==='application'?DOCUMENT_FIELDS.includes(field):field==='file') && Number.isInteger(size) && size>=8 && size<=MAX_UPLOAD_BYTES && (['image/jpeg','image/png'].includes(type) || (type==='application/pdf' && purpose!=='access-card' && !field.startsWith('id')));
}
