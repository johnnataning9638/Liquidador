import {MotorLiquidacion as MotorLiquidacionBase} from "./motor-liquidacion-base.js?v=16.33.127";

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
  const sancionActual=detalles.reduce((a,d)=>a+n(d?.aplicado?.sancion),0);
  const objetivoTotal=Math.min(sancionBase,totalPagos);
  let faltante=Math.max(0,objetivoTotal-sancionActual);
  if(faltante<=0){r._reglaSIMPLEExtemporanea="SANCION DISTRIBUIDA EN ANTICIPOS 4-6 CUOTAS";return r;}
  const pesos=detalles.map(d=>n(d?.pago?.valor));
  const pesoTotal=pesos.reduce((a,b)=>a+b,0);
  const asignaciones=detalles.map((d,i)=>i===detalles.length-1?0:Math.min(faltante,Math.round(faltante*pesos[i]/pesoTotal/1000)*1000));
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
    const movido=agregar-delta;a.sancion=Math.round(n(a.sancion)+movido);a.total=Math.round(n(a.impuesto)+n(a.intereses)+n(a.sancion));d.aplicado=a;faltante=Math.max(0,faltante-movido);
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
      const movido=agregar-delta;a.sancion=Math.round(n(a.sancion)+movido);a.total=Math.round(n(a.impuesto)+n(a.intereses)+n(a.sancion));d.aplicado=a;faltante=Math.max(0,faltante-movido);
    }
  }
  const totalSancionAplicada=detalles.reduce((a,d)=>a+n(d?.aplicado?.sancion),0);
  let saldo=Math.max(0,sancionBase-totalSancionAplicada);
  for(const d of detalles){saldo=Math.max(0,saldo-n(d?.aplicado?.sancion));if(d.saldo){d.saldo.sancion=saldo;d.saldo.total=n(d.saldo.impuesto)+n(d.saldo.intereses)+saldo;}}
  r.sancion=saldo;r.total=n(r.impuesto)+n(r.intereses)+saldo;r._sancionSIMPLEAplicada=totalSancionAplicada;r._reglaSIMPLEExtemporanea="SANCION DISTRIBUIDA EN ANTICIPOS 4-6 CUOTAS";return r;
}
const esArt9=t=>String(t||"").toUpperCase().includes("ART. 9 DECRETO 1419");
export class MotorLiquidacion extends MotorLiquidacionBase{
  calcular(datos){
    const tieneArt9=(datos?.pagos||[]).some(p=>esArt9(p?.tipo));
    this._art9PendingByKey=null;this._art9Minima=0;
    if(tieneArt9&&String(datos?.tieneSancion||"").trim().toUpperCase()==="SI"){
      const anioMinima=this.anioSancionParaMinima(datos,true);
      this._art9Minima=Math.max(0,Number(this.sancionMinima(anioMinima)||0));
      this._art9Prepass=true;
      try{
        const pre=super.calcular(datos),mapa=new Map();
        for(const d of (pre?.detalle||[])){
          if(!esArt9(d?.pago?.tipo))continue;
          const key=`${iso(d?.pago?.fecha)}|${String(d?.pago?.tipo||"").trim().toUpperCase()}`;
          if(!mapa.has(key))mapa.set(key,Math.max(0,n(d?.deudaAntes?.sancion)));
        }
        this._art9PendingByKey=mapa;
      }finally{this._art9Prepass=false;}
    }
    const pagosProporcionalizables=[...(datos?.pagos||[])]
      .map((p,i)=>({...p,fecha:iso(p?.fecha),valor:Number(p?.valor||0),ordenOriginal:i}))
      .filter(p=>p.fecha&&p.valor>0&&!(iso(datos?.fechaCorte)&&p.fecha>iso(datos?.fechaCorte))&&!esTDJMinimo(p))
      .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.ordenOriginal-b.ordenOriginal);
    this._tdjSancionContext={datos,pagoActual:null,proporcionalidadIndex:0,proporcionalidadPagos:pagosProporcionalizables,sancionSaldoInicial:n(datos?.valorSancion)};
    try{return redistribuirSancionSimple(super.calcular(datos),datos);}
    finally{this._tdjSancionContext=null;this._art9PendingByKey=null;this._art9Minima=0;this._art9Prepass=false;}
  }
  tasaEspecial(tipo,fechaPago){
    const especial=super.tasaEspecial(tipo,fechaPago);
    if(!esArt9(tipo))return especial;
    if(this._art9Prepass){
      return {...especial,reduceSancion:false,factorSancion:1,
        nota:"ART. 9 D1419: prepasada de saldo; no aplicar reducción para determinar el saldo real pendiente."};
    }
    const key=`${iso(fechaPago)}|${String(tipo||"").trim().toUpperCase()}`;
    const pendiente=this._art9PendingByKey?.get(key);
    if(pendiente==null)return especial;
    if(pendiente<=this._art9Minima){
      return {...especial,reduceSancion:false,factorSancion:1,
        nota:"ART. 9 D1419: saldo de sanción actualizado en o por debajo de la mínima; se conserva el saldo real pendiente sin aplicar 15%."};
    }
    return especial;
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
    const esPrivada=String(datos?.tipoLiquidacion||"").trim().toUpperCase()==="PRIVADA";

    // NUEVA REGLA DE IMPUTACIÓN — RÉGIMEN ORDINARIO / LIQUIDACIÓN PRIVADA:
    // La sanción participa en la proporcionalidad de TODOS los pagos, incluso
    // cuando el pago sea anterior a la fecha de presentación/sanción.
    //
    // SIMPLE (4-6 cuotas) queda expresamente fuera de esta modificación y
    // conserva su lógica propia de anticipos/extemporaneidad.
    //
    // Para pagos anteriores a la presentación, el motor base históricamente
    // entregaba deuda.sancion=0. En ese caso usamos el saldo pendiente real
    // mantenido por este contexto (sanción inicial menos lo ya imputado), sin
    // reconstruir ni volver a crear una sanción mínima.
    if(esOrdinario&&esPrivada&&tieneSancion&&sancionDeclarada){
      const sancionBaseMotor=n(deuda?.sancion);
      const sancionPendienteContexto=n(ctx?.sancionSaldoInicial);
      const sancionParaProporcion=sancionBaseMotor>0?sancionBaseMotor:sancionPendienteContexto;
      const resultado=super.aplicarProporcionalidad(pago,{...deuda,sancion:sancionParaProporcion});
      if(ctx)ctx.sancionSaldoInicial=Math.max(0,ctx.sancionSaldoInicial-n(resultado?.sancion));
      return resultado;
    }

    // Régimen Simple y liquidaciones oficiales conservan la lógica anterior.
    // Para TDJ > $1.000 en escenarios que ya tenían la ruta especial, se
    // mantiene además la participación de la sanción sin alterar SIMPLE.
    if(esOrdinario&&esTDJMayor1000(pagoActual)&&tieneSancion&&sancionDeclarada){
      const sancionBaseMotor=n(deuda?.sancion),sancionFallback=n(ctx?.sancionSaldoInicial);
      const sancionParaProporcion=sancionBaseMotor>0?sancionBaseMotor:sancionFallback;
      const resultado=super.aplicarProporcionalidad(pago,{...deuda,sancion:sancionParaProporcion});
      if(ctx)ctx.sancionSaldoInicial=Math.max(0,ctx.sancionSaldoInicial-n(resultado?.sancion));
      return resultado;
    }
    const resultado=super.aplicarProporcionalidad(pago,deuda);
    if(ctx&&tieneSancion&&n(resultado?.sancion)>0)ctx.sancionSaldoInicial=Math.max(0,ctx.sancionSaldoInicial-n(resultado.sancion));
    return resultado;
  }
}
