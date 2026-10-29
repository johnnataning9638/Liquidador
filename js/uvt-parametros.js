import {SUPABASE_URL,SUPABASE_ANON_KEY} from './supabase-config.js?v=16.33.161';
export function validarRegistroUVT(x){
 const anio=Number(x.anio),valor=x.valor_uvt??x.valor??null,minima=Number(x.sancion_minima??x.sancionMinima);
 if(!Number.isInteger(anio)||anio<1988||anio>2200||!Number.isSafeInteger(minima)||minima<=0)throw Error('Registro anual de sanción inválido');
 if(anio>=2007&&(!Number.isSafeInteger(Number(valor))||Number(valor)<=0||Math.floor((Number(valor)*10+500)/1000)*1000!==minima))throw Error('UVT y sanción mínima no concilian');
 return {anio,valor:valor==null?null:Number(valor),sancionMinima:minima};
}
export function combinarUVT(local,remote,fecha){
 const mapa=new Map(local.map(x=>{const r=validarRegistroUVT(x);return [r.anio,r];}));
 const vistos=new Set();
 for(const x of remote){
  if(x.estado!=='ACTIVA'||String(x.aplicable_desde)>fecha)continue;
  const r=validarRegistroUVT(x);if(vistos.has(r.anio))throw Error('Año UVT duplicado');vistos.add(r.anio);
  if(x.aplicable_desde!==`${r.anio}-01-01`)throw Error('Vigencia UVT inconsistente');
  const previo=mapa.get(r.anio);
  if(previo&&(previo.valor!==r.valor||previo.sancionMinima!==r.sancionMinima))throw Error('Discrepancia UVT histórica: '+r.anio);
  mapa.set(r.anio,r);
 }
 return [...mapa.values()].sort((a,b)=>a.anio-b.anio);
}
export async function cargarUVTConRespaldo(){
 const response=await fetch('datos/uvt.json');if(!response.ok)throw Error('No fue posible leer el histórico de sanciones');
 const local=(await response.json()).map(validarRegistroUVT);
 if(!SUPABASE_URL||!SUPABASE_ANON_KEY||SUPABASE_URL.includes('PEGAR_AQUI'))return local;
 const fecha=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const url=SUPABASE_URL+'/rest/v1/uvt_liquidador?select=anio,valor_uvt,sancion_minima,aplicable_desde,estado&estado=eq.ACTIVA&aplicable_desde=lte.'+fecha+'&order=anio.asc';
 try{
  const r=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY},signal:AbortSignal.timeout(6000),cache:'no-store'});
  if(!r.ok)throw Error('Consulta UVT HTTP '+r.status);
  const remote=await r.json();if(!Array.isArray(remote)||!remote.length)throw Error('Tabla central UVT vacía');
  const resultado=combinarUVT(local,remote,fecha);
  try{localStorage.setItem('liquidador-uvt-verificada-263',JSON.stringify(remote));}catch{}
  return resultado;
 }catch(e){
  console.warn('UVT central no disponible; se conserva el histórico verificado.',e.message);
  try{const cached=JSON.parse(localStorage.getItem('liquidador-uvt-verificada-263')||'[]');return combinarUVT(local,cached,fecha);}catch{return local;}
 }
}
export function protegerMinimaUVT(motor){
 const calcular=motor.calcular;
 motor.calcular=function(datos){
  if(String(datos?.tieneSancion).toUpperCase()==='SI'){
   const pagos=datos?.pagos||[];
   const necesita=pagos.some(p=>Number(p.valor)>0&&this.tasaEspecial(p.tipo,p.fecha)?.reduceSancion);
   if(necesita){
    const fechaS=pagos.some(p=>/ART\. 20 DECRETO 1474|ART\. 3 DECRETO 0240|DECRETO 1419/i.test(p.tipo||''));
    const year=this.anioSancionParaMinima(datos,fechaS);
    if(!this.uvtPorAnio(year))throw Error(`Sanción mínima ${year} pendiente de publicación o verificación DIAN. No se puede aplicar el beneficio.`);
   }
  }
  return calcular.call(this,datos);
 };
 return motor;
}
