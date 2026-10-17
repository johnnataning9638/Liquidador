// TDJ IMPORTADOR v16.33.166
// CAPA AISLADA DE IMPORTACIÓN DE TÍTULOS / TDJ.
// No modifica obligaciones, motor, pagos ni resultados.

const normTextoTDJ = v => String(v ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[º°]/g, "")
  .replace(/\s+/g, " ").trim().toUpperCase();

function limpiarCeldaTDJ(v){
  return String(v ?? "").replace(/\r/g, "").trim().replace(/^\|+|\|+$/g, "").trim();
}

function separarCeldasTDJ(linea) {
  const s = String(linea ?? "").replace(/\r/g, "").trim();
  if (!s) return [];
  if (s.includes("\t")) return s.split("\t").map(limpiarCeldaTDJ).filter(Boolean);
  if (s.includes("|")) return s.split("|").map(limpiarCeldaTDJ).filter(Boolean);
  return s.split(/\s{2,}/).map(limpiarCeldaTDJ).filter(Boolean);
}

function digitosTDJ(v) { return String(v ?? "").replace(/\D/g, ""); }

function expandirNotacionCientificaTDJ(v){
  const s=String(v ?? "").trim().replace(/\s/g, "");
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+$/.test(s))return s;
  const n=Number(s);
  if(!Number.isFinite(n))return "";
  return String(Math.trunc(n));
}

export function esDocumentoFuenteTDJ(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return false;
  const expandido=expandirNotacionCientificaTDJ(raw);
  if(!expandido || /[A-Za-z]/.test(expandido)) return false;
  return /^\d{10,15}$/.test(digitosTDJ(expandido));
}

function normalizarDocumentoTDJ(v) {
  const expandido=expandirNotacionCientificaTDJ(v);
  return esDocumentoFuenteTDJ(expandido) ? digitosTDJ(expandido) : "";
}

