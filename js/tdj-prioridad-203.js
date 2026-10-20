// Orquestación exclusiva TDJ. Cada simulación es independiente, sin cursor global.
// No cambia las fórmulas ni la proporcionalidad del motor compartido con DIAN.
export {ordenarMovimientosCronologicos} from './prioridad-tdj.js?v=16.33.161';
const esTDJ=p=>p?.esTDJ===true||Boolean(String(p?.tdj||'').trim());
export function ajustarTDJParaPagosPosteriores(motor,datos,{soloTDJId}={}){
  const pagos=(datos.pagos||[]).map(p=>({...p}));
  const actual=pagos.find(p=>p.id===soloTDJId);
  if(!actual)return {...datos,pagos};
  const posteriores=pagos.filter(p=>!esTDJ(p)&&Number(p.valor)>0&&p.fecha>actual.fecha);
  if(!posteriores.length)return {...datos,pagos};
  const fechaCorte=pagos.map(p=>p.fecha).filter(Boolean).sort().at(-1)||datos.fechaCorte;
  const simular=valor=>motor.calcular({...datos,fechaCorte,pagos:pagos.map(p=>({...p,...(p.id===soloTDJId?{valor}:{} )}))});
  const protegidos=r=>posteriores.every(p=>{
    const d=r.detalle?.find(d=>d.pago?.id===p.id);
    return d&&Number(d.aplicado?.total||0)>=Number(p.valor)-0.5&&Number(d.excedente??d.aplicado?.excedente??0)<=0.5;
  });
  const nominal=Math.max(0,Math.trunc(Number(actual.valor)||0));
  if(protegidos(simular(nominal)))return {...datos,pagos};
  if(!protegidos(simular(0))){actual.valor=0;return {...datos,pagos};}
  let lo=0,hi=nominal,mejor=0;
  while(lo<=hi){const mid=Math.floor((lo+hi)/2);if(protegidos(simular(mid))){mejor=mid;lo=mid+1;}else hi=mid-1;}
  actual.valor=mejor>1000?Math.floor(mejor/1000)*1000:mejor;
  return {...datos,pagos};
}
