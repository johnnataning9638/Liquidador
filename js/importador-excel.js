const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[–—−]/g,"-").replace(/\s+/g," ").trim().toUpperCase();
const textDecoder=new TextDecoder("utf-8");
function u16(d,o){return d.getUint16(o,true)} function u32(d,o){return d.getUint32(o,true)}
function findEOCD(b){for(let i=b.length-22;i>=Math.max(0,b.length-22-65557);i--){if(b[i]===80&&b[i+1]===75&&b[i+2]===5&&b[i+3]===6)return i}throw new Error("No se encontró una estructura XLSX válida.")}
async function inflateRaw(bytes){if(typeof DecompressionStream!=="function")throw new Error("Este navegador no permite descomprimir XLSX. Use el archivo Excel exportado por el liquidador en Chrome o Edge.");const ds=new DecompressionStream("deflate-raw");const ab=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();return new Uint8Array(ab)}
async function unzipEntries(buffer){const b=new Uint8Array(buffer),d=new DataView(buffer),e=findEOCD(b),count=u16(d,e+10),cdSize=u32(d,e+12),cdOff=u32(d,e+16),out={};let p=cdOff;for(let i=0;i<count;i++){if(u32(d,p)!==0x02014b50)break;const method=u16(d,p+10),cs=u32(d,p+20),us=u32(d,p+24),nl=u16(d,p+28),xl=u16(d,p+30),cl=u16(d,p+32),off=u32(d,p+42);const name=textDecoder.decode(b.slice(p+46,p+46+nl));const lp=off;if(u32(d,lp)!==0x04034b50)throw new Error("XLSX con estructura de archivo no compatible.");const lnl=u16(d,lp+26),lxl=u16(d,lp+28),start=lp+30+lnl+lxl,raw=b.slice(start,start+cs);let data;if(method===0)data=raw;else if(method===8)data=await inflateRaw(raw);else throw new Error(`Compresión XLSX no compatible en ${name}.`);if(us&&data.length!==us){}out[name]=data;p+=46+nl+xl+cl}return out}
function xmlText(el){return String(el?.textContent??"")}
function colNum(ref){let s=String(ref||"").replace(/\d+$/,""),n=0;for(const c of s)n=n*26+c.charCodeAt(0)-64;return n}
function parseSharedStrings(xmlBytes){
  if(!xmlBytes)return [];
  const xml=textDecoder.decode(xmlBytes),doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.querySelector("parsererror"))return [];
  const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  return [...doc.getElementsByTagNameNS(ns,"si")].map(si=>{
    const ts=[...si.getElementsByTagNameNS(ns,"t")];
    return ts.map(t=>xmlText(t)).join("");
  });
}
function parseSheet(xmlBytes,sharedStrings=[]){const xml=textDecoder.decode(xmlBytes),doc=new DOMParser().parseFromString(xml,"application/xml");if(doc.querySelector("parsererror"))throw new Error("No se pudo leer la hoja del Excel.");const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main",rows=[];for(const rn of doc.getElementsByTagNameNS(ns,"row")){const cells=[...rn.getElementsByTagNameNS(ns,"c")],obj={};for(const c of cells){const ref=c.getAttribute("r")||"",col=colNum(ref),type=c.getAttribute("t")||"";let val="";const is=c.getElementsByTagNameNS(ns,"is")[0];const v=c.getElementsByTagNameNS(ns,"v")[0];const raw=xmlText(v);if(type==="s"){const idx=Number(raw);val=Number.isInteger(idx)&&idx>=0&&idx<sharedStrings.length?sharedStrings[idx]:raw}else if(type==="inlineStr"){val=xmlText(is?.getElementsByTagNameNS(ns,"t")[0]||is)}else if(type==="str"){val=xmlText(v)}else{val=raw}obj[col]=val}const max=Math.max(0,...Object.keys(obj).map(Number));const row=Array(max).fill("");for(const [k,v] of Object.entries(obj))row[Number(k)-1]=v;rows.push(row)}return rows}

export async function leerXlsxPrimeraHoja(file){const buf=await file.arrayBuffer(),entries=await unzipEntries(buf);let sheet=entries["xl/worksheets/sheet1.xml"];if(!sheet){const k=Object.keys(entries).find(x=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(x));sheet=k&&entries[k]}if(!sheet)throw new Error("El Excel no contiene una hoja de datos compatible.");const shared=parseSharedStrings(entries["xl/sharedStrings.xml"]);return parseSheet(sheet,shared)}
export function numExcel(v){if(typeof v==="number")return Number.isFinite(v)?v:0;let s=String(v??"").trim();if(!s)return 0;s=s.replace(/\s/g,"").replace(/\$/g,"");if(/^[-+]?\d+(?:\.\d+)?e[-+]?\d+$/i.test(s))return Number(s)||0;if(s.includes(".")&&s.includes(",")){s=s.replace(/\./g,"").replace(",",".")}else if(/^-?\d{1,3}(?:\.\d{3})+$/.test(s)){s=s.replace(/\./g,"")}else if(s.includes(",")){const parts=s.split(",");if(parts.length>1&&parts.at(-1).length<=2)s=parts.slice(0,-1).join("")+"."+parts.at(-1);else s=s.replace(/,/g,"")}return Number(s)||0}
export function fechaExcel(v){const s=String(v??"").trim();if(!s)return "";if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);if(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)){const [d,m,y]=s.split("/").map(Number);const yy=y<100?2000+y:y;return `${yy}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`}return s}
export function filaHeader(rows,pred){return rows.findIndex(r=>pred(norm(r.map(x=>norm(x)).join(" | "))))}
export {norm};
