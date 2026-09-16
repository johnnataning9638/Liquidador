import {fechaISO,roundMil,diasEntre} from "./utilidades.js";
import {MotorLiquidacion} from "./motor-liquidacion.js";

/**
 * MOTOR DE LIQUIDACIÓN OFICIAL
 *
 * Este módulo es independiente del motor privado. Extiende únicamente los
 * métodos auxiliares comunes; NO modifica la lógica de MotorLiquidacion.
 *
 * Reglas principales:
 * 1. La imputación de pagos conserva la misma metodología del motor privado.
 * 2. Los intereses siguen la misma tasa/metodología privada, pero excluyen
 *    el período suspendido por el parágrafo 2 del art. 634 E.T.
 * 3. La suspensión empieza después de dos años desde la admisión de la
 *    demanda y termina con la ejecutoria de la providencia definitiva.
 * 4. La sanción oficial se actualiza independientemente de los intereses,
 *    conforme al art. 867-1 E.T.: desde el 1 de enero siguiente a la firmeza
 *    administrativa del acto sancionatorio, acumulativamente por IPC.
 */
export class MotorLiquidacionOficial extends MotorLiquidacion{
  validarObligacion(datos){
    const base=super.validarObligacion(datos);
    const errores=[...base.errores];
    const advertencias=[...base.advertencias];
    const tipo=String(datos.tipoLiquidacion||"").trim().toUpperCase();
    if(tipo!=="OFICIAL"){
      errores.push("El motor de liquidación oficial solo puede ejecutarse con tipo OFICIAL.");
      return {...base,errores,advertencias,valida:false};
    }
    const auto=fechaISO(datos.fechaAutoAdmisorio)||"";
    const prov=fechaISO(datos.fechaProvidenciaDefinitiva)||"";
    if(!auto) errores.push("Para una liquidación oficial debe registrar la fecha de auto admisorio.");
    if(!prov) errores.push("Para una liquidación oficial debe registrar la fecha de providencia definitiva (ejecutoria).");
    if(auto&&prov&&prov<auto) errores.push("La fecha de providencia definitiva no puede ser anterior a la fecha de auto admisorio.");
    if(auto&&prov){
      const suspension=this.sumarAnos(auto,2);
      if(prov<suspension) advertencias.push("La providencia definitiva ocurre antes de cumplirse los dos años; no se genera período de suspensión de intereses.");
    }
    return {...base,errores,advertencias,valida:errores.length===0};
  }

  sumarAnos(iso,anios){
    const [y,m,d]=String(iso).slice(0,10).split("-").map(Number);
    if(!y||!m||!d)return "";
    const ultimo=new Date(Date.UTC(y+anios,m,0)).getUTCDate();
    return `${y+anios}-${String(m).padStart(2,"0")}-${String(Math.min(d,ultimo)).padStart(2,"0")}`;
  }

  sumarDias(iso,dias){
    const d=new Date(`${String(iso).slice(0,10)}T00:00:00Z`);
    if(Number.isNaN(d.getTime()))return "";
    d.setUTCDate(d.getUTCDate()+Number(dias||0));
    return d.toISOString().slice(0,10);
  }

