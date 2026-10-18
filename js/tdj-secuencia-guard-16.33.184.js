// TDJ v16.33.184 — PARIDAD ESTRUCTURAL CON LIQUIDADOR DIAN.
//
// OBJETIVO:
// El Liquidador TJ debe utilizar el mismo motor cronológico del Liquidador
// DIAN para pagos, intereses, sanción y fechas. Cuando la capa de prioridad
// DIAN/TJ decide que un TDJ no pertenece a la obligación actual (por cierre
// provocado por pagos posteriores), el valor del título se lleva a cero SOLO
// para la fotografía matemática de esa obligación. La capa anterior dejaba
// entonces al core TJ sin detalle para ese TDJ y este usaba accidentalmente el
// último detalle de otro título como respaldo. Eso duplicaba la aplicación.
//
// Esta capa NO modifica fórmulas, tasas, proporcionalidad ni motor histórico.
// Únicamente garantiza que un TDJ excluido conserve una fila matemática de
// aplicación = 0, evitando el fallback a otro título y permitiendo que el
// remanente siga cronológicamente hacia la siguiente obligación.
import { MotorLiquidacion as MotorLiquidacion184 } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial as MotorLiquidacionOficial184 } from "./motor-liquidacion-oficial.js?v=16.33.161";

(function(){
  "use strict";
  if(typeof window!=="undefined"&&window.__tdjSecuenciaGuard184Installed)return;
  if(typeof window!=="undefined")window.__tdjSecuenciaGuard184Installed=true;

  const iso=v=>String(v??"").slice(0,10);
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const esTDJ=p=>p?.esTDJ===true||String(p?.tdj??"").trim()!=="";

  function esExcluidoPorCierre(datos,p){
    if(!p||!esTDJ(p)||num(p.valor)!==0)return false;
    const fecha=iso(p.fecha);
    if(!fecha)return false;
    const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];
    const anteriores=pagos.filter(x=>esTDJ(x)&&String(x.id??"")!==String(p.id??"")&&iso(x.fecha)===fecha&&num(x.valor)>0);
    if(!anteriores.length)return false;
    const posteriores=pagos.filter(x=>!esTDJ(x)&&iso(x.fecha)>fecha&&num(x.valor)>0);
    return posteriores.length>0;
  }

  function detalleExclusion(r,p){
    const saldo=r?.ultimo?.saldo||{};
    return {
      pago:{...p,valor:0,esTDJ:true,esTDJExcluidoPorCierre:true},
      tasa:null,
      tasaVisible:null,
      tipoAplicado:p?.tipo||"TASA DIAN",
      beneficio:null,
      notaBeneficio:"TDJ EXCLUIDO DE LA OBLIGACIÓN ACTUAL POR CIERRE CRONOLÓGICO. EL VALOR NOMINAL CONTINÚA DISPONIBLE PARA LA SIGUIENTE OBLIGACIÓN.",
      interesGenerado:0,
      interesLiquidado:0,
      tramosInteres:[],
      interesesPorCuota:[],
      deudaAntes:{
        impuesto:num(saldo.impuesto),
        intereses:num(saldo.intereses),
        sancion:num(saldo.sancion)
      },
      aplicado:{
        impuesto:0,
        intereses:0,
        sancion:0,
        total:0,
        excedente:0,
        porcentaje:0,
        tipoProporcion:"TDJ EXCLUIDO POR CIERRE — SIN IMPUTACIÓN"
      },
      excedente:0,
      aplicacionesVto:[],
      actualizacionSancion:{aplicada:false,actualizacionTotal:0,tramos:[],eventos:[]},
      saldo:{
        impuesto:num(saldo.impuesto),
        intereses:num(saldo.intereses),
        sancion:num(saldo.sancion),
        total:num(saldo.total)
      },
      esTDJExcluidoPorCierre:true
    };
  }

  function instalar(Clase){
    if(!Clase?.prototype?.calcular)return;
    const proto=Clase.prototype;
    const original=proto.calcular;
    if(original.__tdj184)return;

    function calcular(datos,...rest){
      const r=original.call(this,datos,...rest);
      const excluidos=(datos?.pagos||[]).filter(p=>esExcluidoPorCierre(datos,p));
      if(!excluidos.length||!r||!Array.isArray(r.detalle))return r;

      const ids=new Set(r.detalle.map(d=>String(d?.pago?.id??"")));
      for(const p of excluidos){
        const id=String(p?.id??"");
        if(!id||ids.has(id))continue;
        r.detalle.push(detalleExclusion(r,p));
      }
      return r;
    }

    calcular.__tdj184=true;
    proto.calcular=calcular;
  }

  instalar(MotorLiquidacion184);
  instalar(MotorLiquidacionOficial184);
  if(typeof window!=="undefined")window.__tdjSecuenciaGuard184Ready=true;
})();
