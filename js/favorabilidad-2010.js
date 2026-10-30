import {IBC_688_POR_MES} from './decreto-688-50.js?v=16.33.266';
// Puntos básicos IBC consumo/ordinario, certificados SFC y cotejados en la tabla interna.
const IBC_2010=Object.freeze({'2019-12':1891,'2020-01':1877,'2020-02':1906,'2020-03':1895,'2020-04':1869,'2020-05':1819});
export function favorabilidadAutomatica(tipo,fechaPago,contexto={}){
 if(String(tipo||'TASA DIAN').trim().toUpperCase()!=='TASA DIAN')return null;
 const f=String(fechaPago||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(f))return null;
 const date=new Date(f+'T00:00:00Z');
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==f)return null;
 if(f>='2020-05-22'&&f<='2020-11-30')return {tasa:Math.round(IBC_688_POR_MES[Number(f.slice(5,7))]*100)/10000,aplicacionAutomatica688:true};
 if(f<'2019-12-27'||f>'2020-05-21'||!(Number(contexto.valorPago)>0))return null;
 const fechas=contexto.fechaVencimiento?[contexto.fechaVencimiento]:(contexto.vencimientos||[]).filter(v=>Number(v.impuesto??v.saldo??0)>0).map(v=>v.fecha);
 const validas=fechas.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||'')));
 const anteriores=validas.filter(x=>x<'2019-12-27');
 if(!anteriores.length)return null;
 const porCuota=anteriores.length!==validas.length;
 const tasa=(IBC_2010[f.slice(0,7)]+200)/10000;
 return {tasa:porCuota?null:tasa,porCuota,aplicacionAutomatica2010:true,
  nota:porCuota?'LEY 2010 DE 2019 ART. 120 PAR. 2 — APLICACIÓN AUTOMÁTICA POR VENCIMIENTO: IBC + 2 puntos para obligaciones anteriores al 27/12/2019; consulte las tasas por cuota.'
   :`LEY 2010 DE 2019 ART. 120 PAR. 2 — APLICACIÓN AUTOMÁTICA: IBC ${(IBC_2010[f.slice(0,7)]/100).toFixed(2)}% + 2 puntos = ${(tasa*100).toFixed(3)}% E.A. · pago ${f}`};
}
