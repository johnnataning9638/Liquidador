import {diasEntre,roundMil,fechaISO} from "./utilidades.js";
import {ActualizadorSancion} from "./actualizacion-sancion.js";

/**
 * Motor histórico y liquidación compatible con Excel V9.5.2.
 *
 * Principios:
 * - Procesa pagos cronológicamente.
 * - Conserva saldos por vencimiento, no un único saldo global.
 * - Calcula/recalcula intereses antes de imputar cada pago.
 * - Para obligaciones posteriores al 26/12/2012 reproduce la lógica de
 *   Excel V9.5.2: saldo de impuesto vigente desde el vencimiento original
 *   hasta la fecha del pago, usando la TIM de la fecha del pago.
 * - Respeta metodología histórica del interés moratorio.
 * - Los beneficios se liquidan según el tipo seleccionado en cada pago;
 *   el motor no decide ni bloquea la elegibilidad jurídica.
 * - Mantiene compatibilidad con la estructura anterior de 2 vencimientos.
 * - La sanción declarada es un saldo definitivo: nunca se incrementa al
 *   pasar de un pago a otro; los beneficios, cuando se seleccionan, se
 *   aplican sobre el saldo vigente sin reconstruir ni aumentar la sanción.
 */
export class MotorLiquidacion{
  constructor({uvt=[],intereses=[],ipc=[],tasasMoratorias=[],beneficios=[],sanciones=[],reglasObligaciones=[],reglasCalculo=null}={}){
    this.uvt=uvt;
    this.intereses=intereses;
    this.tasasMoratorias=tasasMoratorias.length?tasasMoratorias:intereses;
    this.ipc=ipc;
    this.beneficios=beneficios;
    this.sanciones=sanciones;
    this.reglasObligaciones=reglasObligaciones;
    this.reglasCalculo=reglasCalculo||null;
    this.actualizadorSancion=new ActualizadorSancion({ipc:this.ipc});
  }


  reglaObligacion(concepto){
    const c=String(concepto||"").trim().toUpperCase();
    return this.reglasObligaciones.find(r=>String(r.concepto||"").trim().toUpperCase()===c)||null;
  }

