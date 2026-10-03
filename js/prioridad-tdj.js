// PRIORIDAD DE PAGOS NORMALES FRENTE A TDJ — v16.34.06
// Esta capa NO modifica formulas de impuesto, intereses ni sancion.
// Solo ajusta el valor imputable de un TDJ anterior a pagos normales posteriores.

function esTDJ(p){
  return Boolean(String(p?.tdj||"").trim()) || p?.esTDJ===true;
}
function clavePago(p,i){return String(p?.id||("P-"+i));}
function excedentePagoNormal(resultado,id,fecha,valor){
  const d=(resultado?.detalle||[]).find(x=>x?.pago?.id===id)
    ||(resultado?.detalle||[]).find(x=>!esTDJ(x?.pago)&&String(x?.pago?.fecha||"")===String(fecha||"")&&Math.abs(Number(x?.pago?.valor||0)-Number(valor||0))<0.5);
  return Math.max(0,Number(d?.excedente||d?.aplicado?.excedente||0));
}

export function ajustarTDJParaPagosPosteriores(motor,datos,opciones={}){
  if(!motor||typeof motor.calcular!=="function")return datos;
  const originales=[...(datos?.pagos||[])].map((p,i)=>({...p,__ordenOriginal:i}));
  const tdjs=originales.filter(esTDJ).filter(p=>p.fecha&&Number(p.valor)>0);
  const normales=originales.filter(p=>!esTDJ(p)&&p.fecha&&Number(p.valor)>0);
  if(!tdjs.length)return datos;
  const ajustados=originales.map(p=>({...p}));
  const hayPosterior=t=>normales.some(p=>String(p.fecha)>String(t.fecha));
  const hayTDJPosterior=tdjs.some(hayPosterior);
  if(!hayTDJPosterior&&opciones.cerrarSaldoFinal!==true)return datos;
  const simular=()=>{
    const pagos=ajustados.map(p=>({...p}));
    const maxFecha=pagos.map(p=>p.fecha).filter(Boolean).sort().at(-1)||datos.fechaCorte||"";
    return motor.calcular({...datos,pagos,fechaCorte:maxFecha});
  };
  // REGLA GENERAL TDJ: los pagos normales posteriores deben quedar
  // completamente cubiertos. Se admite únicamente un EXCEDENTE MÁXIMO DE
  // $1.000 en el pago normal; nunca se acepta un SALDO POSITIVO.
  const todosNormalesAplicados=r=>{
    const sinExcesoMayorAMil=normales.every((p,i)=>excedentePagoNormal(r,clavePago(p,i),p.fecha,p.valor)<=1000.5);
    const saldoFinal=Math.max(0,Number(r?.total||0));
    return sinExcesoMayorAMil && saldoFinal<=0.5;
  };

  if(hayTDJPosterior) for(let pasada=0;pasada<Math.max(4,tdjs.length*3);pasada++){
    let r;
    try{r=simular();}catch{return datos;}
    if(todosNormalesAplicados(r))break;
    let normalProblema=null;
    for(let i=0;i<normales.length;i++){
      const p=normales[i];
      if(excedentePagoNormal(r,clavePago(p,i),p.fecha,p.valor)>1000.5){normalProblema=p;break;}
    }
    // También debemos intervenir cuando ningún pago normal tiene excedente,
    // pero la secuencia todavía conserva saldo positivo. Ese es precisamente
    // el caso en que el último pago queda corto por intereses generados sobre
    // el impuesto remanente después del TDJ.
    const saldoProblema=Math.max(0,Number(r?.total||0))>0.5;
    if(!normalProblema && !saldoProblema)break;
    const fechaProblema=normalProblema?.fecha
      ||normales.map(p=>p.fecha).filter(Boolean).sort().at(-1)
      ||datos.fechaCorte
      ||"9999-12-31";
    const candidatos=ajustados.filter(p=>esTDJ(p)&&p.fecha&&String(p.fecha)<=String(fechaProblema)&&Number(p.valor)>0 && (!opciones.soloTDJId || String(p.id)===String(opciones.soloTDJId)))
      .sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))||Number(b.__ordenOriginal||0)-Number(a.__ordenOriginal||0));
    const t=candidatos[0];
    if(!t)break;
    const nominal=Math.max(0,Math.trunc(Number(t.__valorNominal??t.valor??0)));
    if(t.__valorNominal==null)t.__valorNominal=nominal;
    let hi=Math.max(0,Math.trunc(Number(t.valor||0)));
    let lo=0,mejor=0;
    const esFactible=v=>{
      const anterior=t.valor;
      t.valor=Math.max(0,Math.trunc(v));
      let rr=null;
      try{rr=simular();}catch{t.valor=anterior;return false;}
      const ok=todosNormalesAplicados(rr);
      t.valor=anterior;
      return ok;
    };
    // La corrección del TDJ se expresa en MÚLTIPLOS DE $1.000.
    // Buscamos el MENOR valor del título que consigue saldo final $0 y
    // ningún pago normal posterior con excedente superior a $1.000.
    // Así el TDJ cubre exactamente el remanente necesario y conserva
    // el máximo ENDOSO posible.
    const unidad=1000;
    const hiMil=Math.floor(hi/unidad);
    const esFactibleMil=k=>esFactible(Math.min(hi,Math.max(0,k*unidad)));
    if(esFactibleMil(hiMil)){
      let bajo=0,alto=hiMil,mejorMil=hiMil;
      while(bajo<=alto){
        const mid=Math.floor((bajo+alto)/2);
        if(esFactibleMil(mid)){
          mejorMil=mid;
          alto=mid-1;
        }else{
          bajo=mid+1;
        }
      }
      mejor=mejorMil*unidad;
    }else{
      // Si ni siquiera aplicando el máximo disponible se consigue cerrar
      // la secuencia, no inventamos dinero ni forzamos un cero.
      continue;
    }
    t.valor=Math.min(nominal,Math.max(0,mejor));
  }
  // CIERRE DE SALDO RESIDUAL TDJ:
  // Si el último TDJ ya cubre la obligación y todavía conserva remanente,
  // usamos ese remanente para cerrar pequeños saldos causados por redondeo.
  // Nunca se supera el valor nominal del título y nunca se toca un TDJ que
  // deba reservarse para un pago normal posterior.
  if(opciones.cerrarSaldoFinal!==false){
    let rFinal=null;
    try{rFinal=simular();}catch{rFinal=null;}
    const saldoFinalActual=Math.max(0,Number(rFinal?.total||0));
    if(saldoFinalActual>0.5){
      const candidatosCierre=ajustados.filter(p=>
        esTDJ(p)&&p.fecha&&Number(p.valor)>0&&
        (!opciones.soloTDJId||String(p.id)===String(opciones.soloTDJId))&&
        !normales.some(n=>String(n.fecha)>String(p.fecha))
      ).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))||Number(b.__ordenOriginal||0)-Number(a.__ordenOriginal||0));
      const tCierre=candidatosCierre[0];
      if(tCierre){
        const nominal=Math.max(0,Math.trunc(Number(tCierre.__valorNominal??tCierre.valor??0)));
        const actual=Math.max(0,Math.trunc(Number(tCierre.valor||0)));
        if(nominal>actual){
          const saldoObjetivo=saldoFinalActual;
          const evaluaCierre=v=>{
            const anterior=tCierre.valor;
            tCierre.valor=Math.min(nominal,Math.max(0,Math.trunc(v)));
            let rr=null;
            try{rr=simular();}catch{rr=null;}
            tCierre.valor=anterior;
            return rr;
          };
          const maxR=evaluaCierre(nominal);
          const maxSaldo=Math.max(0,Number(maxR?.total||0));
          if(maxR && maxSaldo<=0.5){
            let lo=actual,hi=nominal,mejor=nominal;
            for(let k=0;k<40&&lo<=hi;k++){
              const mid=Math.floor((lo+hi)/2);
              const rr=evaluaCierre(mid);
              const s=Math.max(0,Number(rr?.total||0));
              if(s<=0.5){mejor=mid;hi=mid-1;}else{lo=mid+1;}
            }
            tCierre.valor=mejor;
          }
        }
      }
    }
  }

  const pagosFinales=ajustados.map(p=>{
    const q={...p};
    delete q.__ordenOriginal;
    delete q.__valorNominal;
    return q;
  });
  return {...datos,pagos:pagosFinales};
}


