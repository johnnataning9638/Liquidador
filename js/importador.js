import {fechaISO,numeroDesdeTexto} from "./utilidades.js";

const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[º°]/g,"").replace(/[.\-_:]/g," ").replace(/\s+/g," ").trim();
const upper=s=>String(s??"").trim().toUpperCase();

const alias={
  nit:["nit","identificacion","identificacion tributaria"],
  razonSocial:["razon social","nombre razon social","contribuyente"],
  anio:["anio","ano gravable","año gravable","vigencia"],
  concepto:["concepto","impuesto","tipo de impuesto","tributo"],
  periodo:["periodo","periodo gravable","periodo tributario"],
  perfilContribuyente:["perfil contribuyente","tipo contribuyente","calidad contribuyente","calidad del contribuyente"],
  periodicidadObligacion:["periodicidad","periodicidad obligacion","periodicidad obligación"],
  semanaGmf:["semana gmf","semana"],
  pesoPlastico:["peso plastico","peso plástico","peso gramos","gramos plastico","gramos plástico"],
  baseGravableRenta:["renta liquida gravable","renta líquida gravable","base gravable renta","base renta"],
  baseIva19:["base iva 19","base gravada 19","iva 19"],
  baseIva5:["base iva 5","base gravada 5","iva 5"],
  baseIvaExcluida:["base iva excluida","base excluida iva","base no gravada iva"],
  ivaDescontable:["iva descontable","impuesto descontable"],
  tipoRetencion:["tipo retencion","tipo retención"],
  baseRetencion:["base retencion","base retención","base gravable retencion","base gravable retención"],
  grupoSimple:["grupo simple","grupo simple de tributacion","grupo simple de tributación"],
  baseSimple:["ingresos brutos simple","base simple","ingresos simple"],
  baseConsumo4:["base consumo 4","consumo 4","base gravada 4"],
  baseConsumo8:["base consumo 8","consumo 8","base gravada 8"],
  baseConsumo16:["base consumo 16","consumo 16","base gravada 16"],
  baseConsumoCannabis:["base cannabis","cannabis 16","base cannabis 16"],
  baseGmf:["base gmf","base gravable gmf","base gravable 4 x 1000"],
  tipoUltraprocesado:["tipo ultraprocesado","tipo producto ultraprocesado","modalidad ultraprocesado"],
  volumenBebidaMl:["volumen bebida ml","volumen ml","mililitros bebida"],
  azucarGramos100Ml:["azucar gramos 100 ml","azúcar gramos 100 ml","azucar g 100 ml"],
  baseComestiblesUltraprocesados:["base comestibles ultraprocesados","base comestibles","base ultraprocesados"],
  tipoPatrimonio:["tipo patrimonio","modalidad patrimonio"],
  basePatrimonio:["base patrimonio","base gravable patrimonio"],
  patrimonioBruto:["patrimonio bruto"],
  deudasPatrimonio:["deudas patrimonio","pasivos patrimonio"],
  exclusionesPatrimonio:["exclusiones patrimonio"],
  sectorPatrimonio2026:["sector patrimonio 2026","sector tarifa patrimonio"],
  fechaCorte:["fecha corte","fecha de corte","fecha liquidacion","fecha liquidación"],
  fechaVto:["fecha vencimiento","fecha de vencimiento","vencimiento"],
  impuestoVto:["impuesto vencimiento","valor impuesto","impuesto a pagar","saldo impuesto"],
  tieneSancion:["tiene sancion","tiene sanción","sancion"],
  valorSancion:["valor sancion","valor sanción","sancion a pagar"],
  fechaSancion:["fecha sancion","fecha sanción"],
  origenSancion:["origen sancion","origen sanción"],
  beneficioSancion:["beneficio sancion","beneficio sanción"],
  beneficioTributario:["beneficio tributario","beneficio decreto","decreto 0240","beneficio art 4","articulo 4 decreto 0240","artículo 4 decreto 0240"],
  fechaActuacionBeneficio:["fecha actuacion beneficio","fecha actuación beneficio","fecha presentacion beneficio","fecha presentación beneficio","fecha correccion beneficio","fecha corrección beneficio"],
  fechaDeclaracionOriginal:["fecha declaracion original","fecha declaración original"],
  obligacionFormalCumplida:["obligacion formal cumplida","obligación formal cumplida"],
  aceptaGlosas:["acepta glosas","aceptacion glosas","aceptación glosas"],
  informaDian:["informo a la dian","informó a la dian","informacion escrita dian","información escrita dian"],
  resolucionReconsideracion:["resolucion reconsideracion","resolución reconsideración"],
  depBaseDepurada:["base depurada","base juridicamente depurada","base jurídicamente depurada"],
  depHechoGenerador:["hecho generador verificado","hecho generador revisado"],
  depSujetoResponsable:["sujeto responsable verificado","sujeto pasivo verificado","responsable verificado"],
  depExclusionesRevisadas:["exclusiones revisadas","exenciones revisadas","exclusiones y exenciones revisadas"],
  depCondicionesEspeciales:["condiciones especiales revisadas","condiciones particulares revisadas"],
  tdj:["tdj","tdj no","tdj numero","tdj n"],
  recibo:["recibo","recibo no","recibo numero","no documento fuente","numero documento fuente","no recibo"],
  fechaPago:["fecha pago","fecha de pago"],
  valorPago:["valor pago","valor pagado","pago"],
  tipoPago:["tipo pago","tipo","nombre formato","formato"],
  observacion:["observacion","observación"]
};

