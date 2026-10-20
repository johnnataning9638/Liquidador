// Contrato TDJ × obligación compartido por captura, cálculo y recuperación XLSX.
export const claveTasaTDJ=(tituloId,obligacionId)=>`${tituloId}|${obligacionId}`;
export function tipoTasaTDJ(t,o){return String(t?.tasasPorObligacion?.[o.id]||o?.tipoTasa||'TASA DIAN').trim().toUpperCase();}
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
