// Presentación de remanentes nominales. No modifica ni vuelve a ejecutar motores.
const positivo=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
const fecha=v=>String(v||'').slice(0,10);
const esTitulo=p=>p?.esTDJ===true||String(p?.tdj||'').trim()!=='';
const aplicado=d=>positivo(typeof d?.aplicado==='object'?d.aplicado?.total:d?.aplicado);
function mismoPago(p,q){
 if(p?.id&&q?.id)return String(p.id)===String(q.id);
 if(fecha(p?.fecha)!==fecha(q?.fecha))return false;
 if(esTitulo(p)||esTitulo(q))return esTitulo(p)&&esTitulo(q)&&String(p?.tdj||'').trim()===String(q?.tdj||'').trim();
 return String(p?.recibo||'').trim()===String(q?.recibo||'').trim();
}
export function resultadoExcedentesSoporte(datos,r){
 const detalle=r?.detalle||[],usados=new Set();
 const originales=Array.isArray(datos?.pagos)?datos.pagos:detalle.map(x=>x.pago);
 const filas=originales.filter(p=>positivo(p?.valor)>0&&(!datos?.fechaCorte||fecha(p.fecha)<=fecha(datos.fechaCorte))).map((p,i)=>{
  const indices=detalle.flatMap((d,j)=>!usados.has(j)&&mismoPago(p,d.pago)?[j]:[]);
  indices.forEach(j=>usados.add(j));
  const excedente=esTitulo(p)?Math.max(0,positivo(p.valor)-indices.reduce((a,j)=>a+aplicado(detalle[j]),0)):indices.reduce((a,j)=>a+positivo(detalle[j].excedente??detalle[j].aplicado?.excedente),0);
  return {pago:i+1,recibo:p.recibo||'',tdj:p.tdj||'',fecha:p.fecha,valor:positivo(p.valor),excedente,indices};
 });
 const porIndice=new Map();
 for(const fila of filas)fila.indices.forEach((j,k)=>porIndice.set(j,k===fila.indices.length-1?fila.excedente:0));
 return {...r,excedente:filas.reduce((a,f)=>a+f.excedente,0),excedentesSoporte:filas,detalle:detalle.map((d,j)=>porIndice.has(j)?{...d,excedente:porIndice.get(j),aplicado:{...d.aplicado,excedente:porIndice.get(j)}}:d)};
}
export function titulosSinAplicacionSoporte(resultado){
 const obligaciones=resultado?.resumenObligaciones||[];
 // No mostrar deuda cero si aún existe una obligación pendiente, ni atribuir
 // un título anterior a una cancelación que solamente ocurrió después.
 if(!obligaciones.length||obligaciones.some(x=>!Number.isFinite(Number(x.saldo))||Number(x.saldo)>0))return [];
 const ordenadas=[...obligaciones].sort((a,b)=>ultimaFecha(a).localeCompare(ultimaFecha(b)));
 const cierre=ordenadas.at(-1),fechaCierre=ultimaFecha(cierre);
 if(!fechaCierre)return [];
 return (resultado.resumenTitulos||[]).filter(x=>!(x.trazabilidad||[]).length&&positivo(x.titulo?.valor)>0&&positivo(x.excedente)===positivo(x.titulo.valor)&&fecha(x.titulo.fecha)>=fechaCierre).map(x=>{
  const t=x.titulo,cero={impuesto:0,intereses:0,sancion:0,total:0};
  return {obligacion:cierre.obligacion,detalle:{pago:{...t,esTDJ:true},deudaAntes:{...cero},aplicado:{...cero,excedente:positivo(x.excedente)},saldo:{...cero},excedente:positivo(x.excedente),interesGenerado:0,interesLiquidado:0,aplicacionesVto:[],interesesPorCuota:[],esSoporteSinAplicacion:true,notaBeneficio:'TÍTULO SIN APLICACIÓN: OBLIGACIONES CANCELADAS. VALOR ÍNTEGRO PARA ENDOSO.'}};
 });
}
function ultimaFecha(x){return (x.detalleCronologicoFinal||[]).map(d=>fecha(d.pago?.fecha)).filter(Boolean).sort().at(-1)||'';}
