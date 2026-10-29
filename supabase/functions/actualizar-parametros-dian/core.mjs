import {actualizarUVT} from './uvt.mjs';
// Actualizador 16.33.263. Solo obtiene parámetros publicados; no calcula liquidaciones.
export const SFC_URL='https://www.superfinanciera.gov.co/personas/';
export const DANE_URL='https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc/ipc-informacion-tecnica';
const strip=s=>String(s).replace(/<!--[\s\S]*?-->/g,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
const plain=s=>strip(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const percent=s=>{const n=Number(String(s).trim().replace(',','.'));if(!Number.isFinite(n)||n<0||n>100)throw Error('Porcentaje fuera de rango');return n;};
const iso=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
export function fechaColombia(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now).map(x=>[x.type,x.value]));
 return {anio:Number(p.year),mes:Number(p.month),dia:Number(p.day)};
}
export function parseSfc(html){
 const t=plain(html),m=t.match(/Tasa de usura[.\s]*\(?\s*Consumo y ordinario\s*\)?\s*\((\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})\)\s*(\d{1,3}(?:[.,]\d{1,3})?)\s*%/i);
 if(!m)throw Error('SFC: no se reconoció consumo y ordinario con vigencia mensual');
 const [d1,mo1,y1,d2,mo2,y2]=m.slice(1,7).map(Number);
 if(d1!==1||mo1<1||mo1>12||mo1!==mo2||y1!==y2||d2!==new Date(Date.UTC(y1,mo1,0)).getUTCDate())throw Error('SFC: vigencia mensual incompleta');
 const usura=percent(m[7]);if(usura<=2)throw Error('SFC: usura inválida para obtener TIM');
 return {desde:iso(y1,mo1,d1),hasta:iso(y2,mo2,d2),tasa:Number(((usura-2)/100).toFixed(8)),usura,fuente_url:SFC_URL};
}
export function parseDaneAnnual(html,year){
 const t=plain(html);
 if(!/diciembre/i.test(t)||!/variacion anual/i.test(t)||!/variacion mensual/i.test(t))throw Error('DANE: se exige el cuadro de diciembre, anual y mensual separados');
 const rows=[...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>[...x[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>strip(c[1])));
 const years=rows.find(r=>r.length===4&&r.every(v=>/^\d{4}$/.test(v)));
 const total=rows.find(r=>/^IPC total$/i.test(r[0]||''));
 if(!years||!total||total.length!==5)throw Error('DANE: estructura anual no reconocida');
 const i=years.slice(0,2).findIndex(x=>Number(x)===year);
 if(i<0||Number(years[i+2])!==year||Number(years[0])!==year-1||Number(years[1])!==year)throw Error('DANE: el cuadro no corresponde al año esperado');
 return {anio_inflacion:year,inflacion:Number((percent(total[i+1])/100).toFixed(8)),aplicable_desde:`${year+1}-01-01`};
}
export function crearLectorHttp(fetchImpl=fetch,{attempts=3,timeoutMs=12000,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 return async url=>{
  const u=new URL(url);if(u.protocol!=='https:'||!['www.superfinanciera.gov.co','www.dane.gov.co','www.dian.gov.co','normograma.dian.gov.co'].includes(u.hostname))throw Error('Fuente no autorizada');
  let last;
  for(let i=0;i<attempts;i++){
   try{const r=await fetchImpl(url,{signal:AbortSignal.timeout(timeoutMs),headers:{'User-Agent':'Liquidador-Parametros/16.33.263','Accept':'text/html,application/xhtml+xml'}});
    if(r.url){const final=new URL(r.url);if(final.protocol!=='https:'||!['www.superfinanciera.gov.co','www.dane.gov.co','www.dian.gov.co','normograma.dian.gov.co'].includes(final.hostname))throw Error('Redirección de fuente no autorizada');}
    if(!r.ok){const e=Object.assign(Error(`${u.hostname} HTTP ${r.status}`),{status:r.status});if(r.status===404)throw e;last=e;}else return await r.text();
   }catch(e){if(e.status===404)throw e;last=e;}
   if(i+1<attempts)await sleep(300*(i+1));
  }throw last;
 };
}
async function tim({now,fetchText,repository,dryRun}){
 const f=fechaColombia(now),rate=parseSfc(await fetchText(SFC_URL));
 if(rate.desde!==iso(f.anio,f.mes,1))return {accion:'PENDIENTE_PUBLICACION',periodo:iso(f.anio,f.mes,1),publicado:rate.desde};
 const value={fecha_inicio:rate.desde,fecha_fin:rate.hasta,tasa:rate.tasa,tipo_tasa:'TASA DIAN',fuente_url:rate.fuente_url,norma:'ART. 635 E.T. — TASA DE USURA MENOS 2 PUNTOS',estado:'ACTIVA'};
 const current=await repository.tim(value);
 if(current)return {accion:Math.abs(Number(current.tasa)-value.tasa)<1e-8?'SIN_CAMBIO':'REVISION_MANUAL',publicado:value.tasa,registrado:Number(current.tasa),periodo:rate.desde,fuente_url:SFC_URL};
 if(!dryRun)await repository.insertTim(value);
 return {accion:dryRun?'POR_INSERTAR':'INSERTADA',...value};
}
async function ipc({now,fetchText,repository,dryRun}){
 const year=fechaColombia(now).anio-1;
 // Cuadro oficial de diciembre: nunca tomar la variación anual de otro mes.
 const url=`https://www.dane.gov.co/files/operaciones/IPC/dic${year}/graf-IPC-dic${year}.html`;
 let html;try{html=await fetchText(url);}catch(e){if(e.status===404)return {accion:'PENDIENTE_PUBLICACION',anio_inflacion:year,fuente_url:url};throw e;}
 const value={...parseDaneAnnual(html,year),fuente_url:url,norma:'DANE — IPC ANUAL DE DICIEMBRE',estado:'ACTIVA'};
 const current=await repository.ipc(year);
 if(current)return {accion:Math.abs(Number(current.inflacion)-value.inflacion)<1e-8?'SIN_CAMBIO':'REVISION_MANUAL',publicado:value.inflacion,registrado:Number(current.inflacion),anio_inflacion:year,fuente_url:url};
 if(!dryRun)await repository.insertIpc(value);
 return {accion:dryRun?'POR_INSERTAR':'INSERTADA',...value};
}
export async function actualizarParametros(options){
 const args={now:new Date(),dryRun:false,...options};
 const isolated=async fn=>{try{return await fn(args);}catch(e){return {accion:'ERROR',error:String(e.message||e)};}};
 const [timResult,ipcResult,uvtResult]=await Promise.all([isolated(tim),isolated(ipc),isolated(actualizarUVT)]);
 return {version:'16.33.263',dry_run:args.dryRun,tim:timResult,ipc:ipcResult,uvt:uvtResult,ok:![timResult,ipcResult,uvtResult].some(x=>['ERROR','REVISION_MANUAL'].includes(x.accion))};
}