  interesOficial(base,fechaVto,fechaPago,{tipo="TASA DIAN",factor=1,tasaFija=null,auto="",providencia=""}={}){
    const vto=fechaISO(fechaVto),pago=fechaISO(fechaPago),adm=fechaISO(auto),prov=fechaISO(providencia);
    if(!vto||!pago||pago<=vto||Number(base)<=0)return {valor:0,dias:0,metodologia:null,tramos:[]};

    const finDosAnos=adm?this.sumarAnos(adm,2):"";
    const suspensionDesde=finDosAnos?this.sumarDias(finDosAnos,1):"";
    const haySuspension=!!(suspensionDesde&&prov&&prov>=suspensionDesde);
    const tramos=[];

    const agregarTramo=(desde,hasta,permitir)=>{
      if(!permitir||!desde||!hasta||hasta<=desde)return 0;
      const ih=this.interesParaPago(base,desde,hasta,{tipo,factor,tasaFija});
      if(ih.valor==null){
        tramos.push({desde,hasta,dias:diasEntre(desde,hasta),valor:null,metodologia:ih.metodologia,advertencia:"No hay tasa histórica suficiente para cerrar este tramo."});
        return null;
      }
      const ts=ih.tramos||[];
      if(ts.length===1){
        tramos.push({...ts[0],desde:ts[0].desde||desde,hasta:ts[0].hasta||hasta,valor:Number(ih.valor||0)});
      }else if(ts.length){
        // Para tramos históricos múltiples, conserva la información temporal
        // y distribuye el valor calculado de cada subtramo cuando la tasa está
        // disponible. Esto evita perder el valor monetario en los informes.
        for(const t of ts){
          const dias=Number(t.dias||0),tasa=Number(t.tasa||0);
          const valorSub=dias>0&&Number.isFinite(tasa)?roundMil(Number(base)*tasa/this.diasDelAnio(t.hasta||hasta)*dias):0;
          tramos.push({...t,desde:t.desde||desde,hasta:t.hasta||hasta,valor:valorSub});
        }
      }else tramos.push({desde,hasta,dias:ih.dias,tasa:ih.tasa,valor:ih.valor,metodologia:ih.metodologia});
      return Number(ih.valor||0);
    };

    // Si la demanda fue admitida, los intereses continúan hasta cumplir dos
    // años. El período posterior a esa fecha queda suspendido hasta la
    // ejecutoria de la providencia definitiva.
    if(haySuspension){
      const corteSuspension=suspensionDesde;
      const finPrimerTramo=pago<=corteSuspension?pago:corteSuspension;
      const v1=agregarTramo(vto,finPrimerTramo,true);
      let total=v1==null?null:v1;
      if(pago>corteSuspension&&prov&&pago>prov){
        const v2=agregarTramo(prov,pago,true);
        if(v2==null)total=null; else if(total!=null)total+=v2;
      }
      const dias1=Math.max(0,diasEntre(vto,finPrimerTramo));
      const diasSusp=(pago>corteSuspension?Math.max(0,diasEntre(corteSuspension,prov||pago)):0);
      const dias2=(pago>prov?Math.max(0,diasEntre(prov,pago)):0);
      tramos.push({
        tipo:"SUSPENSION_INTERESES",
        desde:corteSuspension,
        hasta:prov||pago,
        dias:diasSusp,
        valor:0,
        metodologia:"SUSPENSION_ART_634_PAR_2",
        suspendido:true
      });
      tramos.sort((a,b)=>String(a.desde||"").localeCompare(String(b.desde||"")));
      return {valor:total==null?null:roundMil(total),dias:dias1+dias2,metodologia:"INTERES_OFICIAL_CON_SUSPENSION_ART_634",tramos};
    }

    const v=agregarTramo(vto,pago,true);
    return {valor:v==null?null:roundMil(v),dias:diasEntre(vto,pago),metodologia:"INTERES_OFICIAL",tramos};
  }

  actualizarSancionOficial(saldoInicial,fechaFirmeza,fechaCorte,{aniosAplicados=[]}={}){
    let saldo=Math.max(0,Number(saldoInicial||0));
    const base=fechaISO(fechaFirmeza),corte=fechaISO(fechaCorte);
    const tramos=[]; const advertencias=[];
    if(!saldo||!base||!corte||corte<=base)return {saldoInicial:roundMil(saldoInicial||0),valor:roundMil(saldo),actualizacion:0,fechaBase:base,fechaCorte:corte,tramos,advertencias};
    const excl=new Set((aniosAplicados||[]).map(Number));
    const primerAnio=Number(base.slice(0,4))+1;
    const ultimoAnio=Number(corte.slice(0,4));
    for(let anio=primerAnio;anio<=ultimoAnio;anio++){
      if(excl.has(anio))continue;
      const fechaAplicacion=`${anio}-01-01`;
      if(fechaAplicacion>corte)continue;
      const fila=this.actualizadorSancion.ipcPorAnio(anio-1);
      const ipc=Number(fila?.inflacion??fila?.inflacionTotal3??0);
      const antes=saldo;
      if(ipc>0){
        const actualizacion=roundMil(antes*ipc);
        saldo=roundMil(antes+actualizacion);
        tramos.push({anio,desde:fechaAplicacion,hasta:`${anio}-12-31`,ipc,ipcPorcentaje:ipc*100,saldoInicial:antes,actualizacion,saldoFinal:saldo,disponible:true,aplicado:true,anioInflacion:anio-1});
      }else{
        advertencias.push(`No existe IPC cargado para ${anio}; no se actualizó la sanción oficial en ${anio}.`);
        tramos.push({anio,desde:fechaAplicacion,hasta:`${anio}-12-31`,ipc:0,ipcPorcentaje:0,saldoInicial:antes,actualizacion:0,saldoFinal:saldo,disponible:false,aplicado:false,anioInflacion:anio-1});
      }
    }
    return {saldoInicial:roundMil(saldoInicial||0),valor:roundMil(saldo),actualizacion:roundMil(saldo-(Number(saldoInicial)||0)),fechaBase:base,fechaCorte:corte,tramos,advertencias};
  }

