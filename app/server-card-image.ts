// Server-only: fetch stored property images without exposing a general URL proxy.
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {request} from 'node:https';

export function publicImageAddress(address:string){
 if(isIP(address)===4){
  const [a,b,c]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
 }
 // Public IPv6 global unicast only; exclude transition and documentation ranges.
 return isIP(address)===6&&/^[23]/i.test(address)&&!/^200[12]:/i.test(address)&&!/^3fff:/i.test(address);
}
export async function fetchCardPropertyImage(source:string,redirects=0):Promise<{bytes:Buffer;type:string}>{
 const url=new URL(source);
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw Error('Unsupported image URL');
 const hostname=url.hostname.replace(/^\[|\]$/g,'');
 const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await lookup(hostname,{all:true});
 if(!addresses.length||addresses.some(item=>!publicImageAddress(item.address)))throw Error('Unsupported image host');
 const selected=addresses[0];
 // Pin the resolved public address so DNS changes cannot redirect to private services.
 return new Promise((resolve,reject)=>{
  const req=request(url,{family:selected.family,lookup:(_host,_options,done)=>done(null,selected.address,selected.family),headers:{Accept:'image/jpeg,image/png,image/webp,image/avif,image/gif', 'User-Agent':'Xenit-Access-Card/1.0'}},response=>{
   const status=response.statusCode||0;
   if(status>=300&&status<400&&response.headers.location){
    response.resume();
    if(redirects>=3){reject(Error('Too many image redirects'));return;}
    fetchCardPropertyImage(new URL(response.headers.location,url).href,redirects+1).then(resolve,reject);return;
   }
   const type=String(response.headers['content-type']||'').split(';')[0].trim().toLowerCase();
   if(status!==200||!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(type)){response.resume();reject(Error('Property image is unavailable'));return;}
   let size=0;const chunks:Buffer[]=[];
   response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>20*1024*1024){req.destroy(Error('Property image is too large'));return;}chunks.push(chunk);});
   response.on('end',()=>resolve({bytes:Buffer.concat(chunks),type}));
   response.on('error',reject);
  });
  const timer=setTimeout(()=>req.destroy(Error('Property image timed out')),15000);
  req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
 });
}
