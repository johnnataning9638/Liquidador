// TDJ v16.33.185 — PROTECCIÓN DE TRAZABILIDAD POR TÍTULO Y MISMA FECHA.
//
// CORRECCIÓN AISLADA TDJ:
// Cuando la capa de secuencia determina que el TDJ actual debe quedar en cero
// dentro de la obligación actual porque un TDJ anterior de la MISMA FECHA ya
// cubrió la obligación, el motor histórico puede no generar una fila propia
// para el título en cero. El consumidor entonces podía tomar accidentalmente
// el último detalle de otro título como respaldo y duplicar la aplicación.
//
// Esta capa garantiza una fila matemática explícita para el TDJ excluido:
// aplicado = 0 / excedente = 0 dentro de esta obligación. El valor nominal del
// título NO se modifica en la captura y queda disponible para la siguiente
// obligación mediante la secuencia superior.
//
// NO modifica: fórmulas tributarias, intereses, sanciones, proporcionalidad,
// pagos normales, endoso ni la liquidación normal DIAN.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.161";

(function(){
  "use strict";
  if(typeof window!=="undefined"&&window.__tdjSecuenciaGuard185Installed)return;
  if(typeof window!=="undefined")window.__tdjSecuenciaGuard185Installed=true;

  const iso=v=>String(v??"").slice(0,10);
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const esTDJ=p=>p?.esTDJ===true||String(p?.tdj??"").trim()!=="";

  function esExcluidoPorCierreMismaFecha(datos,p){
    if(!p||!esTDJ(p)||num(p.valor)!==0)return false;
    const fecha=iso(p.fecha);
    if(!fecha)return false;
    const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];
    return pagos.some(x=>
      esTDJ(x)&&
      String(x?.id??"")!==String(p?.id??"")&&
      iso(x?.fecha)===fecha&&
      num(x?.valor)>0
    );
  }

  function detalleExclusion(r,p){
    const saldo=r?.ultimo?.saldo||{};
    return {
      pago:{...p,valor:0,esTDJ:true,esTDJExcluidoPorCierre:true},
      tasa:null,
      tasaVisible:null,
      tipoAplicado:p?.tipo||"TASA DIAN",
      beneficio:null,
      notaBeneficio:"TDJ EXCLUIDO DE LA OBLIGACIÓN ACTUAL POR CIERRE CRONOLÓGICO DE TÍTULO DE LA MISMA FECHA. EL VALOR NOMINAL CONTINÚA DISPONIBLE PARA LA SIGUIENTE OBLIGACIÓN.",
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
    if(original.__tdj185)return;

    function calcular(datos,...rest){
      const r=original.call(this,datos,...rest);
      const excluidos=(datos?.pagos||[]).filter(p=>esExcluidoPorCierreMismaFecha(datos,p));
      if(!excluidos.length||!r||!Array.isArray(r.detalle))return r;

      const ids=new Set(r.detalle.map(d=>String(d?.pago?.id??"")));
      for(const p of excluidos){
        const id=String(p?.id??"");
        if(!id||ids.has(id))continue;
        r.detalle.push(detalleExclusion(r,p));
      }
      return r;
    }

    calcular.__tdj185=true;
    proto.calcular=calcular;
  }

  instalar(MotorLiquidacion);
  instalar(MotorLiquidacionOficial);
  if(typeof window!=="undefined")window.__tdjSecuenciaGuard185Ready=true;
})();
