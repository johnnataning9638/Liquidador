export function referenciaTimTDJ(fecha,filas){
 const anteriores=(filas||[]).filter(r=>String(r?.hasta||'')<fecha&&Number(r?.tasas?.['TASA DIAN'])>0).sort((a,b)=>String(b.hasta).localeCompare(String(a.hasta)));
 const r=anteriores[0];
 if(!r)return null;
 return {tasa:Number(r.tasas['TASA DIAN']),periodo:String(r.hasta).slice(0,7)};
}
