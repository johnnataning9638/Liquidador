const norm=v=>{const s=String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[–—−]/g,"-").replace(/\s+/g," ").trim().toUpperCase();const equivalencias={"DOCUMENTO FUENTE":"TDJ","FECHA PRESENTACION":"FECHA","VALOR PAGADO":"VALOR","NO.":"Nº"};return equivalencias[s]||s;};
const textDecoder=new TextDecoder("utf-8");
function u16(d,o){return d.getUint16(o,true)} function u32(d,o){return d.getUint32(o,true)}
function findEOCD(b){for(let i=b.length-22;i>=Math.max(0,b.length-22-65557);i--){if(b[i]===80&&b[i+1]===75&&b[i+2]===5&&b[i+3]===6)return i}throw new Error("No se encontró una estructura XLSX válida.")}
async function inflateRaw(bytes){if(typeof DecompressionStream!=="function")throw new Error("Este navegador no permite descomprimir XLSX. Use el archivo Excel exportado por el liquidador en Chrome o Edge.");const ds=new DecompressionStream("deflate-raw");const ab=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();return new Uint8Array(ab)}
async function unzipEntries(buffer){const b=new Uint8Array(buffer),d=new DataView(buffer),e=findEOCD(b),count=u16(d,e+10),cdOff=u32(d,e+16),out={};let p=cdOff;for(let i=0;i<count;i++){if(u32(d,p)!==0x02014b50)break;const method=u16(d,p+10),cs=u32(d,p+20),us=u32(d,p+24),nl=u16(d,p+28),xl=u16(d,p+30),cl=u16(d,p+32),off=u32(d,p+42);const name=textDecoder.decode(b.slice(p+46,p+46+nl));const lp=off;if(u32(d,lp)!==0x04034b50)throw new Error("XLSX con estructura de archivo no compatible.");const lnl=u16(d,lp+26),lxl=u16(d,lp+28),start=lp+30+lnl+lxl,raw=b.slice(start,start+cs);let data;if(method===0)data=raw;else if(method===8)data=await inflateRaw(raw);else throw new Error(`Compresión XLSX no compatible en ${name}.`);if(us&&data.length!==us){}out[name]=data;p+=46+nl+xl+cl}return out}
function xmlText(el){return String(el?.textContent??"")}
function colNum(ref){let s=String(ref||"").replace(/\d+$/,""),n=0;for(const c of s)n=n*26+c.charCodeAt(0)-64;return n}
function parseSharedStrings(xmlBytes){if(!xmlBytes)return [];const xml=textDecoder.decode(xmlBytes),doc=new DOMParser().parseFromString(xml,"application/xml");if(doc.querySelector("parsererror"))return [];const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";return [...doc.getElementsByTagNameNS(ns,"si")].map(si=>[...si.getElementsByTagNameNS(ns,"t")].map(t=>xmlText(t)).join(""))}
function parseSheet(xmlBytes,sharedStrings=[]){const xml=textDecoder.decode(xmlBytes),doc=new DOMParser().parseFromString(xml,"application/xml");if(doc.querySelector("parsererror"))throw new Error("No se pudo leer la hoja del Excel.");const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main",rows=[];for(const rn of doc.getElementsByTagNameNS(ns,"row")){const cells=[...rn.getElementsByTagNameNS(ns,"c")],obj={};for(const c of cells){const ref=c.getAttribute("r")||"",col=colNum(ref),type=c.getAttribute("t")||"";let val="";const is=c.getElementsByTagNameNS(ns,"is")[0],v=c.getElementsByTagNameNS(ns,"v")[0],raw=xmlText(v);if(type==="s"){const idx=Number(raw);val=Number.isInteger(idx)&&idx>=0&&idx<sharedStrings.length?sharedStrings[idx]:raw}else if(type==="inlineStr"){val=xmlText(is?.getElementsByTagNameNS(ns,"t")[0]||is)}else if(type==="str"){val=raw}else val=raw;obj[col]=val}const max=Math.max(0,...Object.keys(obj).map(Number));const row=Array(max).fill("");for(const [k,v] of Object.entries(obj))row[Number(k)-1]=v;rows.push(row)}return rows}
export async function leerXlsxPrimeraHoja(file){const buf=await file.arrayBuffer(),entries=await unzipEntries(buf);let sheet=entries["xl/worksheets/sheet1.xml"];if(!sheet){const k=Object.keys(entries).find(x=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(x));sheet=k&&entries[k]}if(!sheet)throw new Error("El Excel no contiene una hoja de datos compatible.");const shared=parseSharedStrings(entries["xl/sharedStrings.xml"]);return parseSheet(sheet,shared)}
export function numExcel(v){if(typeof v==="number")return Number.isFinite(v)?v:0;let s=String(v??"").trim();if(!s)return 0;s=s.replace(/\s/g,"").replace(/\$/g,"");if(/^[-+]?\d+(?:\.\d+)?e[-+]?\d+$/i.test(s))return Number(s)||0;if(s.includes(".")&&s.includes(",")){s=s.replace(/\./g,"").replace(",",".")}else if(/^-?\d{1,3}(?:\.\d{3})+$/.test(s)){s=s.replace(/\./g,"")}else if(s.includes(",")){const parts=s.split(",");if(parts.length>1&&parts.at(-1).length<=2)s=parts.slice(0,-1).join("")+"."+parts.at(-1);else s=s.replace(/,/g,"")}return Number(s)||0}
export function fechaExcel(v){const s=String(v??"").trim();if(!s)return "";if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);if(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)){const [d,m,y]=s.split("/").map(Number),yy=y<100?2000+y:y;return `${yy}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`}return s}
export function filaHeader(rows,pred){return rows.findIndex(r=>pred(norm(r.map(x=>norm(x)).join(" | "))))}
export {norm};

