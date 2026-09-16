/**
 * Fase 15 — Auditoría y trazabilidad integral.
 *
 * No modifica la liquidación. Construye una evidencia reproducible de:
 * entrada -> validación -> régimen histórico -> depuración jurídica ->
 * impuesto declarado -> vencimientos -> pagos -> intereses -> sanciones -> saldo.
 */
export class AuditoriaTrazabilidad {
  constructor({version="FASE 15"}={}){
    this.version=version;
  }

  isoAhora(){return new Date().toISOString();}

  resumenEntrada(d={}){
    return {
      nit:d.nit||"",
      razonSocial:d.razonSocial||"",
      concepto:d.concepto||"",
      anio:Number(d.anio||0),
      periodo:d.periodo||"",
      perfilContribuyente:d.perfilContribuyente||"",
      periodicidadObligacion:d.periodicidadObligacion||"",
      fechaCorte:d.fechaCorte||null,
      vencimientos:(d.vencimientos||[]).map(v=>({numero:v.numero||null,fecha:v.fecha||null,impuesto:Number(v.impuesto||0)})),
      pagos:(d.pagos||[]).map((p,i)=>({
        consecutivo:i+1,tdj:p.tdj||"",recibo:p.recibo||"",fecha:p.fecha||null,
        valor:Number(p.valor||0),tipo:p.tipo||"",observacion:p.observacion||""
      })),
      sancion:{
        tiene:d.tieneSancion||"NO",valor:Number(d.valorSancion||0),fecha:d.fechaSancion||null,
        beneficio:d.beneficioSancion||""
      }
    };
  }

