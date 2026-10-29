export const DIAN_UVT_URL='https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm';
const decode=s=>String(s).replace(/&(?:aacute|eacute|iacute|oacute|uacute|ntilde|Aacute|Eacute|Iacute|Oacute|Uacute|Ntilde|nbsp|amp|lt|gt|quot);/g,x=>({'&aacute;':'á','&eacute;':'é','&iacute;':'í','&oacute;':'ó','&uacute;':'ú','&ntilde;':'ñ','&Aacute;':'Á','&Eacute;':'É','&Iacute;':'Í','&Oacute;':'Ó','&Uacute;':'Ú','&Ntilde;':'Ñ','&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"'}[x]));
const plain=s=>decode(s).replace(/<[^>]+>/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
export const minimaUVT=valor=>{if(!Number.isSafeInteger(valor)||valor<=0)throw Error('UVT inválida');return Math.floor((valor*10+500)/1000)*1000;};
export function parseUVT(html){
 const block=String(html).match(/<p\b[^>]*>\s*<a\b[^>]*name=["']1\.2\.1["'][\s\S]*?<\/p>/i)?.[0];
 if(!block)throw Error('DIAN: artículo UVT vigente no reconocido');
 const text=plain(block);
 if(!/^ARTICULO 1\.2\.1\. VALOR DE LA UNIDAD DE VALOR TRIBUTARIO/i.test(text))throw Error('DIAN: artículo distinto de UVT');
 const m=text.match(/\(\$\s*([\d.]+)\)\s*el valor de la Unidad de Valor Tributario\s*-?\s*UVT\s*que regira durante el ano\s+(\d{4})/i);
 const norma=text.match(/Resolucion\s+(\d+)\s+de\s+(\d{4})/i);
 const href=block.match(/href=["'](resolucion_dian_\d+_\d{4}\.htm(?:#\d+)?)["']/i)?.[1];
 if(!m||!norma||!href||/proyecto|derogad|suspendid/i.test(text))throw Error('DIAN: falta valor, vigencia o resolución definitiva');
 const valor_uvt=Number(m[1].replaceAll('.','')),anio=Number(m[2]);
 if(anio<2007||anio>2200||Number(norma[2])>anio||Number(norma[2])<anio-1)throw Error('DIAN: vigencia inconsistente');
 return {anio,valor_uvt,sancion_minima:minimaUVT(valor_uvt),metodo:'UVT10',aplicable_desde:`${anio}-01-01`,fuente_url:DIAN_UVT_URL,norma:`Resolución DIAN ${Number(norma[1])}/${norma[2]}; ET arts. 639 y 868`,resolucion_url:new URL(href,DIAN_UVT_URL).href,estado:'ACTIVA'};
}
const date=(y,m,d)=>new Date(Date.UTC(y,m-1,d));
const key=d=>d.toISOString().slice(0,10);
function pascua(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return date(y,Math.floor(n/31),n%31+1);}
export function festivosColombia(y){
 const set=new Set(),add=(d,move=false)=>{const x=new Date(d);if(move)x.setUTCDate(x.getUTCDate()+(8-x.getUTCDay())%7);set.add(key(x));};
 for(const [m,d]of[[1,1],[5,1],[7,20],[8,7],[12,8],[12,25]])add(date(y,m,d));
 for(const [m,d]of[[1,6],[3,19],[6,29],[8,15],[10,12],[11,1],[11,11]])add(date(y,m,d),true);
 for(const [days,move]of[[-3,false],[-2,false],[39,true],[60,true],[68,true]]){const x=pascua(y);x.setUTCDate(x.getUTCDate()+days);add(x,move);}
 return set;
}
export function diaHabil(y,m,d){const x=date(y,m,d);return ![0,6].includes(x.getUTCDay())&&!festivosColombia(y).has(key(x));}
export function primerosDiezHabiles(y,m,d){if(m!==1||!diaHabil(y,m,d))return false;let n=0;for(let i=1;i<=d;i++)if(diaHabil(y,1,i))n++;return n<=10;}
export async function actualizarUVT({now=new Date(),fetchText,repository,dryRun=false,forceUVT=false}){
 if(!repository.uvt)return {accion:'NO_CONFIGURADA'};
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now).map(x=>[x.type,x.value]));
 const y=+p.year,m=+p.month,d=+p.day,current=await repository.uvt(y);
 if(!forceUVT&&(!diaHabil(y,m,d)||!(m===12||primerosDiezHabiles(y,m,d)||!current)))return {accion:'FUERA_VENTANA',anio:y};
 const html=await fetchText(DIAN_UVT_URL),value=parseUVT(html);
 const objetivo=m===12?y+1:y;
 if(value.anio!==objetivo)return {accion:'PENDIENTE_PUBLICACION',anio:objetivo,publicado:value.anio,fuente_url:DIAN_UVT_URL};
 const existente=value.anio===y?current:await repository.uvt(value.anio);
 if(existente)return {accion:Number(existente.valor_uvt)===value.valor_uvt&&Number(existente.sancion_minima)===value.sancion_minima?'SIN_CAMBIO':'REVISION_MANUAL',anio:value.anio,publicado:value.sancion_minima,registrado:Number(existente.sancion_minima),fuente_url:DIAN_UVT_URL};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html));
 value.documento_sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(!dryRun)await repository.insertUvt(value);
 return {accion:dryRun?'POR_INSERTAR':'INSERTADA',...value};
}
