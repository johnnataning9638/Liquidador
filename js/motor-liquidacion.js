import {MotorLiquidacion as MotorLiquidacionBase} from "./motor-liquidacion-base.js?v=16.33.122";

const iso=v=>String(v||"").slice(0,10);
const n=v=>Math.max(0,Number(v||0));
const esSimple4a6=datos=>{
  const v=Array.isArray(datos?.vencimientos)
    ?datos.vencimientos.filter(x=>iso(x?.fecha||x?.fechaVto)&&n(x?.impuesto??x?.valor)>0)
    :[];
  return v.length>=4&&v.length<=6;
};

function esTDJRegistro(pago){
  return pago?.esTDJ===true || String(pago?.tdj||"").trim()!=="";
}

function fechaSancionExisteEnAplicacion(datos,pago){
  const fechaSancion=iso(datos?.fechaSancion);
  const fechaAplicacion=iso(pago?.fecha);
  return String(datos?.tieneSancion||"").trim().toUpperCase()==="SI"
    && n(datos?.valorSancion)>0
    && Boolean(fechaSancion)
    && Boolean(fechaAplicacion)
    && fechaAplicacion>=fechaSancion;
}

/**
 * Regla quirúrgica TDJ ordinario > $1.000.
 *
 * El motor base ya calcula la obligación y los intereses. Aquí únicamente
 * se corrige la composición del pago cuando el registro es un TDJ mayor de
 * $1.000 y, en la fecha efectiva de aplicación, la sanción ya existe.
 *
 * NO interviene en:
 * - régimen simple 4-6 cuotas;
 * - TDJ <= $1.000;
 * - pagos normales/no TDJ;
 * - títulos aplicados antes de existir la sanción.
 *
 * La fecha del título que gobierna intereses sigue siendo pago.fecha, porque
 * es la fecha efectiva de aplicación del título en el motor.
 */
function redistribuirTDJOrdinarioMayor1000(r,datos,motor){
  if(!r||!Array.isArray(r.detalle)||!r.detalle.length)return r;
  if(esSimple4a6(datos))return r;
  if(String(datos?.tieneSancion||"").trim().toUpperCase()!=="SI")return r;
  if(n(datos?.valorSancion)<=0)return r;

  let huboCambio=false;
  for(const d of r.detalle){
    const pago=d?.pago||{};
    const valor=n(pago.valor);
    if(!esTDJRegistro(pago) || valor<=1000)continue;
    if(!fechaSancionExisteEnAplicacion(datos,pago))continue;

    const aplicado=d.aplicado||{};
    const saldo=d.saldo||{};

    // El detalle conserva deuda antes = saldo posterior + aplicado. Esto
    // permite reconstruir la deuda vigente en ese movimiento sin tocar el
    // cálculo de intereses ni la secuencia cronológica.
    const deudaAntes={
      impuesto:n(saldo.impuesto)+n(aplicado.impuesto),
      intereses:n(saldo.intereses)+n(aplicado.intereses),
      sancion:n(saldo.sancion)+n(aplicado.sancion)
    };
    if(deudaAntes.impuesto+deudaAntes.intereses+deudaAntes.sancion<=0)continue;

    // Reutilizamos la misma función proporcional del motor base. No se crea
    // una segunda fórmula ni se redondean nuevamente los componentes: el
    // método nativo conserva la regla DIAN y su tratamiento del remanente.
    const esperado=motor.aplicarProporcionalidad(valor,deudaAntes);
    if(!esperado)continue;

    const nuevo={
      impuesto:n(esperado.impuesto),
      intereses:n(esperado.intereses),
      sancion:n(esperado.sancion),
      excedente:n(esperado.excedente)
    };

    // Si el motor base ya produjo la distribución correcta, no se toca nada.
    const igual=n(aplicado.impuesto)===nuevo.impuesto
      && n(aplicado.intereses)===nuevo.intereses
      && n(aplicado.sancion)===nuevo.sancion
      && n(aplicado.excedente)===nuevo.excedente;
    if(igual)continue;

    d.aplicado={...aplicado,...nuevo,total:nuevo.impuesto+nuevo.intereses+nuevo.sancion};
    d.saldo={
      ...saldo,
      impuesto:Math.max(0,deudaAntes.impuesto-nuevo.impuesto),
      intereses:Math.max(0,deudaAntes.intereses-nuevo.intereses),
      sancion:Math.max(0,deudaAntes.sancion-nuevo.sancion)
    };
    d.saldo.total=n(d.saldo.impuesto)+n(d.saldo.intereses)+n(d.saldo.sancion);
    huboCambio=true;
  }

  if(!huboCambio)return r;

  // El resumen superior representa saldos pendientes. El último detalle es
  // el saldo posterior a la secuencia completa de pagos/títulos.
  const ultimo=r.detalle[r.detalle.length-1];
  if(ultimo?.saldo){
    r.impuesto=n(ultimo.saldo.impuesto);
    r.intereses=n(ultimo.saldo.intereses);
    r.sancion=n(ultimo.saldo.sancion);
    r.total=n(r.impuesto)+n(r.intereses)+n(r.sancion);
  }
  return r;
}

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
    const r=super.calcular(datos);
    const corregidoTDJ=redistribuirTDJOrdinarioMayor1000(r,datos,this);
    return redistribuirSancionSimple(corregidoTDJ,datos);
  }
}
