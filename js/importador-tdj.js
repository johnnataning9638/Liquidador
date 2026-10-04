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
function esCabeceraSeccion(r){
  const s=norm((r||[]).filter(v=>String(v??"").trim()!=="").join(" | "));
  return /^(TITULOS \/ TDJ|TITULOS TDJ|PAGOS|OBLIGACIONES|RECUPERACION COMPLETA|FIN RECUPERACION|TOTAL ENDOSO|RESUMEN FINAL)/.test(s);
}
function leerDesdeCabecera(rows,h,ixT,ixF,ixV,ixO=-1){
  const out=[];
  for(let i=h+1;i<rows.length;i++){
    const r=rows[i]||[];
    if(esCabeceraSeccion(r))break;
    const t=registroCompleto(r,ixT,ixF,ixV,ixO);
    if(t)out.push(t);
  }
  return out;
}

/**
 * Reconstruye TODOS los títulos TDJ del Excel.
 * La fuente preferente es la tabla explícita TÍTULOS / TDJ; luego se usan
 * bloques de recuperación y, finalmente, PAGOS como respaldo. Los registros
 * solo se aceptan si contienen simultáneamente TDJ + FECHA + VALOR.
 */
export function reconstruirTitulosTDJDesdeFilas(rows){
  const fuentes=[];

  // 1. TABLA EXPLÍCITA TÍTULOS / TDJ.
  for(let h=0;h<rows.length;h++){
    const nh=(rows[h]||[]).map(norm);
    const ixT=indiceAlias(nh,ALIAS.tdj);
    const ixF=indiceAlias(nh,ALIAS.fecha);
    const ixV=indiceAlias(nh,ALIAS.valor);
    const esTitulo=ixT>=0&&ixF>=0&&ixV>=0&&(
      nh.includes("Nº")||nh.includes("NO")||nh.includes("N")||
      nh[0]==="TITULOS TDJ"
    );
    if(!esTitulo)continue;
    fuentes.push(...leerDesdeCabecera(rows,h,ixT,ixF,ixV,indiceAlias(nh,ALIAS.observacion)));
  }

  // 2. BLOQUE TÍTULOS TDJ DE RECUPERACIÓN.
  for(let h=0;h<rows.length;h++){
    const nh=(rows[h]||[]).map(norm);
    if(nh[0]!=="TITULOS TDJ")continue;
    const ixT=indiceAlias(nh,ALIAS.tdj),ixF=indiceAlias(nh,ALIAS.fecha),ixV=indiceAlias(nh,ALIAS.valor);
    if(ixT>=0&&ixF>=0&&ixV>=0)fuentes.push(...leerDesdeCabecera(rows,h,ixT,ixF,ixV,indiceAlias(nh,ALIAS.observacion)));
  }

  // 3. PAGOS CON TDJ COMO RESPALDO.
  for(let h=0;h<rows.length;h++){
    const nh=(rows[h]||[]).map(norm);
    const esPagos=nh.includes("RECIBO Nº")||nh.includes("RECIBO")||nh.includes("RECIBO NÚMERO");
    if(!esPagos)continue;
    const ixT=indiceAlias(nh,ALIAS.tdj),ixF=indiceAlias(nh,ALIAS.fecha),ixV=indiceAlias(nh,ALIAS.valor);
    if(ixT>=0&&ixF>=0&&ixV>=0)fuentes.push(...leerDesdeCabecera(rows,h,ixT,ixF,ixV,indiceAlias(nh,ALIAS.observacion)));
  }

  return deduplicar(fuentes);
}

function deduplicar(items){
  const mapa=new Map();
  for(const t of items){
    const key=`${t.tdj}|${t.fecha}|${t.valor}`;
    if(!mapa.has(key))mapa.set(key,t);
  }
  return [...mapa.values()];
}
