type CardDetails={name:string;code:string;photo:string;propertyPhoto?:string;sample?:boolean;loadPropertyPhoto?:(url:string)=>Promise<Blob>};

async function decode(blob:Blob,label:string):Promise<HTMLImageElement>{
 const url=URL.createObjectURL(blob);
 try{return await new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>image.naturalWidth&&image.naturalHeight?resolve(image):reject(Error(label+' is empty.'));
  image.onerror=()=>reject(Error(label+' could not be decoded. Please use a JPG or PNG image.'));
  image.src=url;
 });}finally{URL.revokeObjectURL(url);}
}
async function load(url:string,label:string,fallback?:(url:string)=>Promise<Blob>){
 try{
  const response=await fetch(url,{mode:'cors',credentials:'omit',cache:'no-store'});
  if(!response.ok)throw Error('Image request failed');
  return await decode(await response.blob(),label);
 }catch{
  if(fallback)return decode(await fallback(url),label);
  throw Error(label+' could not be loaded. Please refresh the page and try again.');
 }
}
function cover(ctx:CanvasRenderingContext2D,image:HTMLImageElement,x:number,y:number,w:number,h:number){
 const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
 const sw=w/scale,sh=h/scale;
 ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,x,y,w,h);
}
function polygon(ctx:CanvasRenderingContext2D,points:number[][]){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}

export async function createAccessCardJpg(card:CardDetails):Promise<Blob>{
 // Decode each required image before drawing. Never export a silently incomplete card.
 const [portrait,residence,logo]=await Promise.all([
  load(card.photo,'Your tenant photo'),
  card.propertyPhoto?load(card.propertyPhoto,'The property photo',card.loadPropertyPhoto):Promise.resolve(null),
  load('/xenit-logo-white.svg','The Xenit logo'),
 ]);
 const canvas=document.createElement('canvas');canvas.width=1700;canvas.height=1000;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image downloads are unavailable in this browser.');
 const gradient=ctx.createLinearGradient(0,0,1700,1000);gradient.addColorStop(0,'#082455');gradient.addColorStop(1,'#1766dc');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,1700,1000);
 polygon(ctx,[[0,1000],[730,270],[1250,1000]]);ctx.fillStyle='rgba(62,140,255,0.16)';ctx.fill();
 const logoScale=Math.min(530/logo.naturalWidth,146/logo.naturalHeight);
 const lw=logo.naturalWidth*logoScale,lh=logo.naturalHeight*logoScale;
 ctx.drawImage(logo,85+(530-lw)/2,80+(146-lh)/2,lw,lh);
 const text=(value:string,x:number,y:number,size:number,color:string,bold=false,align:CanvasTextAlign='left',maxWidth?:number)=>{
  ctx.font=(bold?'700 ':'400 ')+size+'px Arial, sans-serif';ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y,maxWidth);
 }
 text('TENANT ACCESS CARD',85,275,28,'#bed8ff',true);
 text('CURRENT STATUS',1600,110,24,'#bed8ff',false,'right');text('Renting',1600,165,46,'white',true,'right');
 polygon(ctx,[[1250,300],[1700,300],[1700,1000],[890,1000]]);ctx.fillStyle='#10366a';ctx.fill();
 if(residence){ctx.save();ctx.clip();cover(ctx,residence,890,300,810,700);ctx.restore();}
 else text('YOUR RESIDENCE',1440,600,24,'#bed8ff',false,'center');
 ctx.beginPath();ctx.arc(255,560,168,0,Math.PI*2);ctx.fillStyle='#8ebfff';ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(255,560,160,0,Math.PI*2);ctx.clip();ctx.fillStyle='#eaf2ff';ctx.fill();cover(ctx,portrait,95,400,320,320);ctx.restore();
 text(card.name,85,825,card.name.length>28?32:card.name.length>20?40:48,'white',true,'left',760);
 text(card.code,85,880,27,'#c9ddff',false,'left',760);
 ctx.fillStyle='rgba(8,36,85,0.85)';ctx.fillRect(1040,910,660,90);
 text(card.sample?'SAMPLE — NOT VALID FOR ACCESS':'FOR APPROVED TENANTS ONLY',1600,960,21,'white',false,'right',610);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Unable to save JPG. Please try again.')),'image/jpeg',0.95));
}
