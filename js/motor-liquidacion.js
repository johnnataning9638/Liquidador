import {MotorLiquidacion as MotorLiquidacionBase} from "./motor-liquidacion-base.js?v=16.33.111";

const iso=v=>String(v||"").slice(0,10);
const n=v=>Math.max(0,Number(v||0));
const simple4a6=datos=>{
  const v=Array.isArray(datos?.vencimientos)?datos.vencimientos.filter(x=>iso(x?.fecha||x?.fechaVto)&&n(x?.impuesto??x?.valor)>0):[];
  return v.length>=4&&v.length<=6;
};

export class MotorLiquidacion extends MotorLiquidacionBase{
  calcular(datos){
    const r=super.calcular(datos);
    if(!simple4a6(datos)) return r;
    const sancionBase=String(datos?.tieneSancion||"").trim().toUpperCase()==="SI"?n(datos?.valorSancion):0;
    const fechaSancion=iso(datos?.fechaSancion);
    if(!sancionBase||!fechaSancion||!Array.isArray(r.detalle)||!r.detalle.length) return r;
    const detalles=r.detalle;
    const pagos=detalles.map(x=>n(x?.pago?.valor));
    const totalPagos=pagos.reduce((a,b)=>a+b,0);
    if(!totalPagos) return r;
    const objetivo=[];
    let asignado=0;
    for(let i=0;i<detalles.length;i++){
      const valor=i===detalles.length-1?Math.max(0,sancionBase-asignado):Math.round(sancionBase*pagos[i]/totalPagos/1000)*1000;
      objetivo.push(Math.min(valor,sancionBase-asignado));
      asignado+=objetivo[i];
    }
    for(let i=0;i<detalles.length;i++){
      const d=detalles[i],a=d.aplicado||{};
      const actual=n(a.sancion),target=Math.max(actual,objetivo[i]);
      let delta=target-actual;
      if(delta<=0) continue;
      const moverImpuesto=Math.min(delta,n(a.impuesto));
      a.impuesto=Math.round(n(a.impuesto)-moverImpuesto); delta-=moverImpuesto;
      const moverIntereses=Math.min(delta,n(a.intereses));
      a.intereses=Math.round(n(a.intereses)-moverIntereses); delta-=moverIntereses;
      const moverExcedente=Math.min(delta,n(a.excedente));
      a.excedente=Math.round(n(a.excedente)-moverExcedente); delta-=moverExcedente;
      const movido=target-actual-delta;
      a.sancion=Math.round(actual+movido);
      a.total=Math.round(n(a.impuesto)+n(a.intereses)+n(a.sancion));
      d.aplicado=a;
    }
    let saldo=Math.round(sancionBase);
    for(const d of detalles){
      saldo=Math.max(0,saldo-n(d?.aplicado?.sancion));
      if(d.saldo){d.saldo.sancion=saldo;d.saldo.total=n(d.saldo.impuesto)+n(d.saldo.intereses)+saldo;}
    }
    r.sancion=saldo;
    r.total=n(r.impuesto)+n(r.intereses)+saldo;
    r._reglaSIMPLEExtemporanea="SANCION DISTRIBUIDA EN ANTICIPOS 4-6 CUOTAS";
    return r;
  }
}