function normalizarFechaTDJ(v) {
  const s=String(v ?? "").trim();
  let m=s.match(/\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
  if(m){
    const [,y,mo,d]=m;
    const iso=`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dt=new Date(`${iso}T00:00:00`);
    return Number.isNaN(dt.getTime())?"":iso;
  }
  m=s.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if(!m)return "";
  let [,d,mo,y]=m;
  if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;
  const iso=`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const dt=new Date(`${iso}T00:00:00`);
  return Number.isNaN(dt.getTime())?"":iso;
}

function normalizarValorTDJ(v) {
  const s=String(v ?? "").trim();
  if(!s)return 0;
  const limpio=s.replace(/\$/g, "").replace(/\s/g, "");
  if(!limpio)return 0;
  const expandido=expandirNotacionCientificaTDJ(limpio);
  if(expandido!==limpio && expandido)return Math.trunc(Number(expandido));
  if(/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(limpio))return Math.trunc(Number(limpio.replace(/\./g,"")));
  if(/^[+-]?\d{1,3}(?:,\d{3})+$/.test(limpio))return Math.trunc(Number(limpio.replace(/,/g,"")));
  if(/^[+-]?\d+$/.test(limpio))return Number(limpio);
  let normalizado=limpio;
  if(normalizado.includes(".")&&normalizado.includes(",")){
    if(/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(normalizado))normalizado=normalizado.replace(/,/g,"");
    else if(/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(normalizado))normalizado=normalizado.replace(/\./g,"").replace(",",".");
    else{const ultimoPunto=normalizado.lastIndexOf("."),ultimaComa=normalizado.lastIndexOf(",");if(ultimoPunto>ultimaComa)normalizado=normalizado.replace(/,/g,"");else normalizado=normalizado.replace(/\./g,"").replace(",",".");}
  }else if(normalizado.includes(".")){
    const partes=normalizado.split(".");
    if(partes.length===2&&/^\d{1,2}$/.test(partes[1]))normalizado=`${partes[0]}.${partes[1]}`;
    else if(/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(normalizado))normalizado=normalizado.replace(/\./g,"");
    else normalizado=normalizado.replace(/\./g,"");
  }else if(normalizado.includes(",")){
    const partes=normalizado.split(",");
    if(partes.length===2&&/^\d{1,2}$/.test(partes[1]))normalizado=`${partes[0]}.${partes[1]}`;
    else if(/^[+-]?\d{1,3}(?:,\d{3})+$/.test(normalizado))normalizado=normalizado.replace(/,/g,"");
    else normalizado=normalizado.replace(/,/g,"");
  }
  const n=Number(normalizado);
  return Number.isFinite(n)?Math.trunc(n):0;
}

function indiceCabeceraTDJ(headers,aliases){
  const h=headers.map(normTextoTDJ);
  for(const alias of aliases){const i=h.findIndex(x=>x===normTextoTDJ(alias));if(i>=0)return i;}
  return -1;
}
function encontrarDocTDJ(celdas){for(const c of celdas){const d=normalizarDocumentoTDJ(c);if(d)return d;}return "";}
function encontrarFechaTDJ(celdas){for(const c of celdas){const f=normalizarFechaTDJ(c);if(f)return f;}return "";}
function encontrarValorTDJ(celdas,indiceDoc=-1,indiceFecha=-1){
  const fechaIndex=indiceFecha>=0?indiceFecha:celdas.findIndex(c=>Boolean(normalizarFechaTDJ(c)));
  for(let i=celdas.length-1;i>=0;i--){
    if(i===indiceDoc||i===indiceFecha||(fechaIndex>=0&&i<=fechaIndex))continue;
    const c=String(celdas[i]??"").trim();
    if(!c||esDocumentoFuenteTDJ(c)||normalizarFechaTDJ(c))continue;
    const n=normalizarValorTDJ(c);if(n>0)return n;
  }
  return 0;
}
function filaTDJ(celdas,idxDoc=-1,idxFecha=-1,idxValor=-1){
  if(!celdas.length)return null;
  const docPreferido=idxDoc>=0?normalizarDocumentoTDJ(celdas[idxDoc]):"";
  const doc=docPreferido||encontrarDocTDJ(celdas);if(!doc)return null;
  const fechaPreferida=idxFecha>=0?normalizarFechaTDJ(celdas[idxFecha]):"";
  const fecha=fechaPreferida||encontrarFechaTDJ(celdas);if(!fecha)return null;
  const fechaIndex=idxFecha>=0&&normalizarFechaTDJ(celdas[idxFecha])?idxFecha:celdas.findIndex(c=>normalizarFechaTDJ(c)===fecha);
  const valorPreferido=idxValor>=0&&idxValor<celdas.length?normalizarValorTDJ(celdas[idxValor]):0;
  const valor=valorPreferido>0?valorPreferido:encontrarValorTDJ(celdas,idxDoc,fechaIndex);if(!(valor>0))return null;
  return {tdj:doc,fecha,valor};
}

export function extraerRegistrosTDJTexto(texto){
  const lineas=String(texto??"").replace(/\r/g,"").split("\n").filter(x=>x.trim());
  if(!lineas.length)return [];
  const filas=lineas.map(separarCeldasTDJ).filter(Boolean);if(!filas.length)return [];
  const headerIndex=filas.findIndex(cells=>{
    const h=cells.map(normTextoTDJ);
    const tieneDoc=h.some(x=>/DOCUMENTO FUENTE|RECIBO|TDJ|TITULO|TITULO DEPOSITO|NUMERO/.test(x));
    const tieneFecha=h.some(x=>/FECHA PRESENTACION|FECHA DE PRESENTACION|FECHA|FECHA TDJ/.test(x));
    const tieneValor=h.some(x=>/VALOR PAGADO|VALOR PAGO|VALOR TDJ|VALOR/.test(x));
    return tieneDoc&&tieneFecha&&tieneValor;
  });
  let idxDoc=-1,idxFecha=-1,idxValor=-1,inicio=0;
  if(headerIndex>=0){
    const headers=filas[headerIndex];
    idxDoc=indiceCabeceraTDJ(headers,["NO. DOCUMENTO FUENTE","N° DOCUMENTO FUENTE","NUMERO DOCUMENTO FUENTE","NÚMERO DOCUMENTO FUENTE","DOCUMENTO FUENTE","RECIBO","Nº RECIBO","NO RECIBO","TDJ","Nº TDJ","NO. TDJ","NUMERO TDJ","NÚMERO TDJ","TITULO","TÍTULO"]);
    idxFecha=indiceCabeceraTDJ(headers,["FECHA PRESENTACION","FECHA DE PRESENTACION","FECHA PRESENTACIÓN","FECHA DE PRESENTACIÓN","FECHA TDJ","FECHA"]);
    idxValor=indiceCabeceraTDJ(headers,["VALOR PAGADO","VALOR PAGO","VALOR TDJ","VALOR"]);
    inicio=headerIndex+1;
  }
  const out=[],vistos=new Set();
  for(let r=inicio;r<filas.length;r++){
    const item=filaTDJ(filas[r],idxDoc,idxFecha,idxValor);if(!item)continue;
    const key=`${item.tdj}|${item.fecha}`;if(vistos.has(key))continue;vistos.add(key);out.push(item);
  }
  return out;
}
