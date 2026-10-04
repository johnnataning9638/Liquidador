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
function finBloque(s){return /^(FIN RECUPERACION|RECUPERACION COMPLETA|TOTAL ENDOSO|OBSERVACION|OBSERVACIONES|RESUMEN FINAL)/.test(norm(s));}
function leerBloque(rows,h,ixT,ixF,ixV,ixO=-1){
  const out=[];
  for(let i=h+1;i<rows.length;i++){
    const r=rows[i]||[];
    const nonEmpty=r.filter(v=>String(v??"").trim()!=="");
    if(!nonEmpty.length)break;
    if(finBloque(nonEmpty.join(" | ")))break;
    const tdj=numeroTituloImportacionTDJ(r[ixT]);
    const fecha=fechaISOImportacion(r[ixF]);
    const valor=valorTituloImportacionTDJ(r[ixV]);
    if(tdj&&fecha&&valor>0){
      out.push({tdj,fecha,valor,observacion:ixO>=0?String(r[ixO]??"").trim().toUpperCase():""});
    }
  }
  return out;
}

/**
 * Fuente única para títulos/TDJ importados desde el Excel.
 * Prioriza la misma estructura que usa el importador de PAGOS:
 * TDJ + FECHA + VALOR. También acepta las tablas explícitas de títulos
 * y el bloque de recuperación completa generado por el propio sistema.
 * Un registro incompleto jamás se crea.
 */
export function reconstruirTitulosTDJDesdeFilas(rows){
  const fuentes=[];
  for(let h=0;h<rows.length;h++){
    const nh=(rows[h]||[]).map(norm);
    const ixT=indiceAlias(nh,ALIAS.tdj);
    const ixF=indiceAlias(nh,ALIAS.fecha);
    const ixV=indiceAlias(nh,ALIAS.valor);
    if(ixT<0||ixF<0||ixV<0)continue;
    const ixO=indiceAlias(nh,ALIAS.observacion);
    const esTablaTitulos=nh[0]==="Nº"&&["TDJ","TDJ Nº","TITULO","TITULO Nº"].includes(nh[ixT]);
    const esRecuperacion=nh[0]==="TITULOS TDJ";
    const esTablaPagos=nh.includes("RECIBO Nº")||nh.includes("RECIBO")||nh.includes("RECIBO NÚMERO");
    if(esTablaTitulos||esRecuperacion||esTablaPagos){
      fuentes.push(...leerBloque(rows,h,ixT,ixF,ixV,ixO));
    }
  }
  const mapa=new Map();
  for(const t of fuentes){
    const key=`${t.tdj}|${t.fecha}|${t.valor}`;
    if(!mapa.has(key))mapa.set(key,t);
  }
  return [...mapa.values()];
}
