export function referenciaTimTDJ(fecha,filas){
 const anteriores=(filas||[]).filter(r=>String(r?.hasta||'')<fecha&&Number(r?.tasas?.['TASA DIAN'])>0).sort((a,b)=>String(b.hasta).localeCompare(String(a.hasta)));
 const r=anteriores[0];
 if(!r)return null;
 return {tasa:Number(r.tasas['TASA DIAN']),periodo:String(r.hasta).slice(0,7)};
}

// Un hueco dentro del mismo mes conserva la TIM mensual usada por el motor.
// Nunca extender una tasa a otro mes que no esté parametrizado.
export function filaTimVisualTDJ(fecha,filas){
 const f=String(fecha||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(f))return null;
 const exacta=(filas||[]).find(x=>String(x?.desde||'').slice(0,10)<=f&&String(x?.hasta||'').slice(0,10)>=f);
 if(exacta)return exacta;
 return (filas||[]).filter(x=>String(x?.desde||'').slice(0,7)===f.slice(0,7)&&String(x.desde).slice(0,10)<=f)
  .sort((a,b)=>String(b.desde).localeCompare(String(a.desde)))[0]||null;
}
