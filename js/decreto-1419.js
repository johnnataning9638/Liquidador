import {MotorLiquidacion as MotorLiquidacionV103} from "./motor-liquidacion.js?v=16.33.103";
import {MotorLiquidacion as MotorLiquidacionV107} from "./motor-liquidacion.js?v=16.33.107";
import {MotorLiquidacionOficial as MotorLiquidacionOficialV103} from "./motor-liquidacion-oficial.js?v=16.33.103";
import {MotorLiquidacionOficial as MotorLiquidacionOficialV107} from "./motor-liquidacion-oficial.js?v=16.33.107";

export const DECRETO_1419 = Object.freeze({
  inicioVigencia: "2026-09-17",
  finVigencia: "2026-11-19",
  fechaCorteObligacion: "2026-08-10",
  fechaCorteTituloExclusiva: "2026-08-10"
});

export const TIPO_1419 = Object.freeze({
  ART9: "ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO",
  ART10_OMISO: "ART. 10 DECRETO 1419 DE 2026 - OMISAS TRIBUTARIAS",
  ART10_CORRECCION: "ART. 10 DECRETO 1419 DE 2026 - CORRECCIONES TRIBUTARIAS"
});

export function esTipoDecreto1419(tipo) {
  return String(tipo || "").toUpperCase().includes("DECRETO 1419 DE 2026");
}

export function esArticulo9_1419(tipo) {
  return String(tipo || "").toUpperCase().includes("ART. 9 DECRETO 1419");
}

export function esArticulo10Omiso1419(tipo) {
  const t = String(tipo || "").toUpperCase();
  return t.includes("ART. 10 DECRETO 1419") && t.includes("OMIS");
}

export function esArticulo10Correccion1419(tipo) {
  const t = String(tipo || "").toUpperCase();
  return t.includes("ART. 10 DECRETO 1419") && t.includes("CORRECC");
}

export function validarSeleccion1419({
  tipo,
  fechasVencimiento = [],
  fechaPresentacion = "",
  fechaPago = "",
  fechaTitulo = "",
  esTitulo = false
} = {}) {
  if (!esTipoDecreto1419(tipo)) return [];
  const errores = [];
  const vencimientos = fechasVencimiento.filter(Boolean).map(String);
  const tieneVencidaAlCorte = vencimientos.some(f => f <= DECRETO_1419.fechaCorteObligacion);
  const todasVencidasAlCorte = vencimientos.length > 0 && vencimientos.every(f => f <= DECRETO_1419.fechaCorteObligacion);

  if ((esArticulo9_1419(tipo) || esArticulo10Omiso1419(tipo)) && !tieneVencidaAlCorte) {
    errores.push("La obligación no tiene vencimiento en mora al 10/08/2026.");
  }
  if (esArticulo10Omiso1419(tipo) && !todasVencidasAlCorte) {
    errores.push("Para el artículo 10, la fecha de vencimiento para declarar debe ser el 10/08/2026 o anterior.");
  }

  if (esArticulo9_1419(tipo)) {
    if (esTitulo) {
      if (!fechaTitulo) errores.push("Registre la fecha de constitución del título.");
      else if (fechaTitulo >= DECRETO_1419.fechaCorteTituloExclusiva) {
        errores.push("El artículo 9 admite títulos constituidos antes del 10/08/2026; el título debe tener fecha anterior a ese día.");
      }
    } else if (!fechaPago || fechaPago < DECRETO_1419.inicioVigencia || fechaPago > DECRETO_1419.finVigencia) {
      errores.push("El pago del artículo 9 debe tener fecha entre el 17/09/2026 y el 19/11/2026.");
    }
  }

  if (esArticulo10Omiso1419(tipo)) {
    if (!fechaPresentacion) errores.push("Registre la fecha de sanción, que corresponde a la fecha de presentación de la declaración omitida.");
    else if (fechaPresentacion < DECRETO_1419.inicioVigencia || fechaPresentacion > DECRETO_1419.finVigencia) errores.push("La declaración omitida debe presentarse entre el 17/09/2026 y el 19/11/2026.");
    else if (vencimientos.length && fechaPresentacion <= vencimientos.sort().at(-1)) errores.push("La fecha de presentación no es posterior al vencimiento; el caso no corresponde a una declaración omitida.");
    if (esTitulo) {
      if (!fechaTitulo || fechaTitulo < DECRETO_1419.inicioVigencia || fechaTitulo > DECRETO_1419.finVigencia) {
        errores.push("Para el artículo 10, el título debe constituirse durante la vigencia del beneficio: 17/09/2026 a 19/11/2026.");
      }
    } else if (!fechaPago || fechaPago < DECRETO_1419.inicioVigencia || fechaPago > DECRETO_1419.finVigencia) {
      errores.push("El pago del artículo 10 debe tener fecha entre el 17/09/2026 y el 19/11/2026.");
    }
  }

  if (esArticulo10Correccion1419(tipo)) {
    if (!fechaPresentacion) errores.push("Registre la fecha de sanción, que corresponde a la fecha de presentación de la corrección.");
    else if (fechaPresentacion < DECRETO_1419.inicioVigencia || fechaPresentacion > DECRETO_1419.finVigencia) {
      errores.push("La fecha de sanción/presentación de la corrección debe estar entre el 17/09/2026 y el 19/11/2026.");
    }
    if (esTitulo) {
      if (!fechaTitulo || fechaTitulo < DECRETO_1419.inicioVigencia || fechaTitulo > DECRETO_1419.finVigencia) {
        errores.push("Para el artículo 10, el título debe constituirse durante la vigencia del beneficio: 17/09/2026 a 19/11/2026.");
      }
    } else if (!fechaPago || fechaPago < DECRETO_1419.inicioVigencia || fechaPago > DECRETO_1419.finVigencia) {
      errores.push("El pago del artículo 10 debe tener fecha entre el 17/09/2026 y el 19/11/2026.");
    }
  }
  return errores;
}

