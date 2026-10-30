// IBC consumo y ordinario certificado SFC; cotejado con datos/interes-bancario-corriente.json.
export const TIPO_688_50='DECRETO 688 — ART. 1 — 50% INTERÉS CORRIENTE';
export const IBC_688_POR_MES=Object.freeze({5:18.19,6:18.12,7:18.12,8:18.29,9:18.35,10:18.09,11:17.84});
export const esTipo68850=tipo=>/DECRETO\s+688\b/i.test(String(tipo||''))&&/\b50\s*%/.test(String(tipo||''));
export function tasaIBC68850(fecha){
 const f=String(fecha||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(f)||f<'2020-05-22'||f>'2020-11-30')return null;
 const date=new Date(f+'T00:00:00Z');
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==f)return null;
 const puntosBasicos=Math.round(IBC_688_POR_MES[Number(f.slice(5,7))]*100);
 return puntosBasicos/20000;
}