function findIndex(headers,keys){
  return headers.findIndex(h=>{
    const x=norm(h);
    return keys.some(k=>{const y=norm(k);return x===y||x.includes(y)||y.includes(x)});
  });
}
function splitRow(row,sep){
  if(sep==="\t") return row.split("\t").map(x=>x.trim());
  const out=[];let cur="",quoted=false;
  for(let i=0;i<row.length;i++){
    const ch=row[i];
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===","&&!quoted){out.push(cur.trim());cur="";continue;}
    cur+=ch;
  }
  out.push(cur.trim());return out;
}
function valueFromLines(lines,keys){
  for(const line of lines){
    const idx=line.indexOf(":");
    if(idx<0) continue;
    const k=norm(line.slice(0,idx));
    if(keys.some(x=>k===norm(x)||k.includes(norm(x)))) return line.slice(idx+1).trim();
  }
  return "";
}
function vencIndex(key){
  const m=norm(key).match(/(?:vencimiento|vto)\s*(\d+)/);
  return m?Number(m[1]):null;
}

function esReciboPagoSinTitulo(v){
  const s=String(v??"").trim().replace(/[^0-9]/g,"");
  return /^4\d{12,}$/.test(s);
}
function valorNumericoEstricto(v){
  const s=String(v??"").trim();
  if(!s||/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(s))return null;
  const n=numeroDesdeTexto(s);
  return Number.isFinite(n)?n:null;
}
function reconocerPagosSinTitulos(lines){
  const encontrados=[];
  const filas=lines.map(line=>{
    if(line.includes("\t"))return line.split("\t").map(x=>x.trim());
    if(/;/.test(line)&&line.split(";").length>=3)return line.split(";").map(x=>x.trim());
    return null;
  }).filter(Boolean);

  const procesarFila=(celdas)=>{
    let idxRecibo=-1;
    for(let i=0;i<celdas.length;i++){
      if(esReciboPagoSinTitulo(celdas[i])){idxRecibo=i;break;}
    }
    if(idxRecibo<0)return;
    let idxFecha=-1,fecha="";
    for(let i=idxRecibo+1;i<celdas.length;i++){
      const f=fechaISO(celdas[i]);
      if(f){idxFecha=i;fecha=f;break;}
    }
    if(idxFecha<0)return;
    let valor=0;
    for(let i=idxFecha+1;i<celdas.length;i++){
      const n=valorNumericoEstricto(celdas[i]);
      if(n!==null&&n>0){valor=n;break;}
    }
    if(valor<=0)return;
    encontrados.push({
      id:crypto.randomUUID(),
      numero:encontrados.length+1,
      tdj:"",
      recibo:upper(String(celdas[idxRecibo]).replace(/\D/g,"")),
      fecha,
      valor,
      tipo:"TASA DIAN",
      observacion:"IMPORTADO SIN TÍTULOS"
    });
  };

  filas.forEach(procesarFila);

  // También permite una fila sin tabulaciones: busca recibo, fecha y luego
  // el primer valor numérico posterior a la fecha. El resto de la información
  // se descarta deliberadamente.
  if(!filas.length){
    for(const line of lines){
      const tokens=line.trim().split(/\s+/).filter(Boolean);
      procesarFila(tokens);
    }
  }
  return encontrados;
}
function deduplicarPagos(pagos){
  const vistos=new Set();
  return pagos.filter(p=>{
    const recibo=String(p.recibo||"").replace(/\D/g,"");
    const clave=recibo?`R|${recibo}|${p.fecha}|${Number(p.valor||0)}`:`P|${p.fecha}|${Number(p.valor||0)}|${p.tdj||""}`;
    if(vistos.has(clave))return false;
    vistos.add(clave);return true;
  }).sort((a,b)=>a.fecha.localeCompare(b.fecha)).map((p,i)=>({...p,numero:i+1}));
}