  calcular(datos){
    const validacion=this.validarObligacion(datos);
    if(validacion.errores.length)throw new Error(validacion.errores.join(" "));

    const vencimientos=this.normalizarVencimientos(datos);
    const fechaCorte=fechaISO(datos.fechaCorte)||null;
    const pagos=[...(datos.pagos||[])]
      .map((p,i)=>({...p,fecha:fechaISO(p.fecha),valor:Number(p.valor||0),ordenOriginal:i}))
      .filter(p=>p.fecha&&p.valor>0&&(fechaCorte?! (p.fecha>fechaCorte):true))
      .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.ordenOriginal-b.ordenOriginal);

    const saldosVto=vencimientos.map((v,i)=>({...v,numero:Number(v.numero||i+1),saldo:Math.max(0,Number(v.impuesto||0))}));
    const sancionBaseOriginal=datos.tieneSancion==="SI"?Number(datos.valorSancion||0):0;
    const fechaSancion=fechaISO(datos.fechaSancion)||saldosVto[0]?.fecha||"";
    const fechaFirmezaSancion=fechaSancion;
    let saldoSancion=sancionBaseOriginal;
    if(saldoSancion>0){
      const minima=this.sancionMinima(Number(fechaSancion.slice(0,4))||Number(datos.anio||0));
      if(minima>0&&saldoSancion<minima)saldoSancion=minima;
    }
    let saldoIntereses=0,excedenteTotal=0;
    let detalleActualizacionSancion=[]; let advertenciasSancion=[];
    const aniosActualizacionSancionAplicados=new Set();
    const idVtoSancion=saldosVto[0]?.id||null;
    const detalle=[];
    const auto=fechaISO(datos.fechaAutoAdmisorio)||"";
    const providencia=fechaISO(datos.fechaProvidenciaDefinitiva)||"";

    const calcularInteresesAntesPago=(pago)=>{
      let liquidado=0;const tramos=[];const porVto=[];
      for(const v of saldosVto){
        let valor=0,tramoVto=[];
        if(v.saldo>0&&pago.fecha>v.fecha){
          const especial=this.tasaEspecial(pago.tipo,pago.fecha);
          if(especial.requiereDato){
            tramoVto=[{vto:v.id,base:Number(v.saldo||0),valor:null,metodologia:"BENEFICIO_REQUIERE_IBC",advertencia:"El tratamiento seleccionado requiere IBC histórico; no se sustituye por la TIM."}];
          }else if(especial.tasa!=null&&Number(especial.tasa)===0){
            tramoVto=[{vto:v.id,base:Number(v.saldo||0),valor:0,metodologia:"TASA_ESPECIAL_CERO",dias:diasEntre(v.fecha,pago.fecha),desde:v.fecha,hasta:pago.fecha,tasa:0,aplica:true}];
          }else{
            let tasaFija=null;const factor=Number(especial.factor||1);
            if(especial.factor===1&&especial.tasa!=null)tasaFija=Number(especial.tasa);
            const ih=this.interesOficial(v.saldo,v.fecha,pago.fecha,{tipo:"TASA DIAN",factor,tasaFija,auto,providencia});
            if(ih.valor==null){
              tramoVto=[{vto:v.id,base:Number(v.saldo||0),valor:null,metodologia:ih.metodologia,advertencia:"No hay tasa histórica suficiente para cerrar este tramo."},...(ih.tramos||[])];
            }else{
              valor=Number(ih.valor||0);
              tramoVto=(ih.tramos||[]).map(t=>({...t,base:Number(v.saldo||0)}));
              if(!tramoVto.length)tramoVto=[{vto:v.id,valor,metodologia:ih.metodologia,dias:ih.dias,desde:v.fecha,hasta:pago.fecha,tasa:ih.tasa}];
            }
          }
        }
        liquidado+=valor;tramos.push(...tramoVto);porVto.push({id:v.id,interes:Math.max(0,Number(valor||0)),tramos:tramoVto});
      }
      return {liquidado:roundMil(liquidado),tramos,porVto};
    };

