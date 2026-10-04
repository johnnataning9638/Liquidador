import {numExcel,fechaExcel,norm} from "./importador-excel.js?v=16.33.107";

function fechaISOImportacion(v){
  const s=fechaExcel(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:"";
}
function truncarValorImportacion(v){
  const n=Number(v);
  return Number.isFinite(n)?Math.trunc(n):0;
}
function numeroTituloImportacionTDJ(v){
  let s=String(v??"").trim().replace(/^TDJ\s*(?:N[°º]?|NO\.?|NUM(?:ERO)?\.?)?\s*[:#-]?/i,"").trim();
  if(!s)return "";
  const sci=s.match(/^[+-]?\d+(?:[\.,]\d+)?[eE][+-]?\d+$/);
  if(sci){const n=Number(s.replace(",","."));if(Number.isFinite(n))s=String(Math.trunc(n));}
  return s.replace(/\D/g,"");
}
function valorTituloImportacionTDJ(v){return truncarValorImportacion(numExcel(v));}
const ALIAS={
  tdj:["TDJ","TDJ Nº","TDJ N°","NUMERO TDJ","Nº TDJ","N° TDJ","TITULO","TITULO Nº","TITULO N°","NUMERO TITULO"],
  fecha:["FECHA","FECHA TDJ","FECHA TITULO","FECHA DEL TITULO","FECHA PAGO","FECHA PAGO / CORTE","FECHA DE PAGO","FECHA DE PAGO / CORTE"],
  valor:["VALOR","VALOR TDJ","VALOR TITULO","VALOR ORIGINAL","VALOR DEL TITULO","VALOR PAGO","VALOR PAGADO","VALOR DEL PAGO"],
  observacion:["OBSERVACION","OBSERVACIONES"]
};
function indiceAlias(headers,aliases){return headers.findIndex(h=>aliases.includes(h));}
function registroCompleto(r,ixT,ixF,ixV,ixO=-1){
  const tdj=numeroTituloImportacionTDJ(r[ixT]);
  const fecha=fechaISOImportacion(r[ixF]);
  const valor=valorTituloImportacionTDJ(r[ixV]);
  if(!tdj||!fecha||valor<=0)return null;
  return {tdj,fecha,valor,observacion:ixO>=0?String(r[ixO]??"").trim().toUpperCase():""};
}
function esFilaVacia(r){return !(r||[]).some(v=>String(v??"").trim()!=="");}
function esFinBloque(r){
  const s=norm((r||[]).filter(v=>String(v??"").trim()!=="").join(" | "));
  return /^(FIN RECUPERACION|RECUPERACION COMPLETA|TOTAL ENDOSO|OBSERVACION|OBSERVACIONES|RESUMEN FINAL)/.test(s);
}
function leerDesdeCabecera(rows,h,ixT,ixF,ixV,ixO=-1){
  const out=[];
  for(let i=h+1;i<rows.length;i++){
    const r=rows[i]||[];
    if(esFilaVacia(r)||esFinBloque(r))break;
    const t=registroCompleto(r,ixT,ixF,ixV,ixO);
    if(t)out.push(t);
  }
  return out;
}

/**
 * Reconstruye títulos TDJ de forma determinista.
 * 1) Prioridad absoluta: tabla TÍTULOS / TDJ con columnas Nº, TDJ, FECHA, VALOR.
 * 2) Bloque TÍTULOS TDJ de recuperación.
 * 3) Tabla PAGOS, únicamente como respaldo.
 * Nunca crea un título parcial.
 */
export function reconstruirTitulosTDJDesdeFilas(rows){
  // FUENTE CANÓNICA: en los Excel generados por el liquidador esta tabla es
  // inequívoca y contiene todos los títulos. Se devuelve inmediatamente para
  // evitar que otra sección del mismo Excel altere o complete parcialmente el
  // primer registro.
  for(let h=0;h<rows.length;h++){
    const nh=(rows[h]||[]).map(norm);
    const ixN=nh.findIndex(x=>x==="Nº"||x==="NO"||x==="N");
    const ixT=nh.findIndex(x=>["TDJ","TDJ Nº","TDJ N°","TITULO","TITULO Nº","TITULO N°"].includes(x));
    const ixF=nh.findIndex(x=>["FECHA","FECHA TDJ","FECHA TITULO","FECHA DEL TITULO"].includes(x));
    const ixV=nh.findIndex(x=>["VALOR","VALOR TDJ","VALOR TITULO","VALOR ORIGINAL","VALOR DEL TITULO"].includes(x));
    if(ixN!==0||ixT<0||ixF<0||ixV<0)continue;
    const encontrados=leerDesdeCabecera(rows,h,ixT,ixF,ixV,indiceAlias(nh,ALIAS.observacion));
    if(encontrados.length)return deduplicar(encontrados);
  }

  // RESPALDO: bloque de recuperación completa TÍTULOS TDJ.
  for(let h=0;h<rows.length;h++){
    const nh=(rows[h]||[]).map(norm);
    if(nh[0]!=="TITULOS TDJ")continue;
    const ixT=nh.findIndex(x=>["TDJ","TDJ Nº","TDJ N°","TITULO","TITULO Nº","TITULO N°"].includes(x));
    const ixF=nh.findIndex(x=>["FECHA","FECHA TDJ","FECHA TITULO","FECHA DEL TITULO"].includes(x));
    const ixV=nh.findIndex(x=>["VALOR","VALOR TDJ","VALOR TITULO","VALOR ORIGINAL","VALOR DEL TITULO"].includes(x));
    if(ixT>=0&&ixF>=0&&ixV>=0){
      const encontrados=leerDesdeCabecera(rows,h,ixT,ixF,ixV,indiceAlias(nh,ALIAS.observacion));
      if(encontrados.length)return deduplicar(encontrados);
    }
  }

  // RESPALDO FINAL: tabla de pagos con TDJ + FECHA + VALOR.
  for(let h=0;h<rows.length;h++){
    const nh=(rows[h]||[]).map(norm);
    const esPagos=nh.includes("RECIBO Nº")||nh.includes("RECIBO")||nh.includes("RECIBO NÚMERO");
    if(!esPagos)continue;
    const ixT=indiceAlias(nh,ALIAS.tdj),ixF=indiceAlias(nh,ALIAS.fecha),ixV=indiceAlias(nh,ALIAS.valor);
    if(ixT<0||ixF<0||ixV<0)continue;
    const encontrados=leerDesdeCabecera(rows,h,ixT,ixF,ixV,indiceAlias(nh,ALIAS.observacion));
    if(encontrados.length)return deduplicar(encontrados);
  }
  return [];
}

function deduplicar(items){
  const mapa=new Map();
  for(const t of items){
    const key=`${t.tdj}|${t.fecha}|${t.valor}`;
    if(!mapa.has(key))mapa.set(key,t);
  }
  return [...mapa.values()];
}
