/** Fase 13 — Motor normativo histórico.
 * Identifica el régimen aplicable por concepto y año antes de permitir que
 * una fórmula de una vigencia se reutilice en otra. No inventa reglas faltantes.
 */
export class MotorNormativoHistorico {
  constructor({datos=null}={}){ this.datos=datos||{reglas:[]}; this.reglas=Array.isArray(this.datos.reglas)?this.datos.reglas:[]; }
  norm(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim();}
  concepto(v){return this.norm(v).replace(/\s+/g," ");}
  resolver(concepto,anio){
    const c=this.concepto(concepto),a=Number(anio||0);
    if(!c||!a)return {disponible:false,estado:"DATOS_INSUFICIENTES",advertencias:["Debe indicar concepto y año gravable para identificar el régimen histórico."],fuente:"Motor normativo histórico Fase 13"};
    const candidatos=this.reglas.filter(r=>this.concepto(r.concepto)===c && a>=Number(r.desde) && (r.hasta==null || a<=Number(r.hasta)));
    if(!candidatos.length)return {disponible:false,concepto:c,anio:a,estado:"SIN_REGLA_REGISTRADA",advertencias:[`No existe una regla histórica registrada para ${c} en el año ${a}. No se autoriza reutilizar automáticamente una fórmula de otra vigencia.`],fuente:"Motor normativo histórico Fase 13"};
    const r=candidatos[0];
    return {disponible:true,concepto:c,anio:a,estado:r.estado,regla:r.regla,fuente:r.fuente,cambios:r.cambios||[],desde:r.desde,hasta:r.hasta,formulaCompatible:r.formulaCompatible===true,puedeContinuar:["REGIMEN_VIGENTE_REGISTRADO","REGIMEN_HISTORICO_IDENTIFICADO"].includes(r.estado)&&r.formulaCompatible===true,requiereRevision:["REGIMEN_HISTORICO_REQUIERE_TARIFA","REGIMEN_HISTORICO_REQUIERE_REVISION","SIN_REGLA_REGISTRADA"].includes(r.estado)||r.formulaCompatible!==true,noAplica:r.estado==="NO_APLICABLE"};
  }
  evaluar(d){
    const r=this.resolver(d?.concepto,d?.anio);
    const bloqueos=[];
    if(!r.disponible) bloqueos.push(...(r.advertencias||[]));
    if(r.noAplica) bloqueos.push(`La obligación ${r.concepto} no es aplicable bajo la regla histórica registrada para ${r.anio}.`);
    if(r.requiereRevision && !r.noAplica) bloqueos.push("El régimen está identificado, pero la fórmula actual no está certificada para esta vigencia. Debe completarse la regla histórica antes de aplicar el resultado al vencimiento.");
    return {...r,bloqueado:bloqueos.length>0,advertencias:[...(r.advertencias||[]),...bloqueos]};
  }
}