    for(const pago of pagos){
      const especial=this.tasaEspecial(pago.tipo,pago.fecha);
      const actualizacionSancionPago={aplicada:false,fechaPago:pago.fecha,saldoAntes:roundMil(saldoSancion),saldoDespues:roundMil(saldoSancion),actualizacionTotal:0,tramos:[],eventos:[]};
      const intCalc=calcularInteresesAntesPago(pago);

      if(saldoSancion>0&&fechaFirmezaSancion&&pago.fecha>fechaFirmezaSancion){
        const act=this.actualizarSancionOficial(saldoSancion,fechaFirmezaSancion,pago.fecha,{aniosAplicados:[...aniosActualizacionSancionAplicados]});
        if(act.valor>saldoSancion)saldoSancion=act.valor;
        if(act.tramos?.length){
          act.tramos.forEach(t=>aniosActualizacionSancionAplicados.add(Number(t.anio)));
          detalleActualizacionSancion.push({fechaPago:pago.fecha,...act});
          actualizacionSancionPago.aplicada=act.tramos.some(t=>t.aplicado);
          actualizacionSancionPago.tramos=act.tramos.map(t=>({anio:Number(t.anio),desde:t.desde,hasta:t.hasta,dias:365,saldoAntes:roundMil(t.saldoInicial||0),actualizacion:roundMil(t.actualizacion||0),saldoDespues:roundMil(t.saldoFinal||0),ipc:Number(t.ipc||0),ipcPorcentaje:Number(t.ipcPorcentaje||0),disponible:t.disponible!==false}));
          actualizacionSancionPago.actualizacionTotal=roundMil(actualizacionSancionPago.tramos.reduce((a,t)=>a+Number(t.actualizacion||0),0));
        }
        advertenciasSancion.push(...(act.advertencias||[]));
      }

      const interesesPorCuota=saldosVto.map(v=>{
        const calc=intCalc.porVto.find(z=>z.id===v.id)||{};
        const tramosInteres=calc.tramos||[];
        const primer=(tramosInteres.find(t=>t.tipo!=="SUSPENSION_INTERESES")||tramosInteres[0]||{});
        const base=Math.max(0,Number(v.saldo||0));
        const aplica=base>0&&pago.fecha>v.fecha;
        const tramosNormales=tramosInteres.filter(t=>t.tipo!=="SUSPENSION_INTERESES");
        const tramoSuspension=tramosInteres.find(t=>t.tipo==="SUSPENSION_INTERESES")||null;
        const tramo1=tramosNormales.length?tramosNormales.filter(t=>!tramoSuspension||String(t.hasta||"")<=String(tramoSuspension.desde||"")):[];
        const tramo2=tramosNormales.length?tramosNormales.filter(t=>tramoSuspension&&String(t.desde||"")>=String(tramoSuspension.hasta||"") ):[];
        return {cuota:Number(v.numero||0),vto:v.id,capitalBase:base,fechaVencimiento:v.fecha,fechaPago:pago.fecha,dias:aplica?Number(calc.interes?tramosNormales.reduce((a,t)=>a+Number(t.dias||0),0):0):0,tasa:primer.tasa==null?(aplica?Number(this.tasaPorFecha(pago.fecha,"TASA DIAN")||0):0):Number(primer.tasa),interes:Math.max(0,Number(calc.interes||0)),metodologia:tramosInteres.some(t=>t.tipo==="SUSPENSION_INTERESES")?"INTERES_OFICIAL_CON_SUSPENSION_ART_634":(primer.metodologia||(aplica?"INTERES_OFICIAL":"NO EXIGIBLE")),aplica,suspensionAplicada:!!tramoSuspension,tramoInteres1:tramo1,tramoSuspension:tramoSuspension,tramoInteres2:tramo2,diasInteres1:tramo1.reduce((a,t)=>a+Number(t.dias||0),0),interes1:tramo1.reduce((a,t)=>a+Number(t.valor||0),0),diasSuspension:tramoSuspension?Number(tramoSuspension.dias||0):0,diasInteres2:tramo2.reduce((a,t)=>a+Number(t.dias||0),0),interes2:tramo2.reduce((a,t)=>a+Number(t.valor||0),0)};
      });

      const deudaAntes={impuesto:saldosVto.reduce((a,v)=>a+Math.max(0,v.saldo),0),intereses:intCalc.liquidado,sancion:Math.max(0,saldoSancion)};
      const vencimientosExigibles=saldosVto.filter(v=>pago.fecha>v.fecha);
      const impuestoExigible=vencimientosExigibles.reduce((a,v)=>a+Math.max(0,v.saldo),0);
      const interesesExigibles=intCalc.porVto.filter(x=>vencimientosExigibles.some(v=>v.id===x.id)).reduce((a,x)=>a+Math.max(0,Number(x.interes||0)),0);
      const deudaProporcional={impuesto:impuestoExigible,intereses:interesesExigibles,sancion:Math.max(0,saldoSancion)};
      const aplicacionGlobal=this.aplicarProporcionalidad(Math.max(0,Number(pago.valor||0)),deudaProporcional);
      let impuestoRestante=Math.max(0,Number(aplicacionGlobal.impuesto||0));
      let interesesRestantes=Math.max(0,Number(aplicacionGlobal.intereses||0));
      let aplicadoImpuesto=0,aplicadoIntereses=0,aplicadoSancion=0,saldoInteresesNuevo=0;
      const aplicacionesVto=[];

      for(const v of [...vencimientosExigibles,...saldosVto.filter(v=>!vencimientosExigibles.some(e=>e.id===v.id))]){
        const interesVto=Number(intCalc.porVto.find(x=>x.id===v.id)?.interes||0);
        const impuestoAplicar=Math.min(Math.max(0,v.saldo),impuestoRestante);
        const interesAplicar=Math.min(Math.max(0,interesVto),interesesRestantes);
        v.saldo=Math.max(0,v.saldo-impuestoAplicar);
        impuestoRestante-=impuestoAplicar;interesesRestantes-=interesAplicar;aplicadoImpuesto+=impuestoAplicar;aplicadoIntereses+=interesAplicar;saldoInteresesNuevo+=Math.max(0,interesVto-interesAplicar);
        if(impuestoAplicar>0||interesAplicar>0)aplicacionesVto.push({id:v.id,aplicado:Number(impuestoAplicar||0),aplicadoIntereses:Number(interesAplicar||0),aplicadoSancion:0,saldo:v.saldo});
      }

      let remanentePago=Math.max(0,Number(pago.valor||0)-(Number(aplicadoImpuesto||0)+Number(aplicadoIntereses||0)));
      const vtoSancion=vencimientosExigibles.find(v=>v.id===idVtoSancion)||vencimientosExigibles[0]||null;
      if(vtoSancion&&Number(aplicacionGlobal.sancion||0)>0){
        aplicadoSancion=Math.min(Math.max(0,saldoSancion),Number(aplicacionGlobal.sancion||0));
        saldoSancion=Math.max(0,saldoSancion-aplicadoSancion);
        const existente=aplicacionesVto.find(x=>x.id===vtoSancion.id);
        if(existente)existente.aplicadoSancion=aplicadoSancion;else aplicacionesVto.push({id:vtoSancion.id,aplicado:0,aplicadoIntereses:0,aplicadoSancion,saldo:vtoSancion.saldo});
      }
      remanentePago=Math.max(0,remanentePago-aplicadoSancion);
      if(remanentePago>0){
        for(const v of saldosVto){
          if(vencimientosExigibles.some(e=>e.id===v.id))continue;
          if(remanentePago<=0)break;
          const aplicarFuturo=Math.min(Math.max(0,v.saldo),remanentePago);
          if(aplicarFuturo>0){v.saldo=Math.max(0,v.saldo-aplicarFuturo);aplicadoImpuesto+=aplicarFuturo;remanentePago-=aplicarFuturo;const existente=aplicacionesVto.find(x=>x.id===v.id);if(existente)existente.aplicado+=aplicarFuturo;else aplicacionesVto.push({id:v.id,aplicado:aplicarFuturo,aplicadoIntereses:0,aplicadoSancion:0,saldo:v.saldo});}
        }
      }
      saldoIntereses=roundMil(saldoInteresesNuevo);
      const aplicado={impuesto:Math.round(aplicadoImpuesto),intereses:Math.round(aplicadoIntereses),sancion:Math.round(aplicadoSancion),total:Math.round(aplicadoImpuesto+aplicadoIntereses+aplicadoSancion),excedente:0,porcentaje:Number(aplicacionGlobal.porcentaje||0),tipoProporcion:aplicacionGlobal.tipoProporcion||"POR VENCIMIENTO"};
      const excedente=Math.max(0,Number(pago.valor||0)-aplicado.total);excedenteTotal+=excedente;aplicado.excedente=excedente;
      actualizacionSancionPago.saldoDespues=roundMil(saldoSancion);
      detalle.push({pago,tasa:especial.tasa==null?this.tasaPorFecha(pago.fecha,"TASA DIAN"):especial.tasa,tasaVisible:especial.tasa==null?Number(this.tasaPorFecha(pago.fecha,"TASA DIAN")||0)*100:Number(especial.tasa)*100,tipoAplicado:pago.tipo||"TASA DIAN",beneficio:especial.beneficio?.id||null,notaBeneficio:especial.nota,interesGenerado:intCalc.liquidado,interesLiquidado:intCalc.liquidado,tramosInteres:intCalc.tramos,interesesPorCuota,deudaAntes,aplicado,excedente,aplicacionesVto,actualizacionSancion:actualizacionSancionPago,saldo:{impuesto:saldosVto.reduce((a,v)=>a+Math.max(0,v.saldo),0),intereses:saldoIntereses,sancion:Math.max(0,saldoSancion),total:saldosVto.reduce((a,v)=>a+Math.max(0,v.saldo),0)+saldoIntereses+Math.max(0,saldoSancion)}});
    }