/**
 * Cierra un saldo residual pequeño usando ÚNICAMENTE el remanente real
 * del TDJ que ya fue entregado al motor. No aumenta el valor nominal del
 * título ni inventa dinero: reduce ENDOSO y aumenta APLICADO por el mismo
 * valor. Se admite como máximo un cierre residual de $2.000.
 */
export function cerrarSaldoResidualTDJ(resultado, valorTDJDisponible, limite=2000){
  if(!resultado||!Array.isArray(resultado.detalle))return {resultado,cerrado:0};
  const saldo=Math.max(0,Math.round(Number(resultado.total||0)));
  const disponible=Math.max(0,Math.trunc(Number(valorTDJDisponible||0)));
  if(saldo<=0 || saldo>Math.max(0,Number(limite||2000)))return {resultado,cerrado:0};
  const detalle=resultado.detalle.find(d=>String(d?.pago?.id||"") && (d?.pago?.esTDJ===true || String(d?.pago?.tdj||"").trim()!==""))
    || resultado.detalle.at(-1);
  if(!detalle)return {resultado,cerrado:0};
  const aplicadoActual=Math.max(0,Math.round(Number(detalle?.aplicado?.total||0)));
  const remanente=Math.max(0,disponible-aplicadoActual);
  if(remanente<saldo)return {resultado,cerrado:0};

  // El residual se imputa primero al impuesto; si no existe, a intereses y
  // finalmente a sanción. En todos los casos el saldo total queda en cero.
  let componente="impuesto";
  if(Number(resultado?.impuesto||0)<saldo){
    if(Number(resultado?.intereses||0)>=saldo)componente="intereses";
    else if(Number(resultado?.sancion||0)>=saldo)componente="sancion";
    else return {resultado,cerrado:0};
  }

  const aplicar=(obj,key,delta)=>{
    if(!obj)return;
    obj[key]=Math.max(0,Math.round(Number(obj[key]||0)-delta));
  };
  resultado[componente]=Math.max(0,Math.round(Number(resultado[componente]||0)-saldo));
  resultado.total=Math.max(0,Math.round(Number(resultado.total||0)-saldo));
  resultado.excedente=Math.max(0,Math.round(Number(resultado.excedente||0)-saldo));

  detalle.aplicado=detalle.aplicado||{};
  detalle.aplicado[componente]=Math.round(Number(detalle.aplicado[componente]||0)+saldo);
  detalle.aplicado.total=Math.round(Number(detalle.aplicado.total||0)+saldo);
  detalle.aplicado.excedente=Math.max(0,Math.round(Number(detalle.aplicado.excedente||0)-saldo));
  detalle.excedente=Math.max(0,Math.round(Number(detalle.excedente||0)-saldo));
  detalle.saldo=detalle.saldo||{};
  aplicar(detalle.saldo,componente,saldo);
  detalle.saldo.total=Math.max(0,Math.round(Number(detalle.saldo.total||0)-saldo));

  // Mantener la trazabilidad por vencimiento coherente con el cierre.
  const apps=Array.isArray(detalle.aplicacionesVto)?detalle.aplicacionesVto:[];
  let fila=apps.find(x=>Number(x?.saldo||0)>0);
  if(!fila && apps.length)fila=apps[0];
  if(fila){
    if(componente==="impuesto")fila.aplicado=Math.round(Number(fila.aplicado||0)+saldo);
    else if(componente==="intereses")fila.aplicadoIntereses=Math.round(Number(fila.aplicadoIntereses||0)+saldo);
    else fila.aplicadoSancion=Math.round(Number(fila.aplicadoSancion||0)+saldo);
    fila.saldo=Math.max(0,Math.round(Number(fila.saldo||0)-saldo));
  }

  resultado.ultimo=detalle;
  detalle.cierreResidualTDJ=saldo;
  detalle.notaCierreResidualTDJ="SALDO RESIDUAL CERRADO CON REMANENTE DEL TDJ. SE REDUCE EL ENDOSO EN EL MISMO VALOR.";
  return {resultado,cerrado:saldo,componente};
}

export function ordenarMovimientosCronologicos(pagos=[]){
  return [...pagos].sort((a,b)=>String(a?.fecha||"9999-12-31").localeCompare(String(b?.fecha||"9999-12-31"))
    ||Number(a?.__ordenOriginal||a?.numero||0)-Number(b?.__ordenOriginal||b?.numero||0));
}