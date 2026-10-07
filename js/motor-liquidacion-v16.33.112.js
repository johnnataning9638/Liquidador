import {MotorLiquidacion as MotorLiquidacionBase} from "./motor-liquidacion-base.js?v=16.33.121";

const iso=v=>String(v||"").slice(0,10);
const n=v=>Math.max(0,Number(v||0));
const esSimple4a6=datos=>{
  const v=Array.isArray(datos?.vencimientos)
    ?datos.vencimientos.filter(x=>iso(x?.fecha||x?.fechaVto)&&n(x?.impuesto??x?.valor)>0)
    :[];
  return v.length>=4&&v.length<=6;
};

function redistribuirSancionSimple(r,datos){
  if(!esSimple4a6(datos)||String(datos?.tieneSancion||"").trim().toUpperCase()!=="SI")return r;
  const sancionBase=n(datos?.valorSancion);
  if(!sancionBase||!Array.isArray(r?.detalle)||!r.detalle.length)return r;

  const detalles=r.detalle;
  const totalPagos=detalles.reduce((a,d)=>a+n(d?.pago?.valor),0);
  if(!totalPagos)return r;
  const sancionActual=detalles.reduce((a,d)=>a+n(d?.aplicado?.sancion),0);
  const objetivoTotal=Math.min(sancionBase,totalPagos);
  let faltante=Math.max(0,objetivoTotal-sancionActual);
  if(faltante<=0){
    r._reglaSIMPLEExtemporanea="SANCION DISTRIBUIDA EN ANTICIPOS 4-6 CUOTAS";
    return r;
  }

  const pesos=detalles.map(d=>n(d?.pago?.valor));
  const pesoTotal=pesos.reduce((a,b)=>a+b,0);
  const asignaciones=detalles.map((d,i)=>{
    if(i===detalles.length-1)return 0;
    return Math.min(faltante,Math.round(faltante*pesos[i]/pesoTotal/1000)*1000);
  });
  const parcial=asignaciones.reduce((a,b)=>a+b,0);
  asignaciones[asignaciones.length-1]=Math.max(0,faltante-parcial);

  for(let i=0;i<detalles.length&&faltante>0;i++){
    const d=detalles[i],a=d.aplicado||{};
    const disponibleNoSancion=n(a.impuesto)+n(a.intereses)+n(a.excedente);
    const agregar=Math.min(asignaciones[i],faltante,disponibleNoSancion);
    if(agregar<=0)continue;
    let delta=agregar;
    const deImpuesto=Math.min(delta,n(a.impuesto));a.impuesto=Math.round(n(a.impuesto)-deImpuesto);delta-=deImpuesto;
    const deIntereses=Math.min(delta,n(a.intereses));a.intereses=Math.round(n(a.intereses)-deIntereses);delta-=deIntereses;
    const deExcedente=Math.min(delta,n(a.excedente));a.excedente=Math.round(n(a.excedente)-deExcedente);delta-=deExcedente;
    const movido=agregar-delta;
    a.sancion=Math.round(n(a.sancion)+movido);
    a.total=Math.round(n(a.impuesto)+n(a.intereses)+n(a.sancion));
    d.aplicado=a;
    faltante=Math.max(0,faltante-movido);
  }

  if(faltante>0){
    for(const d of detalles){
      if(faltante<=0)break;
      const a=d.aplicado||{};
      const capacidad=Math.max(0,n(d?.pago?.valor)-n(a.total)+n(a.sancion));
      const disponible=n(a.impuesto)+n(a.intereses)+n(a.excedente);
      const agregar=Math.min(faltante,capacidad,disponible);
      if(agregar<=0)continue;
      let delta=agregar;
      const di=Math.min(delta,n(a.impuesto));a.impuesto=Math.round(n(a.impuesto)-di);delta-=di;
      const de=Math.min(delta,n(a.intereses));a.intereses=Math.round(n(a.intereses)-de);delta-=de;
      const dx=Math.min(delta,n(a.excedente));a.excedente=Math.round(n(a.excedente)-dx);delta-=dx;
      const movido=agregar-delta;
      a.sancion=Math.round(n(a.sancion)+movido);
      a.total=Math.round(n(a.impuesto)+n(a.intereses)+n(a.sancion));
      d.aplicado=a;
      faltante=Math.max(0,faltante-movido);
    }
  }

  const totalSancionAplicada=detalles.reduce((a,d)=>a+n(d?.aplicado?.sancion),0);
  let saldo=sancionBase;
  for(const d of detalles){
    saldo=Math.max(0,saldo-n(d?.aplicado?.sancion));
    if(d.saldo){
      d.saldo.sancion=saldo;
      d.saldo.total=n(d.saldo.impuesto)+n(d.saldo.intereses)+saldo;
    }
  }
  r.sancion=saldo;
  r.total=n(r.impuesto)+n(r.intereses)+saldo;
  r._sancionSIMPLEAplicada=totalSancionAplicada;
  r._reglaSIMPLEExtemporanea="SANCION DISTRIBUIDA EN ANTICIPOS 4-6 CUOTAS";
  return r;
}

export class MotorLiquidacion extends MotorLiquidacionBase{
  calcular(datos){
    const r=super.calcular(datos);
    return redistribuirSancionSimple(r,datos);
  }
}