    const impuesto=saldosVto.reduce((a,v)=>a+Math.max(0,v.saldo),0);const ultimo=detalle.at(-1)||null;
    return {tipoLiquidacion:"OFICIAL",vencimientos:saldosVto,impuesto,intereses:saldoIntereses,sancion:Math.max(0,saldoSancion),total:impuesto+saldoIntereses+Math.max(0,saldoSancion),excedente:Number(excedenteTotal||0),ultimo,detalle,advertencias:[...validacion.advertencias,...advertenciasSancion,...detalle.flatMap(x=>x.tramosInteres.filter(t=>t.advertencia).map(t=>t.advertencia))],beneficiosAplicados:[...new Set(detalle.map(x=>x.tipoAplicado).filter(t=>t&&t!=="TASA DIAN"))],reglaObligacion:validacion.regla,validacionObligacion:validacion,verificacionObligacion:this.verificarImpuestoPlastico(datos),fechaCorte:fechaCorte||pagos.at(-1)?.fecha||null,suspensionIntereses:{fechaAutoAdmisorio:auto,fechaInicioSuspension:auto?this.sumarDias(this.sumarAnos(auto,2),1):null,fechaFinSuspension:providencia||null,aplicada:!!(auto&&providencia&&providencia>=this.sumarDias(this.sumarAnos(auto,2),1))},sancionActualizacion:{fechaBase:fechaFirmezaSancion,fechaUltimaActualizacion:detalleActualizacionSancion.at(-1)?.fechaPago||fechaFirmezaSancion,saldoOriginal:roundMil(sancionBaseOriginal),saldoFinal:roundMil(saldoSancion),actualizacionAcumulada:roundMil(Math.max(0,saldoSancion-sancionBaseOriginal)),tramos:detalleActualizacionSancion}};
  }
}