  validarObligacion(datos){
    const regla=this.reglaObligacion(datos.concepto);
    const advertencias=[];
    const errores=[];
    const anio=Number(datos.anio||0);
    const vencimientos=this.normalizarVencimientos(datos);
    if(!regla){
      advertencias.push("No existe una regla normativa específica registrada para el concepto seleccionado; no se autogeneran vencimientos.");
      return {valida:false,regla:null,errores,advertencias};
    }
    if(!String(datos.tipoLiquidacion||"").trim()) errores.push("Debe seleccionar el tipo de liquidación: PRIVADA u OFICIAL.");
    if(!["PRIVADA","OFICIAL"].includes(String(datos.tipoLiquidacion||"").trim().toUpperCase())) errores.push("El tipo de liquidación debe ser PRIVADA u OFICIAL.");
    // NIT y demás datos generales de obligación son informativos; no bloquean la liquidación.
    // REAJUSTE 16.17: perfil del contribuyente y periodicidad son datos
    // auxiliares de referencia/calendario, pero NO son campos obligatorios
    // para la liquidación matemática cuando el funcionario ya registra la
    // fecha de vencimiento y el valor de la obligación. Esto evita que un
    // campo retirado de la interfaz bloquee el cálculo.
    // Si estos valores existen en una importación o en datos históricos se
    // conservan, pero nunca condicionan la liquidación.
    if(regla.requiereSemana){
      const semana=Number(datos.semanaGmf||0);
      if(!Number.isInteger(semana)||semana<1||semana>53) advertencias.push("Para GMF se recomienda indicar la semana cuando se requiera el calendario; no bloquea la liquidación.");
    }
    if(regla.requierePesoGramos){
      const peso=Number(datos.pesoPlastico||0);
      if(peso<=0) advertencias.push("Para Productos Plásticos se requiere el peso gravable en gramos para verificar el impuesto; no se presume la base.");
    }
    if(regla.historica) advertencias.push("La obligación seleccionada corresponde a un régimen histórico; debe aplicarse la normativa vigente para el año gravable indicado.");
    if(regla.vencimientos==="NO_AUTOGENERAR"&&vencimientos.length===0) errores.push("Debe registrar al menos un vencimiento antes de calcular.");
    if(regla.periodicidad?.includes("BIMESTRAL")&&datos.periodo&&Number(datos.periodo)>6) advertencias.push("El período indicado supera seis y no corresponde a una periodicidad bimestral simple.");
    if(regla.periodicidad?.includes("MENSUAL")&&datos.periodo&&Number(datos.periodo)>12) errores.push("El período mensual debe estar entre 1 y 12.");

    // RESTRICCIÓN DE VIGENCIA DE BENEFICIOS — ART. 20 Y 21 D.1474/2025; ART. 3 Y 4 D.0240/2026.
    // La validación se hace con claves amplias y normalizadas para que no dependa
    // de diferencias de tildes, guiones, espacios o del texto OMISO/CORRECCION.
    // Para los artículos 20 D.1474 y 3 D.0240 NO se valida la fecha de
    // sanción/presentación: la vigencia temporal del beneficio se controla
    // exclusivamente por la fecha de cada pago. Para los artículos 21 y 4
    // se conserva la validación existente de fecha de sanción/presentación.
    const ventanasBeneficio=[
      {clave:"ART. 20 DECRETO 1474 DE 2025",desde:"2025-12-30",hasta:"2026-03-31",nombre:"ART. 20 DEL DECRETO 1474 DE 2025"},
      {clave:"ART. 21 DECRETO 1474 DE 2025",desde:"2025-12-30",hasta:"2026-04-30",nombre:"ART. 21 DEL DECRETO 1474 DE 2025"},
      {clave:"ART. 3 DECRETO 0240 DE 2026",desde:"2026-03-12",hasta:"2026-04-30",nombre:"ART. 3 DEL DECRETO 0240 DE 2026"},
      {clave:"ART. 4 DECRETO 0240 DE 2026",desde:"2026-03-12",hasta:"2026-04-30",nombre:"ART. 4 DEL DECRETO 0240 DE 2026"}
    ];
    const normalizarTipoBeneficio=t=>String(t??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
    const tiposBeneficio=[...(datos.pagos||[])].map(p=>normalizarTipoBeneficio(p.tipo));
    const beneficiosSeleccionados=ventanasBeneficio.filter(v=>tiposBeneficio.some(t=>t.includes(v.clave)));
    const fechaSancion=fechaISO(datos.fechaSancion)||"";
    for(const v of beneficiosSeleccionados){
      const esArt20o3 = v.clave === "ART. 20 DECRETO 1474 DE 2025"
        || v.clave === "ART. 3 DECRETO 0240 DE 2026";
      if(!esArt20o3){
        if(!fechaSancion){
          errores.push(`Para seleccionar ${v.nombre} debe registrar la fecha de sanción/presentación.`);
        }else if(fechaSancion<v.desde||fechaSancion>v.hasta){
          errores.push(`La fecha de sanción/presentación (${fechaSancion}) está fuera de la vigencia de ${v.nombre}. Vigencia permitida: ${v.desde} a ${v.hasta}.`);
        }
      }
      // SIEMPRE se valida cada pago que tenga seleccionado ese beneficio.
      (datos.pagos||[]).forEach((p,i)=>{
        const t=normalizarTipoBeneficio(p.tipo);
        if(!t.includes(v.clave))return;
        const fp=fechaISO(p.fecha)||"";
        if(!fp){
          errores.push(`El pago ${i+1}, seleccionado con ${v.nombre}, debe tener fecha de pago.`);
        }else if(fp<v.desde||fp>v.hasta){
          errores.push(`El pago ${i+1} (${fp}) seleccionado con ${v.nombre} está fuera de la vigencia. Vigencia permitida: ${v.desde} a ${v.hasta}.`);
        }
      });
    }
    // SIMPLE: el período y la estructura de vencimientos se controlan con
    // los datos diligenciados por el funcionario. No se exige seleccionar una
    // periodicidad para poder liquidar.
    if(regla.familia==="GMF") advertencias.push("GMF se controla por semanas; el campo período no sustituye la identificación de la semana del hecho generador.");
    if(vencimientos.length===0) errores.push("No hay vencimientos con fecha e impuesto válidos para liquidar.");
    const fechas=vencimientos.map(v=>v.fecha);
    if(regla.familia==="IMPUESTO_PLASTICOS"){
      const fechaMin=regla.historicaDesde||"2023-01-01";
      if(fechas.length&&fechas.some(f=>f<fechaMin)) advertencias.push("El impuesto a productos plásticos tiene tratamiento normativo desde 2023; revise el año y hecho generador antes de liquidar.");
    }
    for(let i=1;i<fechas.length;i++) if(fechas[i]===fechas[i-1]) advertencias.push("Existen vencimientos con la misma fecha; verifique que correspondan a obligaciones realmente independientes.");
    if(anio&&fechas.some(f=>Number(f.slice(0,4))<1900||Number(f.slice(0,4))>2100)) errores.push("Existe una fecha de vencimiento fuera del rango permitido.");
    return {valida:errores.length===0,regla,errores,advertencias};
  }

  uvtPorAnio(anio){
    return this.uvt.find(x=>Number(x.anio)===Number(anio))||null;
  }

  sancionMinima(anio){
    return Number(this.uvtPorAnio(anio)?.sancionMinima||0);
  }

  filaTasaPorFecha(fecha){
    const iso=fechaISO(fecha);
    if(!iso) return null;
    // IMPORTANTE: Excel V9.5.2 obtiene la tasa con MATCH(fecha, DESDE, 1).
    // Es una búsqueda aproximada sobre la columna DESDE: toma la última
    // fila cuyo DESDE sea menor o igual a la fecha, aun cuando HASTA de esa
    // fila sea anterior (por ejemplo, 31/03/2026 hereda la fila iniciada el
    // 13/03/2026 porque la siguiente fila inicia el 01/04/2026).
    // La implementación anterior exigía estar dentro de DESDE/HASTA y podía
    // dejar pagos intermedios sin tasa, provocando diferencias frente a Excel.
    const candidatos=this.tasasMoratorias
      .map((x,i)=>({x,i,d:String(x.desde||"").slice(0,10)}))
      .filter(o=>o.d&&o.d<=iso)
      .sort((a,b)=>a.d.localeCompare(b.d)||a.i-b.i);
    return candidatos.length?candidatos[candidatos.length-1].x:null;
  }

  tasaPorFecha(fecha,tipo="TASA DIAN"){
    const fila=this.filaTasaPorFecha(fecha);
    if(!fila) return null;
    const wanted=String(tipo||"TASA DIAN").trim().toUpperCase();
    const key=Object.keys(fila.tasas||{}).find(k=>String(k).trim().toUpperCase()===wanted);
    if(!key) return null;
    const value=fila.tasas[key];
    return typeof value==="number"&&Number.isFinite(value)?Math.round(value*10000)/10000:null;
  }

  metodologiaPorFecha(fecha){
    return this.filaTasaPorFecha(fecha)?.metodologia||"INTERES_SIMPLE_DIARIO";
  }

  diasDelAnio(fecha){
    const y=Number(String(fecha).slice(0,4));
    return new Date(y,1,29).getMonth()===1?366:365;
  }

  fechaMasDias(fecha,dias){
    const d=new Date(`${fecha}T00:00:00`);
    d.setDate(d.getDate()+Number(dias||0));
    return d.toISOString().slice(0,10);
  }

  interesSimple(base,tasa,desde,hasta){
    const a=fechaISO(desde),b=fechaISO(hasta);
    if(Number(base)<=0||tasa==null||!a||!b||b<=a)return 0;
    const dias=diasEntre(a,b);
    return roundMil(Number(base)*Number(tasa)/this.diasDelAnio(a)*dias);
  }

  /**
   * Calcula interés simple por tramos de tasa, sin utilizar la tasa del día
   * del pago para todo el período. Esta es la corrección clave frente a la
   * implementación anterior y reproduce la lógica histórica de la hoja de
   * cálculo: cada tramo usa la tasa vigente en ese tramo.
   */
  interesSimpleSegmentado(base,desde,hasta,{tipo="TASA DIAN",factor=1,soloMetodologias=null}={}){
    const a=fechaISO(desde),b=fechaISO(hasta);
    if(Number(base)<=0||!a||!b||b<=a)return {valor:0,dias:0,tramos:[]};

    const filas=this.tasasMoratorias.filter(x=>{
      const d=String(x.desde||"").slice(0,10),h=String(x.hasta||"").slice(0,10);
      if(!d||!h||h<a||d>=b)return false;
      return !soloMetodologias||soloMetodologias.includes(x.metodologia);
    });

    const puntos=new Set([a,b]);
    for(const f of filas){
      const d=String(f.desde).slice(0,10),h=String(f.hasta).slice(0,10);
      if(d>a&&d<b)puntos.add(d);
      const siguiente=this.fechaMasDias(h,1);
      if(siguiente>a&&siguiente<b)puntos.add(siguiente);
    }

    const orden=[...puntos].sort();
    let total=0,diasTotal=0;
    const tramos=[];
    for(let i=0;i<orden.length-1;i++){
      const s=orden[i],e=orden[i+1];
      if(e<=s)continue;
      const fila=this.filaTasaPorFecha(s);
      const tasa=fila?.tasas?.[String(tipo).trim()] ?? fila?.tasas?.["TASA DIAN"];
      const metodologia=fila?.metodologia||null;
      if(!fila||typeof tasa!=="number"||!Number.isFinite(tasa)){
        return {valor:null,dias:diasEntre(a,b),tramos,desdeSinTasa:s,hastaSinTasa:e,sinTasa:true};
      }
      if(soloMetodologias&&metodologia&&!soloMetodologias.includes(metodologia)){
        continue;
      }
      const dias=diasEntre(s,e);
      const tasaAplicada=Number(tasa)*Number(factor||1);
      const interes=roundMil(Number(base)*tasaAplicada/this.diasDelAnio(s)*dias);
      total+=interes;diasTotal+=dias;
      tramos.push({desde:s,hasta:e,dias,tasa:tasaAplicada,metodologia});
    }
    return {valor:roundMil(total),dias:diasTotal,tramos};
  }

  /**
   * Metodología histórica posterior al 29/07/2006 y hasta 25/12/2012.
   * Se conserva el interés compuesto con tasa efectiva anual segmentada.
   */
  interesCompuestoHistorico(base,desde,hasta){
    const a=fechaISO(desde),b=fechaISO(hasta);
    if(Number(base)<=0||!a||!b||b<=a)return 0;
    const corteInicio="2006-07-29";
    const corteFin="2012-12-26";
    let inicio=a>corteInicio?a:corteInicio;
    let fin=b<corteFin?b:corteFin;
    if(fin<=inicio)return 0;

    let capital=Number(base);
    const filas=this.tasasMoratorias.filter(x=>x.metodologia==="INTERES_COMPUESTO_HISTORICO");
    const puntos=new Set([inicio,fin]);
    for(const f of filas){
      const d=String(f.desde).slice(0,10),h=String(f.hasta).slice(0,10);
      if(h<inicio||d>=fin)continue;
      if(d>inicio&&d<fin)puntos.add(d);
      const siguiente=this.fechaMasDias(h,1);
      if(siguiente>inicio&&siguiente<fin)puntos.add(siguiente);
    }
    const orden=[...puntos].sort();
    let cursor=inicio;
    for(let i=0;i<orden.length-1;i++){
      const s=orden[i],e=orden[i+1];
      if(e<=s)continue;
      const fila=this.filaTasaPorFecha(s);
      const tasa=Number(fila?.tasas?.["TASA DIAN"]);
      if(!fila||fila.metodologia!=="INTERES_COMPUESTO_HISTORICO"||!Number.isFinite(tasa))return null;
      const dias=diasEntre(s,e);
      if(dias>0){ const interesTramo=roundMil(capital*(Math.pow(1+tasa,dias/365)-1)); capital+=interesTramo; }
      cursor=e;
    }
    if(cursor<fin)return null;
    return roundMil(capital-Number(base));
  }

  interesHistorico(base,fechaVto,fechaPago,tasaAplicable=null,opciones={}){
    const desde=fechaISO(fechaVto),pago=fechaISO(fechaPago);
    if(Number(base)<=0||!desde||!pago||pago<=desde)return {valor:0,metodologia:null,dias:0,tramos:[]};

    const corte1="2006-07-29", corte2="2012-12-26";
    let total=0,tramos=[];
    const factor=Number(opciones.factor||1);
    const tipo=String(opciones.tipo||"TASA DIAN");

    if(desde<corte1){
      const fin=pago<corte1?pago:corte1;
      if(fin>desde){
        if(tasaAplicable!=null){
          total+=this.interesSimple(base,Number(tasaAplicable)*factor,desde,fin);
        }else{
          const x=this.interesSimpleSegmentado(base,desde,fin,{tipo,factor,soloMetodologias:["INTERES_SIMPLE_HISTORICO"]});
          if(x.valor==null)return {valor:null,metodologia:"INTERES_SIMPLE_HISTORICO",dias:diasEntre(desde,pago),tramos:x.tramos,sinTasa:true};
          total+=x.valor;tramos.push(...x.tramos);
        }
      }
      if(pago<=corte1)return {valor:roundMil(total),metodologia:"INTERES_SIMPLE_HISTORICO",dias:diasEntre(desde,pago),tramos};
    }

    const inicioComp=desde<corte1?corte1:desde;
    if(inicioComp<corte2 && pago>inicioComp){
      const fin=pago<corte2?pago:corte2;
      const comp=this.interesCompuestoHistorico(base,inicioComp,fin);
      if(comp==null)return {valor:null,metodologia:"INTERES_COMPUESTO_HISTORICO",dias:diasEntre(desde,pago),tramos,sinTasa:true};
      total+=comp;
      if(pago<=corte2)return {valor:roundMil(total),metodologia:"INTERES_COMPUESTO_HISTORICO",dias:diasEntre(desde,pago),tramos};
    }

    const inicioSimple=pago>corte2?(fechaISO(fechaVto)>corte2?fechaISO(fechaVto):corte2):null;
    if(inicioSimple&&pago>inicioSimple){
      if(tasaAplicable!=null){
        total+=this.interesSimple(base,Number(tasaAplicable)*factor,inicioSimple,pago);
      }else{
        const x=this.interesSimpleSegmentado(base,inicioSimple,pago,{tipo,factor,soloMetodologias:["INTERES_SIMPLE_DIARIO"]});
        if(x.valor==null)return {valor:null,metodologia:"INTERES_SIMPLE_DIARIO",dias:diasEntre(desde,pago),tramos,sinTasa:true};
        total+=x.valor;tramos.push(...x.tramos);
      }
    }
    return {valor:roundMil(total),metodologia:pago>corte2?"MIXTA_HISTORICA":"INTERES_COMPUESTO_HISTORICO",dias:diasEntre(desde,pago),tramos};
  }

  beneficioPorTipo(tipo){
    const t=String(tipo||"").trim().toUpperCase();
    return this.beneficios.find(b=>String(b.nombre||"").trim().toUpperCase()===t || String(b.id||"").trim().toUpperCase()===t)||null;
  }

  /**
   * Determina exclusivamente el tratamiento matemático escogido por quien
   * realiza la liquidación. No verifica si el contribuyente cumple o no los
   * requisitos jurídicos del beneficio: la selección del TIPO en cada pago
   * es la instrucción para liquidar con ese tratamiento.
   *
   * Las tasas especiales se mantienen aun cuando la fecha del pago esté
   * fuera de la ventana legal, porque este formulario permite hacer una
   * liquidación bajo el criterio escogido por el liquidador.
   */
  tasaEspecial(tipo,fechaPago){
    const t=String(tipo||"TASA DIAN").trim().toUpperCase();
    const tim=this.tasaPorFecha(fechaPago,"TASA DIAN");
    const beneficio=this.beneficioPorTipo(t);
    const redondear4=n=>Math.round(Number(n)*10000)/10000;
    const es=needle=>t.includes(needle);

    // Los cuatro tratamientos de los Decretos 1474/2025 y 0240/2026 se
    // aplican por decisión del liquidador, sin validar vigencia o requisitos.
    // Sus tratamientos matemáticos son los mismos que aparecen en las
    // columnas correspondientes de la hoja "Tasa de Interés" del Excel.
    if(es("DECRETO 1474") && es("ART. 20")){
      return {tasa:0.045,factor:1,tasaFija:0.045,beneficio,
        factorSancion:0.15,reduceSancion:true,
        actualizaSancion:true,
        nota:"ART. 20 D1474 seleccionado: interés al 4,500% anual y sanción/actualización reducida al 15%, respetando la sanción mínima"};
    }
    if(es("DECRETO 1474") && es("ART. 21")){
      // OMISO / CORRECCIÓN: la sanción que llega a este motor es la que el
      // contribuyente ya liquidó (y, cuando corresponde, ya redujo) en la
      // declaración. El motor NO puede volver a aplicarle el 15%.
      // El beneficio del Art. 21 sí modifica el tratamiento de intereses:
      // no se liquidan intereses de mora.
      return {tasa:0,factor:0,tasaFija:0,beneficio,
        factorSancion:1,reduceSancion:false,
        nota:"ART. 21 D1474 seleccionado: interés 0%; la sanción declarada no se vuelve a reducir"};
    }
    if(es("DECRETO 0240") && es("ART. 3")){
      return {tasa:0.045,factor:1,tasaFija:0.045,beneficio,
        factorSancion:0.15,reduceSancion:true,
        actualizaSancion:true,
        nota:"ART. 3 D0240 seleccionado: interés al 4,500% anual y sanción/actualización reducida al 15%, respetando la sanción mínima"};
    }
    if(es("DECRETO 0240") && es("ART. 4")){
      // OMISO / CORRECCIÓN: la sanción ya fue liquidada/reducida por el
      // contribuyente en la declaración. Este motor no la vuelve a reducir.
      // El efecto del Art. 4 que corresponde a esta etapa es interés de mora = 0.
      return {tasa:0,factor:0,tasaFija:0,beneficio,
        factorSancion:1,reduceSancion:false,
        nota:"ART. 4 D0240 seleccionado: interés 0%; la sanción declarada no se vuelve a reducir"};
    }

    if(es("LEY 2277") && es("ART. 91")){
      const tasa=tim==null?null:redondear4(Number(tim)*0.5);
      return {tasa,factor:0.5,tasaFija:null,beneficio,
        factorSancion:1,reduceSancion:false,
        nota:"ART. 91 Ley 2277 seleccionado: 50% de la TIM, redondeada a 4 decimales"};
    }
    if(es("LEY 2277") && es("ART. 93")){
      const tasa=tim==null?null:redondear4(Number(tim)*0.4);
      return {tasa,factor:0.4,tasaFija:null,beneficio,
        factorSancion:0.4,reduceSancion:true,
        nota:"ART. 93 Ley 2277 seleccionado: 40% del interés y 40% de la sanción"};
    }
    if(es("LEY 2155") && es("ART. 45")){
      const tasa=tim==null?null:redondear4(((Number(tim)+0.02)/1.5)*0.20);
      return {tasa,factor:1,tasaFija:tasa,beneficio,
        factorSancion:0.20,reduceSancion:true,
        nota:"ART. 45 Ley 2155 seleccionado: 20% de la tasa derivada (TIM + 2%) / 1,5 y 20% de la sanción"};
    }
    if(es("ART. 48 LEY 2155") || es("DECRETO 688 DE 2020")){
      const tasa=tim==null?null:redondear4((Number(tim)+0.02)/1.5);
      return {tasa,factor:1,tasaFija:tasa,beneficio,
        factorSancion:1,reduceSancion:false,
        nota:"Tasa derivada según Excel: ROUND((TIM + 2%) / 1,5; 4)"};
    }
    if(es("ART. 120 LEY 2010")){
      const tasa=tim==null?null:redondear4(((Number(tim)+0.02)/1.5)+0.02);
      return {tasa,factor:1,tasaFija:tasa,beneficio,
        factorSancion:1,reduceSancion:false,
        nota:"Tasa derivada según Excel: ROUND((TIM + 2%) / 1,5 + 2%; 4)"};
    }
    return {tasa:tim,factor:1,tasaFija:null,beneficio:null,reduceSancion:false,factorSancion:1,nota:"TASA DIAN ordinaria"};
  }

  anioSancionParaMinima(datos,esArt20o3=false){
    const fecha=fechaISO(datos?.fechaSancion)||"";
    if(esArt20o3){
      const anio=Number(fecha.slice(0,4));
      return anio||2026;
    }
    const vtos=this.normalizarVencimientos(datos);
    return Number(String(vtos[0]?.fecha||fecha||"").slice(0,4))||Number(datos?.anio||0);
  }

  sancionConBeneficio(sancionActual,datos,especial,{habilitado=true}={}){
    const actual=Math.max(0,Number(sancionActual||0));
    if(!actual || !especial?.reduceSancion || !habilitado)return actual;

    // Para Art. 20 D.1474 y Art. 3 D.0240 la norma reduce la SANCION Y
    // ACTUALIZACION al 15%. La base para la reducción es la sanción ya
    // actualizada a la fecha del pago. Si el 15% resulta inferior a la
    // sanción mínima del año en que fue liquidada, se aplica la mínima.
    const tPagos=(datos?.pagos||[]).map(p=>String(p?.tipo||"").toUpperCase());
    const esArt20o3=tPagos.some(t=>t.includes("ART. 20 DECRETO 1474")||t.includes("ART. 3 DECRETO 0240"));
    const anioMinima=this.anioSancionParaMinima(datos,esArt20o3);
    const minima=Math.max(0,Number(this.sancionMinima(anioMinima)||0));
    const factor=Number(especial.factorSancion||1);
    const reducida=roundMil(actual*factor);
    const conPiso=Math.max(reducida,minima);
    return Math.min(actual,conPiso);
  }

  /**
   * Puente de compatibilidad hacia el módulo independiente de sanciones.
   * No reconstruye la sanción ni aplica sanción mínima sobre un saldo ya
   * determinado.
   */
  sancionActualizada(base,fechaInicio,fechaCorte,origen=""){
    return this.actualizadorSancion.calcular(base,fechaInicio,fechaCorte);
  }

  determinarProporcion(impuesto,intereses,sancion){
    if(impuesto>=intereses&&impuesto>=sancion)return "Impuesto mayor";
    if(intereses>=impuesto&&intereses>=sancion)return "Interés mayor";
    return "Sanción mayor";
  }

  aplicarProporcionalidad(pago,deuda){
    const B=Math.max(0,Number(pago||0));
    const impuesto=Math.max(0,Number(deuda.impuesto||0));
    const intereses=Math.max(0,Number(deuda.intereses||0));
    const sancion=Math.max(0,Number(deuda.sancion||0));
    const total=impuesto+intereses+sancion;
    if(B<=0||total<=0)return {impuesto:0,intereses:0,sancion:0,total:0,excedente:B,porcentaje:0,tipoProporcion:null};
    const aplicado=Math.min(B,total);
    // Reproducción de la lógica de DOS VENCIMIENTOS del Excel V9.5.2:
    // factor = pago/deuda total, expresado en porcentaje y redondeado a 4
    // decimales; los componentes no dominantes se redondean HACIA ARRIBA
    // a miles y el componente dominante absorbe el remanente.
    const porcentaje=Math.min(100,Math.round(aplicado*100/total*10000)/10000);
    let tipoProporcion;
    if(impuesto>intereses){
      tipoProporcion=impuesto>sancion?"Impuesto mayor":"Sanción mayor";
    }else{
      tipoProporcion=intereses>sancion?"Interés mayor":"Sanción mayor";
    }
    const rupMil=n=>Math.ceil((Number(n)||0)/1000)*1000;
    let ai=0,aa=0,as=0;
    if(tipoProporcion==="Impuesto mayor") {
      aa=Math.min(intereses,rupMil(porcentaje/100*intereses));
      as=Math.min(sancion,rupMil(porcentaje/100*sancion));
      ai=Math.max(0,aplicado-aa-as);
      ai=Math.min(ai,impuesto);
    }else if(tipoProporcion==="Interés mayor") {
      ai=Math.min(impuesto,rupMil(porcentaje/100*impuesto));
      as=Math.min(sancion,rupMil(porcentaje/100*sancion));
      aa=Math.max(0,aplicado-ai-as);
      aa=Math.min(aa,intereses);
    }else {
      ai=Math.min(impuesto,rupMil(porcentaje/100*impuesto));
      aa=Math.min(intereses,rupMil(porcentaje/100*intereses));
      as=Math.max(0,aplicado-ai-aa);
      as=Math.min(as,sancion);
    }
    // Ajuste de seguridad si los topes de los componentes produjeron una
    // diferencia por redondeo. Nunca se asigna más de lo adeudado.
    let suma=ai+aa+as;
    let faltante=aplicado-suma;
    if(faltante>0){
      const orden=tipoProporcion==="Impuesto mayor"?["impuesto","intereses","sancion"]:
                  tipoProporcion==="Interés mayor"?["intereses","impuesto","sancion"]:
                  ["sancion","impuesto","intereses"];
      for(const k of orden){
        const limite={impuesto,intereses,sancion}[k];
        const actual={impuesto:ai,intereses:aa,sancion:as}[k];
        const add=Math.min(faltante,Math.max(0,limite-actual));
        if(k==="impuesto")ai+=add; else if(k==="intereses")aa+=add; else as+=add;
        faltante-=add;
        if(faltante<=0)break;
      }
      suma=ai+aa+as;
    }
    return {impuesto:Math.round(ai),intereses:Math.round(aa),sancion:Math.round(as),total:Math.round(suma),excedente:Math.max(0,B-suma),porcentaje,tipoProporcion};
  }

  normalizarVencimientos(datos){
    if(Array.isArray(datos.vencimientos)&&datos.vencimientos.length){
      return datos.vencimientos.map((v,i)=>({
        id:v.id||`VTO-${i+1}`,
        fecha:fechaISO(v.fecha||v.fechaVto),
        impuesto:Math.max(0,Number(v.impuesto??v.valor??0)),
        concepto:v.concepto||datos.concepto||"",
        periodo:v.periodo||datos.periodo||""
      })).filter(v=>v.fecha&&v.impuesto>0).sort((a,b)=>a.fecha.localeCompare(b.fecha));
    }
    return [
      {id:"VTO-1",fecha:fechaISO(datos.fechaVto1),impuesto:Math.max(0,Number(datos.impuestoVto1||0)),concepto:datos.concepto||"",periodo:datos.periodo||""},
      {id:"VTO-2",fecha:fechaISO(datos.fechaVto2),impuesto:Math.max(0,Number(datos.impuestoVto2||0)),concepto:datos.concepto||"",periodo:datos.periodo||""}
    ].filter(v=>v.fecha&&v.impuesto>0).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  }

  verificarImpuestoPlastico(datos){
    if(String(datos.concepto||"").trim().toUpperCase()!=="PRODUCTOS PLASTICOS") return null;
    const peso=Number(datos.pesoPlastico||0);
    const anio=Number(datos.anio||0);
    const uvt=this.uvtPorAnio(anio);
    if(peso<=0||!uvt) return {disponible:false,peso,uvt:null,valor:null,nota:"No es posible verificar la base sin peso en gramos y UVT del año."};
    const tarifa=0.00005;
    const valor=peso*Number(uvt.valor||0)*tarifa;
    return {disponible:true,peso,uvt:Number(uvt.valor),tarifa,valor,nota:"Verificación matemática de referencia; revisar exclusiones y hecho generador."};
  }

  /** Fase 9: expone la determinación matemática sin alterar la liquidación moratoria. */
  determinarImpuesto(datos, calculador){
    if(!calculador||typeof calculador.calcular!=="function") return {disponible:false,concepto:datos?.concepto||"",errores:["No está disponible el módulo de determinación matemática de impuestos."],advertencias:[]};
    return calculador.calcular(datos);
  }

  /**
   * Reproduce la lógica observada en el libro Excel V9.5.2 para obligaciones
   * posteriores al 26/12/2012: en cada pago se vuelve a liquidar el interés
   * sobre el saldo de impuesto vigente de cada vencimiento, desde su
   * vencimiento original hasta la fecha del pago, utilizando la TIM vigente
   * en la fecha del pago. No se suma nuevamente el interés residual anterior;
   * este queda sustituido por la nueva liquidación sobre el capital pendiente.
   *
   * Ejemplo del Excel actualizado suministrado:
   * $7.677.000 × 27,66% × 260/365 = $1.512.600,36 → $1.513.000.
   */
  interesExcelPost2012(base,fechaVto,fechaPago,{tipo="TASA DIAN",factor=1,tasaFija=null}={}){
    const a=fechaISO(fechaVto),b=fechaISO(fechaPago);
    if(Number(base)<=0||!a||!b||b<=a)return {valor:0,dias:0,tasa:null,metodologia:"INTERES_SIMPLE_DIARIO_EXCEL"};
    const tasa=tasaFija!=null?Number(tasaFija):this.tasaPorFecha(b,tipo);
    if(!Number.isFinite(tasa)) return {valor:null,dias:diasEntre(a,b),tasa:null,metodologia:"INTERES_SIMPLE_DIARIO_EXCEL",sinTasa:true};
    const tasaAplicada=tasa*Number(factor||1);
    const dias=diasEntre(a,b);
    const valor=roundMil(Number(base)*tasaAplicada/this.diasDelAnio(b)*dias);
    return {valor,dias,tasa:tasaAplicada,metodologia:"INTERES_SIMPLE_DIARIO_EXCEL",tramos:[{desde:a,hasta:b,dias,tasa:tasaAplicada,metodologia:"INTERES_SIMPLE_DIARIO_EXCEL"}]};
  }

  interesParaPago(base,fechaVto,fechaPago,{tipo="TASA DIAN",factor=1,tasaFija=null}={}){
    const vto=fechaISO(fechaVto),pago=fechaISO(fechaPago);
    if(!vto||!pago||pago<=vto||Number(base)<=0)return {valor:0,dias:0,metodologia:null,tramos:[]};
    // La hoja Excel V9.5.2 usa esta lógica para el período posterior al
    // 26/12/2012: tasa de la fecha de pago aplicada a todos los días de mora.
    if(vto>="2012-12-26") return this.interesExcelPost2012(base,vto,pago,{tipo,factor,tasaFija});
    // Para obligaciones históricas anteriores al corte se conserva el motor
    // histórico compuesto/simple ya investigado, pero partiendo siempre del
    // vencimiento original de la obligación.
    const tasaAplicable=tasaFija!=null?Number(tasaFija):null;
    return this.interesHistorico(base,vto,pago,tasaAplicable,{factor,tipo});
  }

  calcular(datos){
    const validacion=this.validarObligacion(datos);
    if(validacion.errores.length) throw new Error(validacion.errores.join(" "));

    const vencimientos=this.normalizarVencimientos(datos);
    const fechaCorte=fechaISO(datos.fechaCorte)||null;
    const pagos=[...(datos.pagos||[])]
      .map((p,i)=>({...p,fecha:fechaISO(p.fecha),valor:Number(p.valor||0),ordenOriginal:i}))
      .filter(p=>p.fecha&&p.valor>0&&(fechaCorte?! (p.fecha>fechaCorte):true))
      .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.ordenOriginal-b.ordenOriginal);

    /*
     * IMPORTANTE — diferencia que encontramos frente al cálculo anterior:
     *
     * Excel V9.5.2 no reparte un pago contra la deuda TOTAL de todos los
     * vencimientos. Lo procesa por vencimiento, en orden cronológico:
     * 1. calcula la deuda (impuesto + interés + sanción) de VTO-1;
     * 2. aplica allí la proporcionalidad;
     * 3. si sobra dinero, continúa con VTO-2, VTO-3, etc.
     *
     * Esto explica exactamente el caso del soporte:
     *   VTO-1 = $30.000.000 y VTO-2 = $20.000.000.
     * El pago de $25.000.000 no se reparte sobre $50.000.000: primero
     * consume proporcionalmente la deuda de VTO-1.
     */

    const saldosVto=vencimientos.map((v,i)=>({
      ...v,
      numero:Number(v.numero||i+1),
      saldo:Math.max(0,Number(v.impuesto||0))
    }));

    const sancionBaseOriginal=datos.tieneSancion==="SI"?Number(datos.valorSancion||0):0;
    const fechaSancion=fechaISO(datos.fechaSancion)||saldosVto[0]?.fecha||"";
    // FIX: esta bandera se usa también al determinar la sanción mínima inicial.
    // Antes se utilizaba en este alcance sin declararla, provocando en producción
    // el error JavaScript: "esArt20o3 is not defined" y bloqueando toda
    // liquidación privada con sanción.
    const tiposPagoInicial=(datos?.pagos||[]).map(p=>String(p?.tipo||"").toUpperCase());
    const esArt20o3=tiposPagoInicial.some(t=>
      t.includes("ART. 20 DECRETO 1474") ||
      t.includes("ART. 3 DECRETO 0240")
    );
    // La sanción que llega desde la declaración ya incorpora, cuando corresponde,
    // la reducción que hizo el contribuyente. El motor NO vuelve a aplicar 15 %.
    // Única excepción: si el valor declarado es inferior a la sanción mínima del
    // año de la declaración, se eleva a esa mínima. A partir de allí se conserva
    // la actualización anual por Art. 867-1 cuando corresponda.
    let saldoSancion=sancionBaseOriginal;
    if(saldoSancion>0){
      const anioMinimaInicial=esArt20o3
        ?(Number(fechaSancion.slice(0,4))||2026)
        :(Number(String(saldosVto[0]?.fecha||fechaSancion||"").slice(0,4))||Number(datos.anio||0));
      const minimaInicial=this.sancionMinima(anioMinimaInicial);
      if(minimaInicial>0 && saldoSancion<minimaInicial){
        saldoSancion=minimaInicial;
      }
    }
    let fechaUltimaActualizacionSancion=fechaSancion;
    let detalleActualizacionSancion=[];
    let advertenciasSancion=[];
    // Años de actualización de sanción ya aplicados. La sanción solo debe
    // actualizarse una vez por cada vigencia anual, aunque existan varios
    // pagos dentro del mismo año.
    const aniosActualizacionSancionAplicados=new Set();

    // En DOS VENCIMIENTOS la sanción se carga al primer vencimiento.
    const idVtoSancion=saldosVto[0]?.id||null;

    let saldoIntereses=0;
    let excedenteTotal=0;
    let primerBeneficioDecretoUsado=false;
    const detalle=[];

    const esBeneficioDecreto=tipo=>{
      const t=String(tipo||"").toUpperCase();
      return t.includes("ART. 20 DECRETO 1474")
        ||t.includes("ART. 21 DECRETO 1474")
        ||t.includes("ART. 3 DECRETO 0240")
        ||t.includes("ART. 4 DECRETO 0240");
    };

    const calcularInteresesAntesPago=(pago)=>{
      let liquidado=0;
      const tramos=[];
      const porVto=[];

      for(const v of saldosVto){
        let valor=0;
        let tramoVto=[];

        if(v.saldo>0 && pago.fecha>v.fecha){
          const especial=this.tasaEspecial(pago.tipo,pago.fecha);

          if(especial.requiereDato){
            tramoVto=[{
              vto:v.id,
              base:Number(v.saldo||0),
              valor:null,
              metodologia:"BENEFICIO_REQUIERE_IBC",
              advertencia:"El artículo 45 de la Ley 2155 exige IBC histórico; el motor no lo sustituye por la TIM."
            }];
          }else if(especial.tasa!=null && Number(especial.tasa)===0){
            tramoVto=[{vto:v.id,base:Number(v.saldo||0),valor:0,metodologia:"TASA_ESPECIAL_CERO",dias:diasEntre(v.fecha,pago.fecha),desde:v.fecha,hasta:pago.fecha,tasa:0,aplica:true}];
          }else if(Number(especial.tasa)!==0){
            let tasaFija=null;
            const factor=Number(especial.factor||1);
            if(especial.factor===1&&especial.tasa!=null)tasaFija=Number(especial.tasa);

            const ih=this.interesParaPago(v.saldo,v.fecha,pago.fecha,{
              tipo:"TASA DIAN",
              factor,
              tasaFija
            });

            if(ih.valor==null){
              tramoVto=[{
                vto:v.id,
                base:Number(v.saldo||0),
                valor:null,
                metodologia:ih.metodologia,
                advertencia:"No hay tasa histórica suficiente para cerrar este tramo."
              }];
            }else{
              valor=Number(ih.valor||0);
              tramoVto=(ih.tramos||[{
                vto:v.id,
                valor:valor,
                metodologia:ih.metodologia,
                dias:ih.dias,
                desde:v.fecha,
                hasta:pago.fecha,
                tasa:ih.tasa
              }]).map(t=>({...t,base:Number(v.saldo||0)}));
            }
          }
        }

        liquidado+=valor;
        tramos.push(...tramoVto);
        porVto.push({
          id:v.id,
          interes:Math.max(0,Number(valor||0)),
          tramos:tramoVto
        });
      }

      return {
        liquidado:roundMil(liquidado),
        tramos,
        porVto
      };
    };

    for(const pago of pagos){
      const especial=this.tasaEspecial(pago.tipo,pago.fecha);
      // Trazabilidad de actualización de sanción específica de este pago.
      // Se conserva separada del acumulado general para que PDF y Excel
      // puedan mostrar exactamente dónde, cuándo y cuánto se actualizó.
      const actualizacionSancionPago={
        aplicada:false,
        fechaPago:pago.fecha,
        saldoAntes:roundMil(saldoSancion),
        saldoDespues:roundMil(saldoSancion),
        actualizacionTotal:0,
        tramos:[],
        eventos:[]
      };

      // Interés vigente para cada vencimiento antes de imputar el pago.
      // La deuda de interés solo se genera sobre vencimientos ya exigibles.
      const intCalc=calcularInteresesAntesPago(pago);

      // ACTUALIZACIÓN INDEPENDIENTE DE SANCIÓN (Art. 867-1 E.T.).
      // La sanción base es definitiva: primero se actualiza únicamente el
      // saldo pendiente, y después se procesa el pago. Nunca se reconstruye
      // la sanción desde la base tributaria ni desde la sanción mínima.
      if(saldoSancion>0 && fechaSancion && pago.fecha>fechaSancion){
        // IMPORTANTE: se parte siempre de la fecha original de sanción, pero
        // se excluyen las vigencias anuales ya aplicadas en pagos anteriores.
        // Así, si P2 y P3 son del mismo año, P3 NO vuelve a actualizar la
        // sanción; si el siguiente pago cae en un nuevo año, solo incorpora
        // la(s) vigencia(s) nuevas que correspondan.
        const act=this.actualizadorSancion.calcular(
          saldoSancion,
          fechaSancion,
          pago.fecha,
          {aniosExcluir:[...aniosActualizacionSancionAplicados]}
        );
        if(act.valor>saldoSancion){
          saldoSancion=act.valor;
          const ultimoTramo=act.tramos?.at(-1);
          fechaUltimaActualizacionSancion=ultimoTramo?.hasta||fechaUltimaActualizacionSancion;
        }
        if(act.tramos?.length){
          act.tramos.forEach(t=>aniosActualizacionSancionAplicados.add(Number(t.anio)));
          detalleActualizacionSancion.push({fechaPago:pago.fecha,...act});
          actualizacionSancionPago.aplicada=true;
          actualizacionSancionPago.tramos=act.tramos.map(t=>({
            anio:Number(t.anio),
            desde:t.desde,
            hasta:t.hasta,
            dias:Number(t.dias||0),
            saldoAntes:roundMil(t.saldoInicial||0),
            actualizacion:roundMil(t.actualizacion||0),
            saldoDespues:roundMil(t.saldoFinal||0),
            ipc:Number(t.ipc||0),
            ipcPorcentaje:Number(t.ipcPorcentaje||0),
            disponible:t.disponible!==false
          }));
          actualizacionSancionPago.actualizacionTotal=roundMil(
            actualizacionSancionPago.tramos.reduce((a,t)=>a+Number(t.actualizacion||0),0)
          );
        }
        advertenciasSancion.push(...(act.advertencias||[]));
      }

      // ART. 20 D.1474 / ART. 3 D.0240: actualizar primero y luego reducir
      // sanción + actualización al 15%. Se ejecuta una sola vez, en el primer
      // pago que seleccione uno de estos tratamientos. La sanción mínima es
      // el piso final exigido por la norma.
      if(!primerBeneficioDecretoUsado && especial.reduceSancion &&
         (String(pago.tipo||"").toUpperCase().includes("ART. 20 DECRETO 1474") ||
          String(pago.tipo||"").toUpperCase().includes("ART. 3 DECRETO 0240")) && saldoSancion>0){
        const anioMinima=this.anioSancionParaMinima(datos,true);
        const minima=Math.max(0,Number(this.sancionMinima(anioMinima)||0));
        const saldoActualizado=Number(saldoSancion||0);
        const reducido=roundMil(saldoActualizado*Number(especial.factorSancion||0.15));
        const sancionFinal=Math.max(reducido,minima);
        saldoSancion=roundMil(sancionFinal);
        primerBeneficioDecretoUsado=true;
        detalleActualizacionSancion.push({
          fechaPago:pago.fecha,
          beneficio:pago.tipo,
          saldoAntesReduccion:roundMil(saldoActualizado),
          porcentajeReduccion:Number(especial.factorSancion||0.15)*100,
          valorReducido:reducido,
          sancionMinima:minima,
          saldoDespuesReduccion:saldoSancion,
          actualizacionPrevia:roundMil(Math.max(0,saldoActualizado-sancionBaseOriginal))
        });
        actualizacionSancionPago.eventos.push({
          tipo:'REDUCCION POR BENEFICIO',
          beneficio:pago.tipo,
          saldoAntes:roundMil(saldoActualizado),
          actualizacionPrevia:roundMil(Math.max(0,saldoActualizado-sancionBaseOriginal)),
          porcentaje:Number(especial.factorSancion||0.15)*100,
          valorReducido:reducido,
          sancionMinima:minima,
          saldoDespues:roundMil(saldoSancion)
        });
      }

      // IMPORTANTE: Art. 21 D1474 y Art. 4 D0240 no alteran la sanción en este
      // la sanción dentro de este motor. La sanción declarada ya trae la
      // reducción efectuada al presentar la declaración. La única intervención
      // excepcional es el piso de sanción mínima, aplicado al iniciar la
      // obligación cuando el valor declarado era inferior a la mínima del año.
      // La actualización anual por Art. 867-1 se ejecuta independientemente.

      // Capturamos el capital vigente ANTES de aplicar el pago. Esta instantánea
      // es la fuente del detalle de intereses por cuota para pantalla, Excel y PDF.
      // No se toma desde r.vencimientos al final de la liquidación porque allí
      // los saldos ya pueden haber quedado en cero.
      const interesesPorCuota=saldosVto.map(v=>{
        const calc=intCalc.porVto.find(z=>z.id===v.id)||{};
        const tramo=(calc.tramos||[])[0]||{};
        const base=Math.max(0,Number(v.saldo||0));
        const aplica=base>0 && pago.fecha>v.fecha;
        return {
          cuota:Number(v.numero||0),
          vto:v.id,
          capitalBase:base,
          fechaVencimiento:v.fecha,
          fechaPago:pago.fecha,
          dias:aplica?Number(tramo.dias??diasEntre(v.fecha,pago.fecha)):0,
          tasa:tramo.tasa==null
            ?(aplica && especial.tasa!=null?Number(especial.tasa)*Number(especial.factor||1):
              (aplica?Number(this.tasaPorFecha(pago.fecha,"TASA DIAN")||0):0))
            :Number(tramo.tasa),
          interes:Math.max(0,Number(calc.interes||0)),
          metodologia:tramo.metodologia||
            (aplica?(especial.tasa===0?"TASA_ESPECIAL_CERO":"INTERES_SIMPLE_DIARIO_EXCEL"):"NO EXIGIBLE"),
          aplica
        };
      });

      const deudaAntes={
        impuesto:saldosVto.reduce((a,v)=>a+Math.max(0,v.saldo),0),
        intereses:intCalc.liquidado,
        sancion:Math.max(0,saldoSancion)
      };

      /*
       * PROPORCIONALIDAD GLOBAL DE LA OBLIGACIÓN EXIGIBLE:
       *
       * El Excel de referencia calcula la proporción sobre el conjunto de
       * vencimientos que ya están exigibles a la fecha del pago. Después,
       * el componente impuesto resultante se imputa en orden cronológico a
       * los vencimientos, comenzando por el más antiguo.
       *
       * Esto es distinto de calcular una proporción independiente para cada
       * vencimiento. La diferencia aparece cuando existen varios vencimientos
       * vencidos en una misma fecha de pago (caso del soporte MASSTRONIC).
       * Los vencimientos futuros siguen formando parte del saldo total, pero
       * no participan en la proporcionalidad de un pago anterior a su fecha.
       */
      const vencimientosExigibles=saldosVto.filter(v=>pago.fecha>v.fecha);
      const baseProporcional=vencimientosExigibles.length===1
        ?vencimientosExigibles
        :vencimientosExigibles;
      const impuestoExigible=baseProporcional.reduce((a,v)=>a+Math.max(0,v.saldo),0);
      const interesesExigibles=intCalc.porVto
        .filter(x=>baseProporcional.some(v=>v.id===x.id))
        .reduce((a,x)=>a+Math.max(0,Number(x.interes||0)),0);
      const deudaProporcional={
        impuesto:impuestoExigible,
        intereses:interesesExigibles,
        sancion:Math.max(0,saldoSancion)
      };

      const aplicacionGlobal=this.aplicarProporcionalidad(
        Math.max(0,Number(pago.valor||0)),
        deudaProporcional
      );

      let impuestoRestante=Math.max(0,Number(aplicacionGlobal.impuesto||0));
      let interesesRestantes=Math.max(0,Number(aplicacionGlobal.intereses||0));
      let aplicadoImpuesto=0;
      let aplicadoIntereses=0;
      let aplicadoSancion=0;
      let saldoInteresesNuevo=0;
      const aplicacionesVto=[];

      // El impuesto aplicado se distribuye por vencimiento, del más antiguo
      // al más reciente. Primero se atienden los vencimientos exigibles; si
      // queda componente de impuesto por imputar, el remanente puede pasar a
      // vencimientos posteriores, tal como ocurre cuando un pago cubre por
      // completo la obligación vencida y alcanza la siguiente cuota.
      for(const v of [...vencimientosExigibles,...saldosVto.filter(v=>!vencimientosExigibles.some(e=>e.id===v.id))]){
        const interesVto=Number(
          intCalc.porVto.find(x=>x.id===v.id)?.interes||0
        );
        const impuestoAplicar=Math.min(
          Math.max(0,v.saldo),
          impuestoRestante
        );
        const interesAplicar=Math.min(
          Math.max(0,interesVto),
          interesesRestantes
        );

        v.saldo=Math.max(0,v.saldo-impuestoAplicar);
        impuestoRestante-=impuestoAplicar;
        interesesRestantes-=interesAplicar;
        aplicadoImpuesto+=impuestoAplicar;
        aplicadoIntereses+=interesAplicar;
        saldoInteresesNuevo+=Math.max(0,interesVto-interesAplicar);

        if(impuestoAplicar>0 || interesAplicar>0){
          aplicacionesVto.push({
            id:v.id,
            aplicado:Number(impuestoAplicar||0),
            aplicadoIntereses:Number(interesAplicar||0),
            aplicadoSancion:0,
            saldo:v.saldo
          });
        }
      }

      // Si el pago excede la deuda exigible que participó en la
      // proporcionalidad, el remanente puede imputarse directamente a los
      // vencimientos posteriores. Esto permite cancelar una cuota futura una
      // vez agotada la cuota vencida, como en el soporte Excel V9.5.2.
      let remanentePago=Math.max(0,
        Number(pago.valor||0)-(
          Number(aplicadoImpuesto||0)+
          Number(aplicadoIntereses||0)
        )
      );

      // La sanción pertenece al primer vencimiento exigible. Si no existe
      // ninguno exigible, no se imputa en este pago.
      const vtoSancion=vencimientosExigibles.find(v=>v.id===idVtoSancion)
        ||vencimientosExigibles[0]
        ||null;
      if(vtoSancion && Number(aplicacionGlobal.sancion||0)>0){
        aplicadoSancion=Math.min(
          Math.max(0,saldoSancion),
          Number(aplicacionGlobal.sancion||0)
        );
        saldoSancion=Math.max(0,saldoSancion-aplicadoSancion);
        const existente=aplicacionesVto.find(x=>x.id===vtoSancion.id);
        if(existente) existente.aplicadoSancion=aplicadoSancion;
        else aplicacionesVto.push({
          id:vtoSancion.id,
          aplicado:0,
          aplicadoIntereses:0,
          aplicadoSancion,
          saldo:vtoSancion.saldo
        });
      }

      remanentePago=Math.max(0,remanentePago-aplicadoSancion);
      if(remanentePago>0){
        for(const v of saldosVto){
          if(vencimientosExigibles.some(e=>e.id===v.id))continue;
          if(remanentePago<=0)break;
          const aplicarFuturo=Math.min(Math.max(0,v.saldo),remanentePago);
          if(aplicarFuturo>0){
            v.saldo=Math.max(0,v.saldo-aplicarFuturo);
            aplicadoImpuesto+=aplicarFuturo;
            remanentePago-=aplicarFuturo;
            const existente=aplicacionesVto.find(x=>x.id===v.id);
            if(existente)existente.aplicado+=aplicarFuturo;
            else aplicacionesVto.push({id:v.id,aplicado:aplicarFuturo,aplicadoIntereses:0,aplicadoSancion:0,saldo:v.saldo});
          }
        }
      }

      saldoIntereses=roundMil(saldoInteresesNuevo);

      const aplicado={
        impuesto:Math.round(aplicadoImpuesto),
        intereses:Math.round(aplicadoIntereses),
        sancion:Math.round(aplicadoSancion),
        total:Math.round(aplicadoImpuesto+aplicadoIntereses+aplicadoSancion),
        excedente:Math.max(0,Number(pago.valor||0)-Math.round(aplicacionGlobal.total||0)),
        porcentaje:Number(aplicacionGlobal.porcentaje||0),
        tipoProporcion:aplicacionGlobal.tipoProporcion||"POR VENCIMIENTO"
      };

      const excedente=Math.max(0,Number(pago.valor||0)-aplicado.total);
      excedenteTotal+=excedente;

      // Si el redondeo o los topes de componentes impiden consumir todo el
      // pago, el remanente se conserva como excedente, nunca como deuda.
      aplicado.excedente=excedente;

      actualizacionSancionPago.saldoDespues=roundMil(saldoSancion);
      actualizacionSancionPago.actualizacionTotal=roundMil(
        Number(actualizacionSancionPago.actualizacionTotal||0)
      );

      detalle.push({
        pago,
        tasa:especial.tasa==null
          ?this.tasaPorFecha(pago.fecha,"TASA DIAN")
          :especial.tasa,
        tasaVisible:especial.tasa==null
          ?Number(this.tasaPorFecha(pago.fecha,"TASA DIAN")||0)*100
          :Number(especial.tasa)*100,
        tipoAplicado:pago.tipo||"TASA DIAN",
        beneficio:especial.beneficio?.id||null,
        notaBeneficio:especial.nota,
        interesGenerado:intCalc.liquidado,
        interesLiquidado:intCalc.liquidado,
        tramosInteres:intCalc.tramos,
        interesesPorCuota,
        deudaAntes,
        aplicado,
        excedente,
        aplicacionesVto,
        actualizacionSancion:actualizacionSancionPago,
        saldo:{
          impuesto:saldosVto.reduce((a,v)=>a+Math.max(0,v.saldo),0),
          intereses:saldoIntereses,
          sancion:Math.max(0,saldoSancion),
          total:saldosVto.reduce((a,v)=>a+Math.max(0,v.saldo),0)
            +saldoIntereses+Math.max(0,saldoSancion)
        }
      });
    }

    const impuesto=saldosVto.reduce((a,v)=>a+Math.max(0,v.saldo),0);
    const ultimo=detalle.at(-1)||null;

    return {
      vencimientos:saldosVto,
      impuesto,
      intereses:saldoIntereses,
      sancion:Math.max(0,saldoSancion),
      total:impuesto+saldoIntereses+Math.max(0,saldoSancion),
      excedente:Number(excedenteTotal||0),
      ultimo,
      detalle,
      advertencias:[
        ...validacion.advertencias,
        ...advertenciasSancion,
        ...detalle.flatMap(x=>
          x.tramosInteres.filter(t=>t.advertencia).map(t=>t.advertencia)
        )
      ],
      beneficiosAplicados:[
        ...new Set(
          detalle.map(x=>x.tipoAplicado)
            .filter(t=>t&&t!=="TASA DIAN")
        )
      ],
      reglaObligacion:validacion.regla,
      validacionObligacion:validacion,
      verificacionObligacion:this.verificarImpuestoPlastico(datos),
      fechaCorte:fechaCorte||pagos.at(-1)?.fecha||null,
      sancionActualizacion:{
        fechaBase:fechaSancion,
        fechaUltimaActualizacion:fechaUltimaActualizacionSancion,
        saldoOriginal:roundMil(sancionBaseOriginal),
        saldoFinal:roundMil(saldoSancion),
        actualizacionAcumulada:roundMil(Math.max(0,saldoSancion-sancionBaseOriginal)),
        tramos:detalleActualizacionSancion
      }
    };
  }
}
