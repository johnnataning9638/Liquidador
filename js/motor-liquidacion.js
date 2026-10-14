import {MotorLiquidacion as MotorLiquidacionBase} from "./motor-liquidacion-base.js?v=16.33.126";

const iso=v=>String(v||"").slice(0,10);
const n=v=>Math.max(0,Number(v||0));
const esSimple4a6=datos=>{
  const v=Array.isArray(datos?.vencimientos)
    ?datos.vencimientos.filter(x=>iso(x?.fecha||x?.fechaVto)&&n(x?.impuesto??x?.valor)>0)
    :[];
  return v.length>=4&&v.length<=6;
};

const esTDJMayor1000=pago=>{
  const esTDJ=pago?.esTDJ===true || String(pago?.tdj||"").trim()!=="";
  return esTDJ && n(pago?.valor)>1000;
};

const esTDJMinimo= pago=>{
  const esTDJ=pago?.esTDJ===true || String(pago?.tdj||"").trim()!=="";
  const valor=Number(pago?.valor||0);
  return esTDJ && Number.isInteger(valor) && valor>0 && valor<=1000;
};

function redistribuirSancionSimple(r,datos){
  if(!esSimple4a6(datos)||String(datos?.tieneSancion||"").trim().toUpperCase()!=="SI")return r;
  const sancionBase=n(datos?.valorSancion);
  if(!sancionBase||!Array.isArray(r?.detalle)||!r.detalle.length)return r;

  const detalles=r.detalle;
  const totalPagos=detalles.reduce((a,d)=>a+n(d?.pago?.valor),0);
  if(!totalPagos)return r;

  // En SIMPLE 4-6 cuotas la sanción de la declaración anual participa en los
  // anticipos, aun cuando el pago sea anterior a la fecha de sanción.
  // Primero respetamos cualquier sanción que el motor base ya haya aplicado.
  const sancionActual=detalles.reduce((a,d)=>a+n(d?.aplicado?.sancion),0);
  const objetivoTotal=Math.min(sancionBase,totalPagos);
  let faltante=Math.max(0,objetivoTotal-sancionActual);
  if(faltante<=0){
    r._reglaSIMPLEExtemporanea="SANCION DISTRIBUIDA EN ANTICIPOS 4-6 CUOTAS";
    return r;
  }

  // Reparto proporcional por valor pagado, con el último pago absorbiendo
  // cualquier diferencia de redondeo. Solo se agrega la parte que todavía
  // falta; nunca se aumenta la sanción por encima de la sanción declarada.
  const pesos=detalles.map(d=>n(d?.pago?.valor));
  const pesoTotal=pesos.reduce((a,b)=>a+b,0);
  const asignaciones=detalles.map((d,i)=>{
    if(i===detalles.length-1)return 0;
    return Math.min(faltante,Math.round(faltante*pesos[i]/pesoTotal/1000)*1000);
  });
  const parcial=asignaciones.reduce((a,b)=>a+b,0);
  asignaciones[asignaciones.length-1]=Math.max(0,faltante-parcial);

  let agregado=0;
  for(let i=0;i<detalles.length&&faltante>0;i++){
    const d=detalles[i];
    const a=d.aplicado||{};
    const disponibleNoSancion=n(a.impuesto)+n(a.intereses)+n(a.excedente);
    const agregar=Math.min(asignaciones[i],faltante,disponibleNoSancion);
    if(agregar<=0)continue;

    let delta=agregar;
    const deImpuesto=Math.min(delta,n(a.impuesto));
    a.impuesto=Math.round(n(a.impuesto)-deImpuesto);delta-=deImpuesto;
    const deIntereses=Math.min(delta,n(a.intereses));
    a.intereses=Math.round(n(a.intereses)-deIntereses);delta-=deIntereses;
    const deExcedente=Math.min(delta,n(a.excedente));
    a.excedente=Math.round(n(a.excedente)-deExcedente);delta-=deExcedente;

    const movido=agregar-delta;
    a.sancion=Math.round(n(a.sancion)+movido);
    a.total=Math.round(n(a.impuesto)+n(a.intereses)+n(a.sancion));
    d.aplicado=a;
    agregado+=movido;
    faltante=Math.max(0,faltante-movido);
  }

  // Segundo pase: por seguridad, si el redondeo dejó faltante, utiliza la
  // capacidad disponible de cualquier anticipo sin superar su pago nominal.
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
      agregado+=movido;
      faltante=Math.max(0,faltante-movido);
    }
  }

  const totalSancionAplicada=detalles.reduce((a,d)=>a+n(d?.aplicado?.sancion),0);
  let saldo= Math.max(0,sancionBase-totalSancionAplicada);
  for(const d of detalles){
    if(d.saldo){
      d.saldo.sancion=saldo;
      d.saldo.total=n(d.saldo.impuesto)+n(d.saldo.intereses)+saldo;
    }
    saldo=Math.max(0,saldo-n(d?.aplicado?.sancion));
  }
  // Recalcular saldos en orden correcto después de la distribución.
  saldo=sancionBase;
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
    const pagosProporcionalizables=[...(datos?.pagos||[])]
      .map((p,i)=>({...p,fecha:iso(p?.fecha),valor:Number(p?.valor||0),ordenOriginal:i}))
      .filter(p=>p.fecha&&p.valor>0&&!(iso(datos?.fechaCorte)&&p.fecha>iso(datos?.fechaCorte))&&!esTDJMinimo(p))
      .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.ordenOriginal-b.ordenOriginal);

    this._tdjSancionContext={
      datos,
      pagoActual:null,
      proporcionalidadIndex:0,
      proporcionalidadPagos:pagosProporcionalizables,
      sancionSaldoInicial:n(datos?.valorSancion)
    };
    try{
      const r=super.calcular(datos);
      return redistribuirSancionSimple(r,datos);
    }finally{
      this._tdjSancionContext=null;
    }
  }

  aplicarProporcionalidad(pago,deuda){
    const ctx=this._tdjSancionContext;
    const pagosProporcionalizables=ctx?.proporcionalidadPagos||[];
    const pagoActual=pagosProporcionalizables[ctx?.proporcionalidadIndex??0]||null;
    if(ctx)ctx.proporcionalidadIndex++;

    const datos=ctx?.datos;
    const tieneSancion=String(datos?.tieneSancion||"").trim().toUpperCase()==="SI";
    const sancionDeclarada=n(datos?.valorSancion)>0;
    const esOrdinario=!esSimple4a6(datos);

    // REGLA EXCLUSIVA PARA TDJ ORDINARIO > $1.000:
    // si la obligación tiene sanción, el título participa en la misma
    // proporcionalidad del motor base, sin consultar la fecha de constitución
    // del título ni la fecha de sanción. La fecha del título NO interviene.
    // El pago actual se obtiene del mismo orden cronológico que utiliza el
    // motor base. Los TDJ <= $1.000 se excluyen del índice porque no pasan por
    // esta función y conservan su regla especial histórica.
    if(esOrdinario && esTDJMayor1000(pagoActual) && tieneSancion && sancionDeclarada){
      const sancionBaseMotor=n(deuda?.sancion);
      const sancionFallback=n(ctx?.sancionSaldoInicial);
      const sancionParaProporcion=sancionBaseMotor>0?sancionBaseMotor:sancionFallback;
      const deudaTDJ={...deuda,sancion:sancionParaProporcion};
      const resultado=super.aplicarProporcionalidad(pago,deudaTDJ);
      if(ctx){
        ctx.sancionSaldoInicial=Math.max(0,ctx.sancionSaldoInicial-n(resultado?.sancion));
      }
      return resultado;
    }

    const resultado=super.aplicarProporcionalidad(pago,deuda);
    if(ctx && tieneSancion && n(resultado?.sancion)>0){
      ctx.sancionSaldoInicial=Math.max(0,ctx.sancionSaldoInicial-n(resultado.sancion));
    }
    return resultado;
  }
}