  construir({datos={},validacion=null,normativo=null,depuracion=null,determinacion=null,liquidacion=null}={}){
    const pasos=[];
    const add=(id,nombre,estado,detalle={},advertencias=[])=>pasos.push({id,nombre,estado,detalle,advertencias});
    const vOk=!!validacion && (!validacion.errores||validacion.errores.length===0);
    add("01","Entrada de datos", "COMPLETADO", this.resumenEntrada(datos));
    add("02","Validación de obligación", vOk?"APROBADO":"REQUIERE REVISION", {
      errores:validacion?.errores||[],advertencias:validacion?.advertencias||[],regla:validacion?.regla?.concepto||null
    }, validacion?.advertencias||[]);
    add("03","Régimen normativo histórico", normativo?.noAplica?"NO APLICA":(normativo?.bloqueado?"REQUIERE REVISION":(normativo?.disponible?"APROBADO":"REQUIERE REVISION")), {
      estado:normativo?.estado||null,regla:normativo?.regla||null,formulaCompatible:normativo?.formulaCompatible??null,fuente:normativo?.fuente||null,cambios:normativo?.cambios||[]
    }, normativo?.advertencias||[]);
    add("04","Depuración jurídica", depuracion?.cumplido===true?"APROBADO":"REQUIERE REVISION", {
      requeridos:depuracion?.requeridos||[],faltantes:depuracion?.faltantes||[],etiquetas:depuracion?.etiquetas||{}
    }, depuracion?.advertencias||[]);
    if(determinacion){
      // Compatibilidad con las pruebas/artefactos históricos de Fase 15/16.
      add("05","Determinación del impuesto", determinacion?.disponible?"CALCULADO":"NO CALCULADO", {
        concepto:determinacion?.concepto||datos.concepto||null,
        base:Number(determinacion?.basePesos ?? ((Number(determinacion?.base19||0)+Number(determinacion?.base5||0))||0)),
        tasa:determinacion?.tasa??null,impuesto:Number(determinacion?.impuesto||0),
        metodo:determinacion?.metodo||null,tramo:determinacion?.tramo||null,
        errores:determinacion?.errores||[],advertencias:determinacion?.advertencias||[]
      }, determinacion?.advertencias||[]);
    }else{
      add("05","Impuesto declarado", (datos.vencimientos||[]).some(v=>Number(v.impuesto||0)>0)?"REGISTRADO":"REQUIERE REVISION", {
        concepto:datos.concepto||null,
        totalDeclarado:Number((datos.vencimientos||[]).reduce((a,v)=>a+Number(v.impuesto||0),0)),
        nota:"El impuesto se recibe como dato determinado en la declaración/obligación del contribuyente. Este sistema no lo recalcula desde bases gravables."
      });
    }
    add("06","Vencimientos", (datos.vencimientos||[]).length?"REGISTRADOS":"REQUIERE REVISION", {
      cantidad:(datos.vencimientos||[]).length,
      total:Number((datos.vencimientos||[]).reduce((a,v)=>a+Number(v.impuesto||0),0)),
      items:(datos.vencimientos||[]).map(v=>({fecha:v.fecha,impuesto:Number(v.impuesto||0),numero:v.numero||null}))
    });
    add("07","Pagos históricos", "PROCESADOS", {
      cantidad:(datos.pagos||[]).length,
      total:Number((datos.pagos||[]).reduce((a,p)=>a+Number(p.valor||0),0)),
      orden:(datos.pagos||[]).map((p,i)=>({consecutivo:i+1,fecha:p.fecha,valor:Number(p.valor||0),tipo:p.tipo||""}))
    });
    const liquidacionOk=!!liquidacion;
    add("08","Liquidación histórica", liquidacionOk?"CALCULADA":"NO CALCULADA", liquidacionOk?{
      impuesto:Number(liquidacion.impuesto||0),intereses:Number(liquidacion.intereses||0),sancion:Number(liquidacion.sancion||0),total:Number(liquidacion.total||0),fechaCorte:liquidacion.fechaCorte||null
    }:{} , liquidacion?.advertencias||[]);
    add("09","Trazabilidad de pagos", liquidacionOk?"DISPONIBLE":"PENDIENTE", {
      detalle:(liquidacion?.detalle||[]).map((x,i)=>({
        consecutivo:i+1,fecha:x.pago?.fecha||null,valorPago:Number(x.pago?.valor||0),tipo:x.tipoAplicado||x.pago?.tipo||"",
        tasa:x.tasa??null,metodologia:(x.tramosInteres||[]).map(t=>t.metodologia).filter(Boolean),
        interesGenerado:Number(x.interesGenerado||0),deudaAntes:x.deudaAntes||null,aplicado:x.aplicado||null,
        aplicacionesVto:x.aplicacionesVto||[],saldo:x.saldo||null,beneficio:x.beneficio||null,notaBeneficio:x.notaBeneficio||""
      }))
    }, (liquidacion?.detalle||[]).flatMap(x=>(x.tramosInteres||[]).filter(t=>t.advertencia).map(t=>t.advertencia)));
    add("10","Saldo final", liquidacionOk?"DETERMINADO":"PENDIENTE", liquidacionOk?{
      impuesto:Number(liquidacion.impuesto||0),intereses:Number(liquidacion.intereses||0),sancion:Number(liquidacion.sancion||0),total:Number(liquidacion.total||0)
    }:{});

    const bloqueos=[];
    if(!vOk) bloqueos.push("La obligación tiene errores de validación.");
    if(normativo?.bloqueado) bloqueos.push("La vigencia normativa no está certificada para aplicación automática.");
    if(depuracion && depuracion.cumplido===false) bloqueos.push("La depuración jurídica está incompleta.");
    if(!datos.vencimientos?.length) bloqueos.push("No existen vencimientos registrados.");

    const estado=bloqueos.length?"REQUIERE REVISION":(liquidacion?"TRAZABILIDAD COMPLETA":"TRAZABILIDAD PARCIAL");
    return {
      version:this.version,generadoEn:this.isoAhora(),estado,
      identificador:this.firma(datos),
      pasos,bloqueos,
      fuentes:[
        "Datos suministrados por el usuario",
        "Reglas históricas registradas en datos/reglas-historicas.json",
        "Reglas de obligaciones registradas en datos/reglas-obligaciones.json",
        "Tasas históricas registradas en datos/tasas-moratorias.json",
        "Motor de liquidación histórica"
      ],
      nota:"La auditoría explica el camino seguido por el sistema. El valor del impuesto es suministrado por la obligación declarada; la liquidación se concentra en intereses, sanciones, pagos, imputación y saldo."
    };
  }

  firma(d={}){
    const base=[d.nit||"",d.concepto||"",d.anio||"",d.periodo||"",JSON.stringify((d.vencimientos||[]).map(v=>[v.fecha,v.impuesto])),JSON.stringify((d.pagos||[]).map(p=>[p.fecha,p.valor,p.tipo]))].join("|");
    let h=2166136261;
    for(let i=0;i<base.length;i++){h^=base.charCodeAt(i);h=Math.imul(h,16777619);}
    return `AUD-${(h>>>0).toString(16).toUpperCase().padStart(8,"0")}`;
  }

  textoPlano(a){
    const lines=[`AUDITORÍA ${a.version}`,`ID: ${a.identificador}`,`Generado: ${a.generadoEn}`,`Estado: ${a.estado}`,""];
    for(const p of a.pasos){lines.push(`${p.id}. ${p.nombre} — ${p.estado}`);if(p.detalle&&Object.keys(p.detalle).length)lines.push(JSON.stringify(p.detalle));if(p.advertencias?.length)lines.push(`ADVERTENCIAS: ${p.advertencias.join(" | ")}`);lines.push("");}
    if(a.bloqueos.length){lines.push("BLOQUEOS / REVISIONES");a.bloqueos.forEach(x=>lines.push(`- ${x}`));lines.push("");}
    lines.push(a.nota);return lines.join("\n");
  }
}