export function importarDatosInteligente(texto){
  const raw=String(texto??"").replace(/\r/g,"");
  const lines=raw.split("\n").filter(x=>x.trim());
  if(!lines.length) throw new Error("No hay información para reconocer.");

  const obligacion={vencimientos:[],pagos:[]};
  const get=(k)=>valueFromLines(lines,alias[k]);
  obligacion.nit=upper(get("nit"));
  obligacion.razonSocial=upper(get("razonSocial"));
  obligacion.anio=Number(get("anio")||0);
  obligacion.concepto=upper(get("concepto"));
  obligacion.periodo=get("periodo");
  obligacion.perfilContribuyente=upper(get("perfilContribuyente"));
  obligacion.periodicidadObligacion=upper(get("periodicidadObligacion"));
  obligacion.semanaGmf=Number(get("semanaGmf")||0);
  obligacion.pesoPlastico=numeroDesdeTexto(get("pesoPlastico"));
  obligacion.fechaCorte=fechaISO(get("fechaCorte"));
  obligacion.baseGravableRenta=numeroDesdeTexto(get("baseGravableRenta"));
  obligacion.baseIva19=numeroDesdeTexto(get("baseIva19"));
  obligacion.baseIva5=numeroDesdeTexto(get("baseIva5"));
  obligacion.baseIvaExcluida=numeroDesdeTexto(get("baseIvaExcluida"));
  obligacion.ivaDescontable=numeroDesdeTexto(get("ivaDescontable"));
  obligacion.tipoRetencion=upper(get("tipoRetencion"));
  obligacion.baseRetencion=numeroDesdeTexto(get("baseRetencion"));
  obligacion.grupoSimple=upper(get("grupoSimple"));
  obligacion.baseSimple=numeroDesdeTexto(get("baseSimple"));
  obligacion.baseConsumo4=numeroDesdeTexto(get("baseConsumo4"));obligacion.baseConsumo8=numeroDesdeTexto(get("baseConsumo8"));obligacion.baseConsumo16=numeroDesdeTexto(get("baseConsumo16"));obligacion.baseConsumoCannabis=numeroDesdeTexto(get("baseConsumoCannabis"));
  obligacion.baseGmf=numeroDesdeTexto(get("baseGmf"));obligacion.tipoUltraprocesado=upper(get("tipoUltraprocesado"));obligacion.volumenBebidaMl=numeroDesdeTexto(get("volumenBebidaMl"));obligacion.azucarGramos100Ml=Number(get("azucarGramos100Ml")||0);obligacion.baseComestiblesUltraprocesados=numeroDesdeTexto(get("baseComestiblesUltraprocesados"));
  obligacion.tipoPatrimonio=upper(get("tipoPatrimonio"));obligacion.basePatrimonio=numeroDesdeTexto(get("basePatrimonio"));obligacion.patrimonioBruto=numeroDesdeTexto(get("patrimonioBruto"));obligacion.deudasPatrimonio=numeroDesdeTexto(get("deudasPatrimonio"));obligacion.exclusionesPatrimonio=numeroDesdeTexto(get("exclusionesPatrimonio"));obligacion.sectorPatrimonio2026=upper(get("sectorPatrimonio2026"));
  obligacion.tieneSancion=upper(get("tieneSancion"))==="SI"?"SI":"NO";
  obligacion.valorSancion=numeroDesdeTexto(get("valorSancion"));
  obligacion.fechaSancion=fechaISO(get("fechaSancion"));
  obligacion.origenSancion=upper(get("origenSancion"));
  obligacion.beneficioSancion=upper(get("beneficioSancion"));
  obligacion.beneficioTributario=upper(get("beneficioTributario"));
  obligacion.fechaActuacionBeneficio=fechaISO(get("fechaActuacionBeneficio"));
  obligacion.fechaDeclaracionOriginal=fechaISO(get("fechaDeclaracionOriginal"));
  obligacion.obligacionFormalCumplida=upper(get("obligacionFormalCumplida"));
  obligacion.aceptaGlosas=upper(get("aceptaGlosas"));
  obligacion.informaDian=upper(get("informaDian"));
  obligacion.resolucionReconsideracion=upper(get("resolucionReconsideracion"));
  const si=v=>["SI","SÍ","TRUE","VERDADERO","1","OK","CONFIRMADO"].includes(norm(v));
  obligacion.dep_baseDepurada=si(get("depBaseDepurada"));
  obligacion.dep_hechoGenerador=si(get("depHechoGenerador"));
  obligacion.dep_sujetoResponsable=si(get("depSujetoResponsable"));
  obligacion.dep_exclusionesRevisadas=si(get("depExclusionesRevisadas"));
  obligacion.dep_condicionesEspeciales=si(get("depCondicionesEspeciales"));

  for(let i=1;i<=20;i++){
    let fecha=""; // reservado
    for(const line of lines){
      const idx=line.indexOf(":"); if(idx<0) continue;
      const k=line.slice(0,idx); const n=vencIndex(k);
      if(n!==i) continue;
      const nk=norm(k);
      if(nk.includes("fecha")) fecha=line.slice(idx+1).trim();
      if(nk.includes("impuesto")||nk.includes("valor")){
        const v=numeroDesdeTexto(line.slice(idx+1));
        if(v>0){
          const existente=obligacion.vencimientos.find(x=>x.numero===i)||{numero:i};
          existente.impuesto=v; obligacion.vencimientos.push(existente);
        }
      }
    }
    if(fecha){
      const existente=obligacion.vencimientos.find(x=>x.numero===i)||{numero:i};
      existente.fecha=fechaISO(fecha); obligacion.vencimientos.push(existente);
    }
  }
  obligacion.vencimientos=obligacion.vencimientos.filter((v,i,a)=>a.findIndex(x=>x.numero===v.numero)===i).map((v,i)=>({id:`VTO-${v.numero||i+1}`,numero:v.numero||i+1,fecha:v.fecha||"",impuesto:Number(v.impuesto||0)})).filter(v=>v.fecha||v.impuesto>0).sort((a,b)=>a.numero-b.numero);

  // Formato tabulado/CSV con encabezados.
  if(lines.length>=2 && (lines[0].includes("\t")||lines[0].includes(","))){
    const sep=lines[0].includes("\t")?"\t":",";
    const headers=splitRow(lines[0],sep);
    const ix={tdj:findIndex(headers,alias.tdj),recibo:findIndex(headers,alias.recibo),fecha:findIndex(headers,alias.fechaPago),valor:findIndex(headers,alias.valorPago),tipo:findIndex(headers,alias.tipoPago),obs:findIndex(headers,alias.observacion)};
    if(ix.fecha>=0&&ix.valor>=0){
      lines.slice(1).forEach((line,i)=>{
        const c=splitRow(line,sep),fecha=fechaISO(c[ix.fecha]),valor=numeroDesdeTexto(c[ix.valor]);
        if(!fecha||valor<=0)return;
        obligacion.pagos.push({id:crypto.randomUUID(),numero:i+1,tdj:upper(ix.tdj>=0?c[ix.tdj]:""),recibo:upper(ix.recibo>=0?c[ix.recibo]:""),fecha,valor,tipo:upper(ix.tipo>=0?c[ix.tipo]:"TASA DIAN")||"TASA DIAN",observacion:upper(ix.obs>=0?c[ix.obs]:"IMPORTADO")});
      });
    }
  }

  // Formato vertical de pagos: bloque repetido con Fecha Pago / Valor Pago.
  for(let i=0;i<lines.length;i++){
    const fechaLine=lines[i];
    const idx=fechaLine.indexOf(":");
    if(idx<0||!norm(fechaLine.slice(0,idx)).includes("fecha pago"))continue;
    const fecha=fechaISO(fechaLine.slice(idx+1));
    let valor=0,tdj="",recibo="",tipo="TASA DIAN",obs="IMPORTADO";
    for(let j=i+1;j<Math.min(lines.length,i+8);j++){
      const p=lines[j].indexOf(":");if(p<0)continue;
      const k=norm(lines[j].slice(0,p)),v=lines[j].slice(p+1).trim();
      if(k.includes("valor pago")||k==="pago"||k.includes("valor pagado"))valor=numeroDesdeTexto(v);
      else if(k.includes("tdj"))tdj=upper(v);
      else if(k.includes("recibo")||k.includes("documento fuente"))recibo=upper(v);
      else if(k.includes("tipo"))tipo=upper(v)||"TASA DIAN";
      else if(k.includes("observacion"))obs=upper(v);
    }
    if(fecha&&valor>0) obligacion.pagos.push({id:crypto.randomUUID(),numero:obligacion.pagos.length+1,tdj,recibo,fecha,valor,tipo,observacion:obs});
  }

  // Reconocimiento inteligente sin títulos: cada número que inicia en 4 y
  // tiene más de 12 dígitos se interpreta como recibo de pago; después se
  // busca la primera fecha posterior y luego el primer valor numérico que
  // aparezca después de esa fecha. Todo lo demás se descarta.
  const pagosSinTitulos=reconocerPagosSinTitulos(lines);
  if(pagosSinTitulos.length) obligacion.pagos.push(...pagosSinTitulos);

  obligacion.pagos=deduplicarPagos(obligacion.pagos);
  const tipoD0240=obligacion.pagos.find(p=>String(p.tipo||"").toUpperCase().includes("DECRETO 0240")||String(p.observacion||"").toUpperCase().includes("DECRETO 0240"));
  if(tipoD0240){
    const t=String(tipoD0240.tipo||tipoD0240.observacion||"").toUpperCase();
    obligacion.beneficioTributario=t.includes("CORRECCION")||t.includes("CORRECCIÓN")?"D0240_ART4_CORRECCION":(t.includes("OMISO")?"D0240_ART4_OMISO":"D0240_ART4_CORRECCION");
  }
  if(!obligacion.vencimientos.length && !obligacion.pagos.length && !obligacion.nit && !obligacion.razonSocial && !obligacion.concepto) throw new Error("No pude reconocer información de obligación ni pagos.");
  obligacion.vencimientos.sort((a,b)=>a.numero-b.numero);
  return obligacion;
}

export function importarTabulado(texto){
  const r=importarDatosInteligente(texto);
  if(!r.pagos.length) throw new Error("Se reconocieron los datos, pero no encontré pagos válidos. Verifica Fecha Pago y Valor Pago.");
  return r.pagos;
}
