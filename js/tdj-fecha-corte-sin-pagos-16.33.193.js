// TDJ v16.33.193 — referencia global para obligaciones sin pagos + soporte PDF.
// Corrección aislada: no cambia la distribución de títulos ni los cálculos de
// obligaciones que ya tienen movimientos reales. Cuando una obligación TDJ no
// tiene pagos, usa como fecha de liquidación la fecha más reciente registrada
// en la pestaña PAGOS y crea únicamente el detalle informativo necesario para
// que el PDF pueda representar esa liquidación.
import {MotorLiquidacion} from "./motor-liquidacion.js?v=16.33.161";

(function(){
  "use strict";
  if(typeof window==="undefined"||typeof document==="undefined")return;
  if(window.__tdjFechaCorteSinPagos193)return;
  window.__tdjFechaCorteSinPagos193=true;

  const iso=v=>{
    const s=String(v??"").trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[\\/.\\-](\d{1,2})[\\/.\\-](\d{2}|\d{4})$/);
    if(!m)return "";
    const y=m[3].length===2?(Number(m[3])>=70?`19${m[3]}`:`20${m[3]}`):m[3];
    return `${y}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[1])).padStart(2,"0")}`;
  };

  function fechaMasRecientePagos(){
    const fechas=[];
    document.querySelectorAll(".pagos-mini tbody tr").forEach(tr=>{
      const f=iso(tr.querySelector(".fecha-campo")?.value||"")||iso(tr.querySelector(".fecha-native")?.value||"");
      if(f)fechas.push(f);
    });
    return fechas.sort().at(-1)||"";
  }

  function tasaPara(tipo,fecha,motor){
    const t=String(tipo||"TASA DIAN").trim().toUpperCase();
    try{
      let x=motor?.tasaEspecial?.(t,fecha)?.tasa;
      if(x==null)x=motor?.tasaPorFecha?.(fecha,t);
      if(x==null&&t!=="TASA DIAN")x=motor?.tasaPorFecha?.(fecha,"TASA DIAN");
      const n=Number(x);
      return Number.isFinite(n)?(n>1?n/100:n):null;
    }catch{return null;}
  }

  const proto=MotorLiquidacion?.prototype;
  if(!proto||proto.__tdjFechaCorteSinPagos193)return;
  const original=proto.calcular;
  if(typeof original!=="function")return;

  proto.calcular=function(datos){
    const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];
    const hoy=new Date().toISOString().slice(0,10);
    const fechaActual=iso(datos?.fechaCorte||"");
    const referencia=fechaMasRecientePagos();
    let datosCalculo=datos;
    let referenciaAplicada="";

    // Solo intervenimos cuando ESTA obligación no tiene pagos reales y el
    // motor recibió hoy como fecha de respaldo. Una fecha de corte explícita
    // distinta de hoy se respeta íntegramente.
    if(!pagos.length&&referencia&&fechaActual===hoy){
      datosCalculo={...datos,fechaCorte:referencia,__tdjFechaReferencia193:referencia};
      referenciaAplicada=referencia;
    }

    const r=original.call(this,datosCalculo);
    if(!referenciaAplicada)return r;

    // El resultado matemático ya fue calculado por el motor original. Solo
    // agregamos un registro informativo de corte para que el exportador TDJ
    // pueda representar una obligación sin pagos sin alterar ningún valor.
    if(!Array.isArray(r?.detalle)||!r.detalle.length){
      const impuesto=Math.max(0,Number(r?.impuesto||0));
      const intereses=Math.max(0,Number(r?.intereses||0));
      const sancion=Math.max(0,Number(r?.sancion||0));
      const total=Math.max(0,Number(r?.total??(impuesto+intereses+sancion)));
      const tipo=String(datos?.tipoTasa||"TASA DIAN").trim().toUpperCase();
      const tasa=tasaPara(tipo,referenciaAplicada,this);
      const detalle={
        pago:{
          id:`CORTE-TDJ-193-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
          numero:999998,
          fecha:referenciaAplicada,
          valor:0,
          recibo:"",
          tdj:"",
          observacion:"LIQUIDACIÓN A FECHA DE REFERENCIA",
          esTDJ:false,
          ordenInterno:999998
        },
        deudaAntes:{impuesto,intereses,sancion},
        aplicado:{impuesto:0,intereses:0,sancion:0,total:0},
        saldo:{impuesto,intereses,sancion,total},
        aplicacionesVto:(Array.isArray(datos?.vencimientos)?datos.vencimientos:[]).map(v=>({
          id:v.id,aplicado:0,aplicadoIntereses:0,aplicadoSancion:0,saldo:Number(v.impuesto||0)
        })),
        interesesPorCuota:Array.isArray(r?.interesesPorCuota)?r.interesesPorCuota:[],
        interesLiquidado:intereses,
        tipoAplicado:tipo,
        tasaVisible:tasa,
        notaBeneficio:"TASA APLICABLE A LA FECHA DE REFERENCIA.",
        esFechaCorteInformativa:true
      };
      return {...r,detalle:[detalle]};
    }
    return r;
  };
  proto.__tdjFechaCorteSinPagos193=true;

  window.__tdjFechaCorteSinPagos193={fechaMasRecientePagos};
})();