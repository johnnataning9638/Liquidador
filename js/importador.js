import {fechaISO,numeroDesdeTexto,truncarValorEntero} from "./utilidades.js";

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

function limpiarCeldaPago(v){
  return String(v??"").replace(/\u00a0/g," ").replace(/\[([^\]]+)\]\([^)]*\)/g,"$1").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}
function expandirCientifico(v){
  let s=limpiarCeldaPago(v).replace(/\s+/g,"");
  const m=s.match(/^([+-]?\d+(?:[\.,]\d+)?)[eE]([+-]?\d+)$/);
  if(!m)return null;
  let mant=m[1].replace(",","."), exp=Number(m[2]);
  if(!Number.isInteger(exp)||exp<0)return null;
  let sign="";if(mant[0]==="-"){sign="-";mant=mant.slice(1);}else if(mant[0]==="+")mant=mant.slice(1);
  const parts=mant.split("."), digits=(parts[0]+(parts[1]||"")).replace(/^0+(?=\d)/,"");
  const decimals=(parts[1]||"").length;
  const shift=exp-decimals;
  if(shift>=0)return sign+(digits||"0")+"0".repeat(shift);
  const pos=digits.length+shift;
  if(pos<=0)return sign+"0."+"0".repeat(-pos)+digits;
  return sign+digits.slice(0,pos)+"."+digits.slice(pos);
}
function normalizarDocumento(v){
  const limpio=limpiarCeldaPago(v);
  const expandido=expandirCientifico(limpio);
  const base=expandido??limpio;
  const d=base.replace(/\D/g,"");
  return d;
}
function extraerTDJDesdeTexto(v){
  const s=limpiarCeldaPago(v);
  const m=s.match(/\bTDJ\b\s*(?:N[°º]?|NO\.?|NUM(?:ERO)?\.?)?\s*[:#-]?\s*(\d{5,})/i)
    ||s.match(/T[ÍI]TULO\s+DE\s+DEP[ÓO]SITO\s+JUDICIAL\s*(?:N[°º]?|NO\.?|NUM(?:ERO)?\.?)?\s*[:#-]?\s*(\d{5,})/i);
  return m?m[1]:"";
}
function esTDJTexto(v){ return !!extraerTDJDesdeTexto(v); }
function separarTokensPagoSinTitulo(celda){
  const s=limpiarCeldaPago(celda);
  if(!s)return [];
  const tdj=extraerTDJDesdeTexto(s);
  if(tdj){
    const resto=s
      .replace(/\bTDJ\b\s*(?:N[°º]?|NO\.?|NUM(?:ERO)?\.?)?\s*[:#-]?\s*\d{5,}/i,"")
      .replace(/T[ÍI]TULO\s+DE\s+DEP[ÓO]SITO\s+JUDICIAL\s*(?:N[°º]?|NO\.?|NUM(?:ERO)?\.?)?\s*[:#-]?\s*\d{5,}/i,"")
      .trim();
    const fecha=(resto.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/)||[])[0]||"";
    const sinFecha=fecha?resto.replace(fecha,""):resto;
    const nums=sinFecha.match(/(?:\$?\s*\d{1,3}(?:[. ]\d{3})+|\$?\s*\d+(?:[.,]\d+)?)\s*$/);
    const valor=nums?nums[0].trim():"";
    return [tdj,fecha,valor].filter(Boolean);
  }
  return s.split(/\s+/).filter(Boolean);
}
function esDocumentoLargo(v){
  const raw=limpiarCeldaPago(v).replace(/\s/g,"");
  // Si contiene separadores monetarios/decimales, primero se trata como
  // importe. Esto evita confundir, por ejemplo, 14.558.700,58 con un
  // documento de 10 dígitos. Los documentos en notación científica siguen
  // pudiendo reconocerse mediante normalizarDocumento().
  if(/[,$.]/.test(raw) && !/^[+-]?\d+[eE][+-]?\d+$/.test(raw))return false;
  const d=normalizarDocumento(v);
  return /^\d{10,}$/.test(d) && !/^20\d{2}$/.test(d);
}
function esReciboPagoSinTitulo(v){
  const d=normalizarDocumento(v);
  return /^4\d{12,}$/.test(d);
}
function valorNumericoEstricto(v){
  const s=limpiarCeldaPago(v);
  if(!s)return null;
  const sci=expandirCientifico(s);
  if(sci!==null)return null; // la notación científica se reserva para documentos.
  if(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(s))return null;
  const n=numeroDesdeTexto(s);
  return Number.isFinite(n)?truncarValorEntero(n):null;
}
function separarFilaPagos(linea){
  const s=String(linea??"").trim();
  if(!s)return [];
  if(s.includes("\t"))return s.split("\t").map(limpiarCeldaPago);
  // Markdown/HTML copiado como tabla: | a | b | c |
  if(/\|/.test(s))return s.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split("|").map(limpiarCeldaPago);
  if(/;/.test(s)&&s.split(";").length>=3)return s.split(";").map(limpiarCeldaPago);
  // CSV: solo dividir por coma cuando no parece decimal con coma ni notación científica.
  if(/,(?=[^,]*\s*(?:\d|\$))/.test(s)&&s.split(",").length>=3)return s.split(",").map(limpiarCeldaPago);
  return [s];
}
function detectarSeparadorFila(linea){
  if(String(linea).includes("\t"))return "\t";
  if(String(linea).includes("|"))return "|";
  if(String(linea).includes(";"))return ";";
  if(String(linea).includes(","))return ",";
  return null;
}
function esFilaCabeceraPago(celdas){
  const t=celdas.map(norm).join(" ");
  const hits=["documento fuente","recibo","tdj","fecha pago","fecha presentacion","valor pagado","valor pago","nombre formato","tipo pago"].filter(x=>t.includes(norm(x))).length;
  return hits>=2;
}
function indiceCabeceraPago(celdas,aliases){
  return celdas.findIndex(c=>{const x=norm(c);return aliases.some(a=>{const y=norm(a);return x===y||x.includes(y)||(x.length>=5&&y.includes(x));});});
}
function extraerTipoDesdeTexto(v){
  const t=upper(limpiarCeldaPago(v));
  if(!t)return "TASA DIAN";
  if(t.includes("ART. 45")||t.includes("ART 45"))return "ART. 45 LEY 2155";
  if(t.includes("ART. 91")||t.includes("ART 91"))return "ART. 91 LEY 2277";
  if(t.includes("ART. 93")||t.includes("ART 93"))return "ART. 93 LEY 2277 - OMISAS";
  if(t.includes("ART. 48")||t.includes("ART 48"))return "ART. 48 LEY 2155";
  if(t.includes("688 DE 2020"))return "ART. 1 DECRETO 688 DE 2020 - IBC";
  if(t.includes("0240")&&t.includes("ART. 4"))return "ART. 4 DECRETO 0240 DE 2026, OMISO- CORRECCION";
  if(t.includes("0240")&&t.includes("ART. 3"))return "ART. 3 DECRETO 0240 DE 2026";
  if(t.includes("1474")&&t.includes("ART. 21"))return "ART. 21 DECRETO 1474 DE 2025, OMISO- CORRECCION";
  if(t.includes("1474")&&t.includes("ART. 20"))return "ART. 20 DECRETO 1474 DE 2025";
  return t.includes("TASA")?"TASA DIAN":"TASA DIAN";
}
function reconocerFilaPago(celdas,indices={}){
  const tdjOriginal=celdas.length===1?extraerTDJDesdeTexto(celdas[0]):"";
  let celdasNormalizadas=celdas.map(limpiarCeldaPago);
  if(celdasNormalizadas.length===1 && /\s+/.test(celdasNormalizadas[0])){
    const tokens=separarTokensPagoSinTitulo(celdasNormalizadas[0]);
    if(tokens.length>1)celdasNormalizadas=tokens;
  }
  const vals=celdasNormalizadas.filter(Boolean);
  if(!vals.length)return null;
  let fecha="",idxFecha=-1;
  const fechaIdx=indices.fecha??-1;
  if(fechaIdx>=0&&celdasNormalizadas[fechaIdx]){fecha=fechaISO(limpiarCeldaPago(celdasNormalizadas[fechaIdx]));if(fecha)idxFecha=fechaIdx;}
  if(!fecha){for(let i=0;i<celdasNormalizadas.length;i++){const f=fechaISO(celdasNormalizadas[i]);if(f){fecha=f;idxFecha=i;break;}}}
  if(!fecha)return null;

  let recibo="",tdj="",idxDoc=-1;
  const tdjIdx=indices.tdj??-1, reciboIdx=indices.recibo??-1;
  if(tdjIdx>=0&&celdasNormalizadas[tdjIdx]){tdj=normalizarDocumento(celdasNormalizadas[tdjIdx]);idxDoc=tdj?tdjIdx:-1;}
  if(reciboIdx>=0&&celdasNormalizadas[reciboIdx]){recibo=normalizarDocumento(celdasNormalizadas[reciboIdx]);idxDoc=recibo?reciboIdx:idxDoc;}
  if(!tdj&&!recibo){
    for(let i=0;i<celdasNormalizadas.length;i++){
      const limpio=limpiarCeldaPago(celdasNormalizadas[i]);
      const t=extraerTDJDesdeTexto(limpio);
      if(t){tdj=t;idxDoc=i;break;}
      if(esReciboPagoSinTitulo(limpio)){recibo=normalizarDocumento(limpio);idxDoc=i;break;}
    }
  }
  if(!tdjOriginal){}else{tdj=tdjOriginal;recibo="";idxDoc=0;}
  if(!tdj&&!recibo){
    for(let i=0;i<celdasNormalizadas.length;i++){
      const limpio=limpiarCeldaPago(celdasNormalizadas[i]);
      if(esDocumentoLargo(limpio)){recibo=normalizarDocumento(limpio);idxDoc=i;break;}
    }
  }

  let valor=0;
  const valorIdx=indices.valor??-1;
  if(valorIdx>=0)valor=valorNumericoEstricto(celdasNormalizadas[valorIdx])||0;
  if(!(valor>0)){
    const candidatos=[];
    for(let i=0;i<celdasNormalizadas.length;i++){
      if(i===idxDoc||i===idxFecha)continue;
      const n=valorNumericoEstricto(celdasNormalizadas[i]);
      if(n===null||n<=0)continue;
      const txt=limpiarCeldaPago(celdasNormalizadas[i]);
      if(/^\d{1,2}$/.test(txt))continue; // Nº/repetición/cuota
      if(/^20\d{2}$/.test(txt))continue;
      // Un documento largo nunca es valor pagado.
      if(esDocumentoLargo(txt))continue;
      candidatos.push({n,i,score:(/[.]/.test(txt)?25:0)+(/[\$]/.test(txt)?20:0)});
    }
    candidatos.sort((a,b)=>b.score-a.score);
    valor=candidatos[0]?.n||0;
  }
  if(!(valor>0))return null;

  let tipo=indices.tipo>=0?extraerTipoDesdeTexto(celdasNormalizadas[indices.tipo]):"TASA DIAN";
  if(!tdj && indices.tipo>=0 && /\bTDJ\b|T[ÍI]TULO\s+DE\s+DEP[ÓO]SITO\s+JUDICIAL/i.test(limpiarCeldaPago(celdasNormalizadas[indices.tipo]))){
    for(let i=0;i<celdasNormalizadas.length;i++){
      const d=limpiarCeldaPago(celdasNormalizadas[i]);
      const t=extraerTDJDesdeTexto(d);
      if(t){tdj=t;recibo="";break;}
      if(/^\d{5,}$/.test(d)){tdj=d;recibo="";break;}
    }
    tipo="TDJ";
  }
  if(tdj)tipo="TDJ";
  let observacion=indices.obs>=0?upper(limpiarCeldaPago(celdasNormalizadas[indices.obs])):"IMPORTADO INTELIGENTE";
  return {id:crypto.randomUUID(),numero:0,tdj,recibo,fecha,valor,tipo,observacion};
}
function reconocerPagosTabularesInteligente(lines){
  const encontrados=[];
  // 1) Detectar cualquier fila que funcione como encabezado, sin exigir orden.
  for(let h=0;h<Math.min(lines.length,8);h++){
    const headers=separarFilaPagos(lines[h]);
    if(!esFilaCabeceraPago(headers))continue;
    const ix={
      tdj:indiceCabeceraPago(headers,alias.tdj),
      recibo:indiceCabeceraPago(headers,alias.recibo),
      fecha:indiceCabeceraPago(headers,[...alias.fechaPago,"fecha presentacion","fecha presentación","fecha pago","fecha de presentacion"]),
      valor:indiceCabeceraPago(headers,alias.valorPago),
      tipo:indiceCabeceraPago(headers,alias.tipoPago),
      obs:indiceCabeceraPago(headers,alias.observacion)
    };
    for(let r=h+1;r<lines.length;r++){
      const c=separarFilaPagos(lines[r]);
      if(!c.length||/^[-|\s]+$/.test(c.join("")))continue;
      const p=reconocerFilaPago(c,ix);
      if(p)encontrados.push(p);
    }
    return encontrados;
  }
  return encontrados;
}

function esFilaDocumentosHorizontal(celdas){
  if(!celdas||celdas.length<2)return false;
  let docs=0;
  for(let i=1;i<celdas.length;i++){
    if(esReciboPagoSinTitulo(celdas[i])||esDocumentoLargo(celdas[i]))docs++;
  }
  return docs>=1;
}
function puntuarEtiquetaPago(etiqueta,rol){
  const t=norm(etiqueta);
  if(rol==='fecha'){
    if(t.includes('fecha presentacion')||t.includes('fecha de presentacion')||t.includes('fecha pago')||t.includes('fecha de pago'))return 100;
    if(t.includes('fecha'))return 60;
  }
  if(rol==='valor'){
    if(t.includes('valor pagado')||t.includes('valor pago'))return 120;
    if(t.includes('valor'))return 80;
    if(t.includes('pago'))return 50;
  }
  if(rol==='tipo'){
    if(t.includes('nombre formato'))return 100;
    if(t.includes('tipo'))return 80;
  }
  if(rol==='doc'){
    if(t.includes('documento fuente'))return 120;
    if(t.includes('recibo'))return 100;
    if(t.includes('tdj'))return 100;
  }
  return 0;
}
function reconocerPagosTranspuestosInteligente(lines){
  const filas=lines.map(separarFilaPagos).filter(c=>c.length>1);
  if(!filas.length)return [];

  // Formato transpuesto: cada columna representa un pago y cada fila un atributo
  // (Documento, Repetición, Nombre Formato, Fecha, Estado, Valor, etc.).
  // No se exige que las filas de atributos estén en un orden concreto.
  let filaDoc=-1, docCols=[];
  for(let r=0;r<Math.min(filas.length,12);r++){
    const c=filas[r];
    const etiqueta=norm(c[0]||"");
    const esEtiquetaDocumento=etiqueta.includes("documento fuente")||etiqueta.includes("recibo")||etiqueta.includes("tdj")||etiqueta.includes("titulo de deposito")||etiqueta.includes("título de depósito");
    if(!esEtiquetaDocumento)continue;
    const candidatos=[];
    for(let col=1;col<c.length;col++){
      if(esReciboPagoSinTitulo(c[col])||esDocumentoLargo(c[col])||extraerTDJDesdeTexto(c[col]))candidatos.push(col);
    }
    if(candidatos.length>=1){filaDoc=r;docCols=candidatos;break;}
  }
  if(filaDoc<0)return [];

  const pagos=[];
  for(const col of docCols){
    let doc="",tdj="",recibo="";
    const etiquetaDoc=filas[filaDoc][0]||"";
    const rawDoc=filas[filaDoc][col]||"";
    const d=normalizarDocumento(rawDoc);
    if(norm(etiquetaDoc).includes('tdj'))tdj=d;else recibo=d;

    // Si existe otra fila explícitamente marcada como TDJ/Recibo, úsala como prioridad.
    for(let r=0;r<filas.length;r++){
      const etiqueta=filas[r][0]||"";
      const valorCelda=filas[r][col]||"";
      if(!valorCelda)continue;
      const ne=norm(etiqueta);
      const nd=normalizarDocumento(valorCelda);
      if((ne.includes('tdj')||ne.includes('titulo de deposito')) && (esDocumentoLargo(valorCelda)||esReciboPagoSinTitulo(valorCelda)))tdj=nd;
      if((ne.includes('recibo')||ne.includes('documento fuente')) && (esDocumentoLargo(valorCelda)||esReciboPagoSinTitulo(valorCelda)))recibo=nd;
    }

    let fecha="", fechaScore=-1;
    let valor=0, valorScore=-1;
    let tipo="TASA DIAN";
    let tipoScore=-1;
    for(let r=0;r<filas.length;r++){
      if(r===filaDoc)continue;
      const etiqueta=filas[r][0]||"";
      const celda=limpiarCeldaPago(filas[r][col]||"");
      if(!celda)continue;
      const f=fechaISO(celda);
      if(f){
        const score=100+puntuarEtiquetaPago(etiqueta,'fecha');
        if(score>fechaScore){fecha=f;fechaScore=score;}
      }
      const n=valorNumericoEstricto(celda);
      if(n!==null&&n>0&&!/^\d{1,2}$/.test(celda)&&!/^20\d{2}$/.test(celda)&&!esDocumentoLargo(celda)){
        const score=puntuarEtiquetaPago(etiqueta,'valor')+(/[.$]/.test(celda)?20:0);
        if(score>valorScore || (score===valorScore&&n>valor)){
          valor=n;valorScore=score;
        }
      }
      const ts=puntuarEtiquetaPago(etiqueta,'tipo');
      if(ts>tipoScore && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(celda)){
        tipo=extraerTipoDesdeTexto(celda);tipoScore=ts;
      }
    }

    // Uma coluna de documento sem valor não representa um pagamento importável.
    if(!fecha||!(valor>0)||(!recibo&&!tdj))continue;
    pagos.push({id:crypto.randomUUID(),numero:0,tdj,recibo,fecha,valor,tipo,observacion:'IMPORTADO INTELIGENTE'});
  }
  return pagos;
}

function reconocerPagosSinTitulos(lines){
  const encontrados=[];
  // Cada línea puede ser horizontal, vertical o tener los campos mezclados.
  // Se procesa por fila y, si no hay una fila completa, se agrupan por cercanía
  // alrededor de cada fecha.
  const filas=lines.map(separarFilaPagos).filter(c=>c.length);
  for(const c of filas){
    const p=reconocerFilaPago(c);
    if(p)encontrados.push(p);
    if(c.length===1 && /\s+/.test(c[0])){
      const tokens=separarTokensPagoSinTitulo(c[0]);
      const q=reconocerFilaPago(tokens);
      if(q)encontrados.push(q);
    }
  }
  if(encontrados.length)return encontrados;

  // Formato vertical sin títulos: cada pago puede venir como un bloque de
  // líneas (documento, estado, fecha, valor) y el orden de esas líneas puede
  // variar. Asociamos cada fecha con el valor numérico no usado más cercano y
  // con el documento más cercano, evitando mezclar pagos consecutivos.
  const usadosValores=new Set();
  for(let i=0;i<filas.length;i++){
    let fecha="";
    for(const cell of filas[i]){const f=fechaISO(cell);if(f){fecha=f;break;}}
    if(!fecha)continue;
    let mejorValor=null;
    for(let j=0;j<filas.length;j++){
      if(usadosValores.has(j))continue;
      for(const cell of filas[j]){
        const n=valorNumericoEstricto(cell);
        if(n===null||n<=0||/^\d{1,2}$/.test(limpiarCeldaPago(cell))||esDocumentoLargo(cell))continue;
        const dist=Math.abs(j-i);
        if(dist>3)continue;
        const score=dist*100+(j<i?5:0);
        if(!mejorValor||score<mejorValor.score)mejorValor={j,n,score};
      }
    }
    if(!mejorValor)continue;
    let mejorDoc=null;
    for(let j=Math.max(0,i-4);j<=Math.min(filas.length-1,i+4);j++){
      for(const cell of filas[j]){
        const tdj=extraerTDJDesdeTexto(cell);
        if(tdj || esReciboPagoSinTitulo(cell)||esDocumentoLargo(cell)){
          const d=tdj||normalizarDocumento(cell),dist=Math.abs(j-i);
          if(!mejorDoc||dist<mejorDoc.dist)mejorDoc={d,dist,tdj:!!tdj};
        }
      }
    }
    if(!mejorDoc)continue;
    usadosValores.add(mejorValor.j);
    const p={id:crypto.randomUUID(),numero:0,tdj:mejorDoc.tdj?mejorDoc.d:"",recibo:mejorDoc.tdj?"":mejorDoc.d,fecha,valor:mejorValor.n,tipo:mejorDoc.tdj?"TDJ":"TASA DIAN",observacion:"IMPORTADO INTELIGENTE"};
    p.valor=truncarValorEntero(p.valor);
    const clave=`${p.recibo}|${p.fecha}|${p.valor}`;
    if(!encontrados.some(x=>`${x.recibo}|${x.fecha}|${x.valor}`===clave))encontrados.push(p);
  }
  return encontrados;
}
function deduplicarPagos(pagos){
  const vistos=new Set();
  return pagos.filter(p=>{
    const recibo=String(p.recibo||"").replace(/\D/g,"");
    const tdj=String(p.tdj||"").replace(/\D/g,"");
    p.valor=truncarValorEntero(p.valor);
    const clave=recibo?`R|${recibo}|${p.fecha}|${p.valor}`:tdj?`T|${tdj}|${p.fecha}|${p.valor}`:`P|${p.fecha}|${p.valor}|${p.tdj||""}`;
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

  // Importación inteligente de pagos: analiza encabezados, filas, columnas,
  // notación científica y pegados sin títulos sin depender de un orden fijo.
  const pagosTranspuestos=reconocerPagosTranspuestosInteligente(lines);
  const pagosTabulares=reconocerPagosTabularesInteligente(lines);
  if(pagosTranspuestos.length) obligacion.pagos.push(...pagosTranspuestos);
  if(pagosTabulares.length) obligacion.pagos.push(...pagosTabulares);
  if(!pagosTranspuestos.length && !pagosTabulares.length) obligacion.pagos.push(...reconocerPagosSinTitulos(lines));

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
