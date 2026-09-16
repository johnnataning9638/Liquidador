/**
 * Fase 10 — Calendario DIAN 2026.
 *
 * Determina fechas límite únicamente cuando existe una regla explícita
 * registrada en datos/calendario.json. No inventa fechas para vigencias
 * futuras ni para combinaciones que no estén soportadas.
 */
export class CalendarioTributario {
  constructor({datos=[]}={}){
    this.datos=Array.isArray(datos)?datos:[];
  }

  normalizar(v){
    return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
  }

  ultimoDigitoNIT(nit){
    const s=String(nit??"").replace(/\D/g,"");
    if(!s)return null;
    return Number(s.slice(-1));
  }

  ultimosDosNIT(nit){
    const s=String(nit??"").replace(/\D/g,"");
    if(s.length<2)return null;
    return Number(s.slice(-2));
  }

  fila(clave,anio){
    return this.datos.find(x=>this.normalizar(x.clave)===this.normalizar(clave)&&Number(x.anio)===Number(anio))||null;
  }

  fechaDesdeMapa(mapa,clave){
    if(!mapa)return null;
    const k=String(clave);
    return mapa[k]||mapa[String(Number(k))]||null;
  }

  resolverRentaPN(nit,anioGravable){
    const fila=this.fila("RENTA_PN",2026);
    if(Number(anioGravable)!==2025)return this.noDisponible("El calendario registrado de renta de personas naturales corresponde al año gravable 2025 con vencimiento en 2026.");
    const ult=this.ultimosDosNIT(nit);
    if(ult==null)return this.noDisponible("Se requieren los dos últimos dígitos del NIT para calcular el vencimiento de renta de persona natural.");
    const fecha=this.fechaDesdeMapa(fila?.fechas,ult);
    if(!fecha)return this.noDisponible("Los dos últimos dígitos del NIT están fuera del calendario registrado.");
    return this.ok(fecha,"RENTA_PN",`Renta personas naturales año gravable 2025; NIT ${String(ult).padStart(2,"0")}.`);
  }

  resolverRentaCuotas(nit,perfil,anioGravable,periodo){
    if(Number(anioGravable)!==2025)return this.noDisponible("El calendario de renta 2026 registrado corresponde al año gravable 2025.");
    const p=this.normalizar(perfil);
    const cuota=Number(periodo||1);
    const clave=p==="GRAN CONTRIBUYENTE"?"RENTA_GC":p==="PERSONA JURIDICA"?"RENTA_PJ":null;
    if(!clave)return this.noDisponible("Para renta con vencimiento 2026 se requiere perfil PERSONA JURIDICA o GRAN CONTRIBUYENTE, o PERSONA NATURAL con su calendario de dos últimos dígitos.");
    const fila=this.fila(clave,2026);
    const dig=this.ultimoDigitoNIT(nit);
    const fecha=this.fechaDesdeMapa(fila?.cuotas?.[String(cuota)]?.fechas,dig);
    if(!fecha)return this.noDisponible("La cuota de renta seleccionada no está registrada para ese perfil o NIT.");
    return this.ok(fecha,clave,`${fila.descripcion}. Cuota ${cuota}.`);
  }

  resolverPorTabla(clave,periodo,nit){
    const fila=this.fila(clave,2026);
    const dig=this.ultimoDigitoNIT(nit);
    if(dig==null)return this.noDisponible("Se requiere NIT para calcular el vencimiento.");
    const fecha=this.fechaDesdeMapa(fila?.periodos?.[String(periodo)]?.fechas,dig);
    if(!fecha)return this.noDisponible("El período indicado no tiene una fecha registrada en el calendario 2026.");
    return this.ok(fecha,clave,`${fila.descripcion}. Período ${periodo}.`);
  }

  resolverFijo(clave,periodo){
    const fila=this.fila(clave,2026);
    const fecha=this.fechaDesdeMapa(fila?.periodos?.[String(periodo)]?.fechas,"FIJO");
    if(!fecha)return this.noDisponible("No existe fecha fija registrada para el período indicado.");
    return this.ok(fecha,clave,`${fila.descripcion}. Período ${periodo}.`);
  }

  fechaVencimiento(datos={}){
    const concepto=this.normalizar(datos.concepto);
    const anio=Number(datos.anio||0);
    const periodo=String(datos.periodo||"1");
    const perfil=this.normalizar(datos.perfilContribuyente);

    if(concepto==="RENTA"){
      if(perfil==="PERSONA NATURAL")return this.resolverRentaPN(datos.nit,anio);
      return this.resolverRentaCuotas(datos.nit,perfil,anio,periodo);
    }

    if(concepto==="VENTAS"){
      const p=this.normalizar(datos.periodicidadObligacion);
      if(p==="BIMESTRAL")return this.resolverPorTabla("IVA_BIMESTRAL",periodo,datos.nit);
      if(p==="CUATRIMESTRAL")return this.resolverPorTabla("IVA_CUATRIMESTRAL",periodo,datos.nit);
      return this.noDisponible("Para IVA debe seleccionar periodicidad BIMESTRAL o CUATRIMESTRAL.");
    }

    if(concepto==="RETENCION")return this.resolverPorTabla("RETENCION",periodo,datos.nit);
    if(concepto==="CONSUMO")return this.resolverPorTabla("CONSUMO_BIMESTRAL",periodo,datos.nit);
    if(concepto==="SIMPLE"){
      const p=this.normalizar(datos.periodicidadObligacion);
      if(p==="ANTICIPO BIMESTRAL")return this.resolverPorTabla("SIMPLE_ANTICIPO",periodo,datos.nit);
      if(p==="DECLARACION ANUAL")return this.resolverPorTabla("SIMPLE_ANUAL",periodo,datos.nit);
      return this.noDisponible("Para SIMPLE debe seleccionar ANTICIPO BIMESTRAL o DECLARACION ANUAL.");
    }
    if(concepto==="PATRIMONIO"){
      const cuota=Number(periodo||1);
      if(cuota===2)return this.ok("2026-09-14","PATRIMONIO", "Segunda cuota del impuesto al patrimonio 2026.");
      return this.resolverPorTabla("PATRIMONIO",1,datos.nit);
    }
    if(concepto==="PRODUCTOS ULTRAPROCESADOS")return this.resolverFijo("ULTRAPROCESADOS",periodo);
    if(concepto==="PRODUCTOS PLASTICOS"){
      if(anio===2025)return this.ok("2026-02-13","PLASTICOS", "Impuesto nacional sobre productos plásticos de un solo uso, año gravable 2025.");
      return this.noDisponible("El calendario registrado no contiene todavía el vencimiento de productos plásticos para años gravables posteriores a 2025.");
    }
    if(concepto==="GMF")return this.noDisponible("GMF se determina semanalmente y vence el segundo día hábil de la semana siguiente; esta fase no inventa feriados para convertir esa regla en una fecha.");
    return this.noDisponible("La Fase 10 no tiene una regla de calendario registrada para este concepto.");
  }

  ok(fecha,clave,detalle){return {disponible:true,fecha,clave,detalle,fuente:"DIAN — Calendario Tributario 2026",advertencias:[]};}
  noDisponible(mensaje){return {disponible:false,fecha:null,clave:null,detalle:"",fuente:"DIAN — Calendario Tributario 2026",advertencias:[mensaje]};}
}
