// Contrato TDJ × obligación compartido por captura, cálculo y recuperación XLSX.
export const claveTasaTDJ=(tituloId,obligacionId)=>`${tituloId}|${obligacionId}`;
// Regla exclusivamente TDJ: fechas inclusivas y hueco no elegible.
// Los pagos normales y el motor compartido DIAN NO utilizan este filtro.
export const VENTANAS_TDJ_1419=Object.freeze([
  Object.freeze({hasta:'2026-08-09'}),
  Object.freeze({desde:'2026-09-17',hasta:'2026-11-19'})
]);
export const esBeneficio1419TDJ=tipo=>/DECRETO 1419 DE 2026/.test(String(tipo||'').toUpperCase())&&/ART\\.\\s*(9|10)\\b/.test(String(tipo||'').toUpperCase());
export function fechaElegible1419TDJ(fecha){
  const f=String(fecha||'');
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(f))return false;
  const fechaUtc=new Date(f+'T00:00:00Z');
  if(Number.isNaN(fechaUtc.getTime())||fechaUtc.toISOString().slice(0,10)!==f)return false;
  return VENTANAS_TDJ_1419.some(v=>(!v.desde||f>=v.desde)&&f<=v.hasta);
}
export function tasaEfectiva1419TDJ(tipo,fecha){
  const seleccion=String(tipo||'TASA DIAN').trim().toUpperCase()||'TASA DIAN';
  return esBeneficio1419TDJ(seleccion)&&!fechaElegible1419TDJ(fecha)?'TASA DIAN':seleccion;
}
export function tipoTasaTDJ(t,o){
  return tasaEfectiva1419TDJ(t?.tasasPorObligacion?.[o.id]||o?.tipoTasa||'TASA DIAN',t?.fecha);
}
export function filasTasasTDJ(titulos,obligaciones,tasaPara){
  return titulos.flatMap(t=>obligaciones.map(o=>{
    const tipo=tipoTasaTDJ(t,o);
    return ['TASA TDJ',t.numero,t.tdj,o.numero,o.id,tipo,tasaPara(tipo,t.fecha)];
  }));
}
export function recuperarTasasTDJ(rows,titulos,obligaciones){
  for(const r of rows){
    if(r?.[0]!=='TASA TDJ')continue;
    const t=titulos.find(t=>Number(t.numero)===Number(r[1])&&String(t.tdj)===String(r[2]));
    const o=obligaciones.find(o=>Number(o.numero)===Number(r[3]));
    if(t&&o&&String(r[5]||'').trim()){
      t.tasasPorObligacion={...t.tasasPorObligacion,[o.id]:String(r[5]).trim().toUpperCase()};
    }
  }
}