/**
 * REGLA EMPRESARIAL DE IMPUTACIÓN DE SANCIÓN — OCTUBRE 2026
 *
 * La fecha de vencimiento NO determina si un pago puede recibir sanción.
 * El único corte para esa decisión es fechaSancion:
 *   pago < fechaSancion  -> sanción = 0 para ese pago.
 *   pago >= fechaSancion -> se conserva la lógica vigente.
 *
 * El parche se instala sobre las cuatro variantes de motor que conviven por
 * control de caché de versión en app.js y tdj.js. No modifica el cálculo de
 * impuesto, intereses, vencimientos, tasas, beneficios tributarios ni diseño.
 */
function instalarPoliticaFechaSancion(MotorClass){
  if(!MotorClass || MotorClass.prototype.__politicaFechaSancion20261005)return;
  const originalTasaEspecial=MotorClass.prototype.tasaEspecial;
  const originalAplicarProporcionalidad=MotorClass.prototype.aplicarProporcionalidad;
  const originalCalcular=MotorClass.prototype.calcular;

  MotorClass.prototype.tasaEspecial=function(tipo,fechaPago){
    const resultado=originalTasaEspecial.call(this,tipo,fechaPago);
    this.__fechaPagoPoliticaSancion=String(fechaPago||"").slice(0,10);
    const fechaSancion=String(this.__fechaSancionPolitica||"").slice(0,10);
    const pago=String(fechaPago||"").slice(0,10);
    if(fechaSancion && pago && pago<fechaSancion){
      return {...resultado,reduceSancion:false,factorSancion:1,actualizaSancion:false};
    }
    return resultado;
  };

  MotorClass.prototype.aplicarProporcionalidad=function(pago,deuda){
    const fechaSancion=String(this.__fechaSancionPolitica||"").slice(0,10);
    const fechaPago=String(this.__fechaPagoPoliticaSancion||"").slice(0,10);
    if(fechaSancion && fechaPago && fechaPago<fechaSancion && deuda){
      return originalAplicarProporcionalidad.call(this,pago,{...deuda,sancion:0});
    }
    return originalAplicarProporcionalidad.call(this,pago,deuda);
  };

  MotorClass.prototype.calcular=function(datos){
    this.__fechaSancionPolitica=String(datos?.fechaSancion||"").slice(0,10);
    this.__fechaPagoPoliticaSancion="";
    try{
      return originalCalcular.call(this,datos);
    }finally{
      this.__fechaSancionPolitica="";
      this.__fechaPagoPoliticaSancion="";
    }
  };

  Object.defineProperty(MotorClass.prototype,"__politicaFechaSancion20261005",{value:true,enumerable:false,configurable:false});
}

instalarPoliticaFechaSancion(MotorLiquidacionV103);
instalarPoliticaFechaSancion(MotorLiquidacionV107);
instalarPoliticaFechaSancion(MotorLiquidacionOficialV103);
instalarPoliticaFechaSancion(MotorLiquidacionOficialV107);