/* CONTROL 16.33.180 — RECUPERACIÓN COMPLETA COMO FUENTE DE VERDAD. */
function textoFilaRecovery(row){return norm((row||[]).filter(v=>v!==null&&v!==undefined&&String(v)!=="").join(" | "));}
function indiceFilaRecovery(rows,pred,desde=0){for(let i=desde;i<rows.length;i++)if(pred(textoFilaRecovery(rows[i])))return i;return -1;}
function leerSeccionPagosRecovery(rows,headerIdx){
  if(headerIdx<0)return [];
  const h=rows[headerIdx]||[],n=h.map(norm);
  const ixT=n.findIndex(x=>["TDJ Nº","TDJ","TITULO","TÍTULO"].map(norm).includes(x));
  const ixR=n.findIndex(x=>["RECIBO Nº","RECIBO","RECIBO NÚMERO"].map(norm).includes(x));
  const ixF=n.findIndex(x=>["FECHA","FECHA PAGO","FECHA PAGO / CORTE"].map(norm).includes(x));
  const ixV=n.findIndex(x=>["VALOR","VALOR PAGO","VALOR PAGADO"].map(norm).includes(x));
  const ixTipo=n.findIndex(x=>x==="TIPO"),ixObs=n.findIndex(x=>x==="OBSERVACIÓN"||x==="OBSERVACION");
  if(ixF<0||ixV<0)return [];
  const out=[];
  for(let i=headerIdx+1;i<rows.length;i++){
    const r=rows[i]||[],s=textoFilaRecovery(r);
    if(!s){if(out.length)break;continue;}
    if(/^(TITULOS TDJ|TÍTULOS TDJ|FIN RECUPERACION COMPLETA|FIN RECUPERACIÓN COMPLETA)/.test(s))break;
    const f=fechaExcel(r[ixF]),valor=Math.trunc(numExcel(r[ixV]));
    const tdj=ixT>=0?String(r[ixT]??"").trim():"",recibo=ixR>=0?String(r[ixR]??"").trim():"";
    if(!f&&!valor&&!tdj&&!recibo)continue;
    out.push({tdj:tdj.toUpperCase(),recibo:tdj?"":recibo.toUpperCase(),fecha:f||"",valor:Number.isFinite(valor)?valor:0,tipo:(ixTipo>=0?String(r[ixTipo]??""):"TASA DIAN").trim().toUpperCase()||"TASA DIAN",observacion:(ixObs>=0?String(r[ixObs]??""):"").trim().toUpperCase()});
  }
  return out;
}
function leerTitulosRecovery(rows,headerIdx){
  if(headerIdx<0)return [];
  const h=rows[headerIdx]||[],n=h.map(norm);
  const ixT=n.findIndex(x=>x==="TDJ"),ixF=n.findIndex(x=>x==="FECHA"),ixV=n.findIndex(x=>x==="VALOR"||x==="VALOR ORIGINAL"),ixTipo=n.findIndex(x=>x==="TIPO"),ixObs=n.findIndex(x=>x==="OBSERVACIÓN"||x==="OBSERVACION");
  if(ixT<0||ixF<0||ixV<0)return [];
  const out=[];
  for(let i=headerIdx+1;i<rows.length;i++){
    const r=rows[i]||[],s=textoFilaRecovery(r);if(!s)break;if(/^FIN RECUPERACION COMPLETA|^FIN RECUPERACIÓN COMPLETA/.test(s))break;
    const tdj=String(r[ixT]??"").trim(),f=fechaExcel(r[ixF]),valor=Math.trunc(numExcel(r[ixV]));
    if(!tdj||!f||!Number.isFinite(valor)||valor<0)continue;
    out.push({tdj:tdj.toUpperCase(),fecha:f,valor,tipo:(ixTipo>=0?String(r[ixTipo]??""):"TASA DIAN").trim().toUpperCase()||"TASA DIAN",observacion:(ixObs>=0?String(r[ixObs]??""):"").trim().toUpperCase()});
  }
  return out;
}
function fechaVisibleRecovery(iso){const s=fechaExcel(iso);if(!s)return "";const [y,m,d]=s.split("-");return `${d}/${m}/${y}`;}
function fusionarRecoveryPagos(pagosRecovery,titulosRecovery){
  const porTDJ=new Map(titulosRecovery.map(t=>[String(t.tdj).trim(),t])),usados=new Set();
  const salida=pagosRecovery.map(p=>{const key=String(p.tdj||"").trim();if(!key)return p;const t=porTDJ.get(key);if(!t)return p;usados.add(key);return {...p,tdj:t.tdj,fecha:t.fecha,valor:t.valor,tipo:t.tipo||p.tipo,observacion:t.observacion||p.observacion};});
  for(const t of titulosRecovery){const key=String(t.tdj).trim();if(usados.has(key)||salida.some(p=>String(p.tdj||"").trim()===key))continue;salida.push({tdj:t.tdj,recibo:"",fecha:t.fecha,valor:t.valor,tipo:t.tipo||"TASA DIAN",observacion:t.observacion||""});}
  return salida;
}
function limpiarPagosRecoveryUI(){const tbody=document.querySelector("#tablaPagos tbody");if(!tbody)return;let boton=tbody.querySelector("button[data-del]");while(boton){boton.click();boton=tbody.querySelector("button[data-del]");}}
async function aplicarPagosRecoveryUI(pagosRecovery){
  const agregar=document.getElementById("btnAgregarPago"),tbody=document.querySelector("#tablaPagos tbody");if(!agregar||!tbody)throw new Error("No se encontró la tabla de pagos del Liquidador para restaurar la información completa.");
  limpiarPagosRecoveryUI();
  for(const p of pagosRecovery){
    agregar.click();const tr=tbody.lastElementChild;if(!tr)continue;
    const tdj=tr.querySelector('[data-k="tdj"]'),recibo=tr.querySelector('[data-k="recibo"]'),fecha=tr.querySelector(".fecha-campo"),picker=tr.querySelector(".fecha-native"),valor=tr.querySelector('[data-k="valor"]'),tipo=tr.querySelector('[data-k="tipo"]'),obs=tr.querySelector('[data-k="observacion"]');
    if(tdj){tdj.value=p.tdj||"";tdj.dispatchEvent(new Event("input",{bubbles:true}));tdj.dispatchEvent(new Event("change",{bubbles:true}));}
    if(recibo){recibo.value=p.recibo||"";recibo.dispatchEvent(new Event("input",{bubbles:true}));recibo.dispatchEvent(new Event("change",{bubbles:true}));}
    if(fecha){fecha.value=fechaVisibleRecovery(p.fecha);fecha.dispatchEvent(new Event("input",{bubbles:true}));fecha.dispatchEvent(new Event("blur",{bubbles:true}));}
    if(picker)picker.value=p.fecha||"";
    if(valor){valor.value=String(p.valor||0);valor.dispatchEvent(new Event("input",{bubbles:true}));valor.dispatchEvent(new Event("change",{bubbles:true}));}
    if(tipo){tipo.value=p.tipo||"TASA DIAN";tipo.dispatchEvent(new Event("change",{bubbles:true}));}
    if(obs){obs.value=p.observacion||"";obs.dispatchEvent(new Event("input",{bubbles:true}));obs.dispatchEvent(new Event("change",{bubbles:true}));}
  }
}
async function corregirImportacionRecovery(file){
  try{
    const rows=await leerXlsxPrimeraHoja(file),recovery=indiceFilaRecovery(rows,s=>s.includes("RECUPERACION COMPLETA")||s.includes("RECUPERACIÓN COMPLETA"));if(recovery<0)return;
    const pagosHeader=indiceFilaRecovery(rows,s=>s.startsWith("PAGOS | Nº | TDJ Nº | RECIBO Nº | FECHA | VALOR | TIPO | OBSERVACION"),recovery+1);
    const titulosHeader=indiceFilaRecovery(rows,s=>s.startsWith("TITULOS TDJ | Nº | TDJ | FECHA | VALOR | TIPO | OBSERVACION"),recovery+1);
    const pagosRecovery=leerSeccionPagosRecovery(rows,pagosHeader),titulosRecovery=leerTitulosRecovery(rows,titulosHeader);if(!pagosRecovery.length&&!titulosRecovery.length)return;
    await aplicarPagosRecoveryUI(fusionarRecoveryPagos(pagosRecovery,titulosRecovery));
    console.info("CONTROL 16.33.180 — recuperación completa aplicada como fuente de verdad",{pagos:pagosRecovery.length,titulos:titulosRecovery.length});
  }catch(e){console.warn("CONTROL 16.33.180 — no fue posible restaurar recuperación completa:",e);}
}
(function instalarControlRecovery(){
  if(typeof EventTarget==="undefined")return;const originalAdd=EventTarget.prototype.addEventListener;if(originalAdd.__controlRecovery180)return;
  function add(type,listener,options){
    const esInputExcel=this&&this.tagName==="INPUT"&&String(this.type||"").toLowerCase()==="file"&&/xlsx|spreadsheetml|\.xlsx/i.test(String(this.accept||""));
    if(esInputExcel&&type==="change"&&typeof listener==="function"&&!listener.__controlRecovery180){const originalListener=listener;const wrapped=async function(event){let exito=false;try{await originalListener.call(this,event);exito=true}finally{if(exito){const file=this.files?.[0];if(file)await corregirImportacionRecovery(file);}}};wrapped.__controlRecovery180=true;return originalAdd.call(this,type,wrapped,options)}
    return originalAdd.call(this,type,listener,options);
  }
  add.__controlRecovery180=true;EventTarget.prototype.addEventListener=add;originalAdd.__controlRecovery180=true;
})();

if(!document.querySelector('#tablaTitulos'))import('./export-dian-tdj-control-16.33.178.js?v=16.33.178').catch(()=>{});
