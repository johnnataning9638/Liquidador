const DEFAULT_AI_URL = "https://ai-liquidador.onrender.com";
const LOCAL_AI_URL = "http://127.0.0.1:8787";

function esMotorLocal(url){
  const s=String(url||"").trim().toLowerCase();
  return s===LOCAL_AI_URL || s.startsWith(LOCAL_AI_URL+"/") || s.startsWith("http://localhost:8787");
}

export function getAIEndpoint(){
  try{
    const stored=localStorage.getItem("dianAiEndpoint")||"";
    if(stored) return stored;
    return DEFAULT_AI_URL;
  }catch{return DEFAULT_AI_URL;}
}

let aiState={estado:"NO COMPROBADO",version:"—",confidence:null,pagosValidos:0,anomalies:0,timestamp:null};
let aiHealthPromise=null;
let aiHealthAt=0;
let aiHealthOk=false;
const AI_HEALTH_CACHE_MS=45000;
const AI_HEALTH_TIMEOUT_MS=5000;

export function getEstadoIA(){return {...aiState};}
function actualizarEstadoIA(p={}){aiState={...aiState,...p,timestamp:p.timestamp||new Date().toISOString()};try{window.dispatchEvent(new CustomEvent("dian-ai-status",{detail:{...aiState}}));}catch{}}

export function setAIEndpoint(url){
  const value=String(url||"").trim().replace(/\/$/,"");
  if(!value)throw new Error("La URL del motor IA no puede estar vacía.");
  try{localStorage.setItem("dianAiEndpoint",value);}catch{}
  return value;
}

export async function comprobarMotorIA(opciones={}){
  const force=Boolean(opciones?.force);
  const ahora=Date.now();
  if(!force && aiHealthOk && (ahora-aiHealthAt)<AI_HEALTH_CACHE_MS){return {ok:true,version:aiState.version,fromCache:true};}
  if(aiHealthPromise)return aiHealthPromise;
  const endpoint=getAIEndpoint();
  aiHealthPromise=(async()=>{
    const controller=typeof AbortController!=="undefined"?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),AI_HEALTH_TIMEOUT_MS):null;
    try{
      const r=await fetch(`${endpoint}/health`,{method:"GET",cache:"no-store",signal:controller?.signal});
      if(!r.ok)throw new Error(`Motor IA respondió HTTP ${r.status}.`);
      const data=await r.json();
      if(!data?.ok)throw new Error("El motor IA no reportó estado OK.");
      aiHealthOk=true;aiHealthAt=Date.now();actualizarEstadoIA({estado:"CONECTADO",version:data.version||"—",confidence:null,anomalies:0});return data;
    }catch(e){if(!aiHealthOk)actualizarEstadoIA({estado:"NO COMPROBADO",version:"—",confidence:null,anomalies:0});throw e;
    }finally{if(timer)clearTimeout(timer);aiHealthPromise=null;}
  })();
  return aiHealthPromise;
}

function normalizarPagoIA(row){
  if(!row||typeof row!=="object")return null;
  const tipo=String(row.tipo||"").toUpperCase();
  const tdj=String(row.tdj_no||"").replace(/\D/g,"");
  const recibo=String(row.recibo_no||"").replace(/\D/g,"");
  const fechaRaw=String(row.fecha_pago||"").trim();
  const fechaMatch=fechaRaw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  const fecha=fechaMatch?`${String(Number(fechaMatch[3])<100?((Number(fechaMatch[3])<=69?2000:1900)+Number(fechaMatch[3])):Number(fechaMatch[3])).padStart(4,"0")}-${String(Number(fechaMatch[2])).padStart(2,"0")}-${String(Number(fechaMatch[1])).padStart(2,"0")}`:fechaRaw;
  const valorRaw=row.valor_pago;
  let valor=Number(valorRaw);
  if(!Number.isFinite(valor)&&typeof valorRaw==="string"){
    const s=valorRaw.trim().replace(/[$\s]/g,"");
    if(/^\d{1,3}(?:[.,]\d{3})+$/.test(s))valor=Number(s.replace(/[.,]/g,""));
    else if(/^\d+$/.test(s))valor=Number(s);
  }
  if(!fecha||!Number.isFinite(valor)||valor<=0)return null;
  if(tipo!=="TDJ"&&!tdj&&!recibo)return null;
  return {id:crypto.randomUUID(),numero:0,tdj:tipo==="TDJ"?tdj:(tdj||""),recibo:tipo==="TDJ"?"":(recibo||""),fecha,valor,tipo:tipo||(tdj?"TDJ":"RECIBO"),tasa:String(row.tasa||""),observacion:String(row.observacion||"IMPORTADO IA DIAN"),aiConfidence:Number.isFinite(Number(row.confidence))?Number(row.confidence):null,aiAnomalies:Array.isArray(row.anomalies)?row.anomalies:[]};
}

function validarPagosIA(pagos){
  const out=[];
  const seen=new Set();
  for(const row of pagos||[]){
    const p=normalizarPagoIA(row);
    if(!p)continue;
    // TDJ: si la IA entrega la columna Repetición ("1") y además el
    // documento completo para la misma fecha/valor, conservar únicamente
    // el identificador completo. No se mezclan dos TDJ reales largos.
    if(p.tipo==="TDJ"){
      const idx=out.findIndex(x=>x.tipo==="TDJ"&&x.fecha===p.fecha&&Number(x.valor)===Number(p.valor)&&((String(x.tdj||"").length<=3&&String(p.tdj||"").length>=6)||(String(p.tdj||"").length<=3&&String(x.tdj||"").length>=6)));
      if(idx>=0){
        if(String(p.tdj||"").length>String(out[idx].tdj||"").length)out[idx]=p;
        continue;
      }
    }
    const key=`${p.tipo}|${p.tdj||p.recibo}|${p.fecha}|${p.valor}`;
    if(seen.has(key))continue;
    seen.add(key);out.push(p);
  }
  out.sort((a,b)=>a.fecha.localeCompare(b.fecha));
  return out.map((p,i)=>({...p,numero:i+1}));
}

function claveDocumentoPago(p){
  const tipo=String(p?.tipo||"").toUpperCase();
  const tdj=String(p?.tdj||p?.tdj_no||"").replace(/\D/g,"");
  const recibo=String(p?.recibo||p?.recibo_no||"").replace(/\D/g,"");
  if(tdj)return `TDJ|${tdj}`;
  if(recibo)return `RECIBO|${recibo}`;
  return "";
}

function compararFidelidadPagos(deterministicos, ia){
  const base=Array.isArray(deterministicos)?deterministicos:[];
  const ai=Array.isArray(ia)?ia:[];
  const conflictos=[];
  const advertencias=[];
  const gruposBase=new Map();const gruposIA=new Map();
  for(const p of base){const k=claveDocumentoPago(p);if(k){if(!gruposBase.has(k))gruposBase.set(k,[]);gruposBase.get(k).push(p);}}
  for(const p of ai){const k=claveDocumentoPago(p);if(k){if(!gruposIA.has(k))gruposIA.set(k,[]);gruposIA.get(k).push(p);}}
  for(const [k,arrBase] of gruposBase){
    const arrIA=gruposIA.get(k)||[];const n=Math.min(arrBase.length,arrIA.length);
    for(let i=0;i<n;i++){
      const a=arrBase[i],x=arrIA[i],fA=String(a.fecha||"").trim(),fB=String(x.fecha||"").trim(),vA=Number(a.valor||0),vB=Number(x.valor||0);
      if(fA&&fB&&fA!==fB)advertencias.push(`${k} #${i+1}: fecha local ${fA} ≠ IA ${fB}; se conserva la fecha local.`);
      if(vA>0&&vB>0&&Math.abs(vA-vB)>0.5)advertencias.push(`${k} #${i+1}: valor local ${vA} ≠ IA ${vB}; se conserva el valor local.`);
    }
  }
  const baseByDV=new Map();for(const p of base)baseByDV.set(`${p.fecha}|${Number(p.valor||0)}`,p);
  for(const x of ai){const y=baseByDV.get(`${x.fecha}|${Number(x.valor||0)}`);if(!y)continue;const kd=claveDocumentoPago(y),ki=claveDocumentoPago(x);if(kd&&ki&&kd!==ki)conflictos.push(`PAGO ${x.fecha} $${Number(x.valor||0)}: documento local ${kd} ≠ IA ${ki}`);}
  if(conflictos.length)throw new Error("Validación IA de pagos: se detectaron diferencias de identidad entre la interpretación determinística y la IA. No se aplicaron los datos.\n\n"+conflictos.join("\n"));
  return advertencias;
}

export function fusionarPagosSeguros(deterministicos, ia){
  const base=Array.isArray(deterministicos)?deterministicos:[],ai=Array.isArray(ia)?ia:[],advertencias=compararFidelidadPagos(base,ai),out=base.map(p=>({...p}));
  const gruposBase=new Map(),gruposIA=new Map();
  for(const p of out){const k=claveDocumentoPago(p);if(k){if(!gruposBase.has(k))gruposBase.set(k,[]);gruposBase.get(k).push(p);}}
  for(const p of ai){const k=claveDocumentoPago(p);if(k){if(!gruposIA.has(k))gruposIA.set(k,[]);gruposIA.get(k).push(p);}}
  for(const [k,arrBase] of gruposBase){const arrIA=gruposIA.get(k)||[];for(let i=0;i<Math.min(arrBase.length,arrIA.length);i++){const local=arrBase[i],p=arrIA[i];if(!local.fecha&&p.fecha)local.fecha=p.fecha;if(!(Number(local.valor)>0)&&Number(p.valor)>0)local.valor=p.valor;if(!local.tasa&&p.tasa)local.tasa=p.tasa;if(!local.observacion)local.observacion=p.observacion||"IMPORTADO IA DIAN";}}
  for(const p of ai){const k=claveDocumentoPago(p),arr=k?gruposBase.get(k):null;if(k&&arr&&arr.length>0)continue;const misma=out.some(x=>String(x.fecha||"")===String(p.fecha||"")&&Number(x.valor||0)===Number(p.valor||0));if(misma)continue;out.push({...p});}
  out.sort((a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||"")));
  return {pagos:out.map((p,i)=>({...p,numero:i+1})),advertencias};
}

export async function enviarFeedbackIA(examples=[], source="liquidador-ia-confirmado"){
  const lista=Array.isArray(examples)?examples:[],limpios=[],vistos=new Set();
  for(const e of lista){const text=String(e?.text??"").trim(),label=String(e?.label??"").trim().toUpperCase();if(!text||!label)continue;const key=`${label}::${text}`;if(vistos.has(key))continue;vistos.add(key);limpios.push({text:text.slice(0,5000),label,source:String(e?.source||source).slice(0,80)});}
  if(!limpios.length)return {ok:true,accepted:0};
  let pendientes=[];try{const raw=localStorage.getItem("dianAiFeedbackHashes")||"[]",guardados=new Set(Array.isArray(JSON.parse(raw))?JSON.parse(raw):[]);for(const e of limpios){const hash=`${e.label}|${e.text}`;if(guardados.has(hash))continue;pendientes.push(e);}if(!pendientes.length)return {ok:true,accepted:0,duplicados:limpios.length};}catch{pendientes=limpios;}
  const r=await fetch(`${getAIEndpoint()}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmed:true,examples:pendientes.slice(0,50)}),cache:"no-store"});
  let data=null;try{data=await r.json();}catch{}if(!r.ok)throw new Error(data?.detail||`Motor IA respondió HTTP ${r.status} al guardar aprendizaje.`);
  try{const raw=localStorage.getItem("dianAiFeedbackHashes")||"[]",arr=Array.isArray(JSON.parse(raw))?JSON.parse(raw):[],set=new Set(arr);pendientes.slice(0,50).forEach(e=>set.add(`${e.label}|${e.text}`));localStorage.setItem("dianAiFeedbackHashes",JSON.stringify([...set].slice(-500)));}catch{}
  return data||{ok:true,accepted:0};
}

export async function interpretarPagosConIA(texto){
  const text=String(texto??"");if(!text.trim())throw new Error("No hay información para enviar al motor IA.");
  const r=await fetch(`${getAIEndpoint()}/interpret/payments`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text}),cache:"no-store"});
  let data=null;try{data=await r.json();}catch{}if(!r.ok)throw new Error(data?.detail||`Motor IA respondió HTTP ${r.status}.`);
  const pagos=validarPagosIA(data?.records);actualizarEstadoIA({estado:"PAGOS INTERPRETADOS",version:data?.version||"—",confidence:Number(data?.confidence||0),pagosValidos:pagos.length,anomalies:Array.isArray(data?.aiAnomalies)?data.aiAnomalies.length:0});
  return {...data,pagos,registrosReconocidos:Array.isArray(data?.records)?data.records.length:0,pagosValidos:pagos.length};
}

function normTextoObligacion(v){return String(v??"").trim().toUpperCase().replace(/\s+/g," ");}
function normNit(v){return String(v??"").replace(/\D/g,"");}
function normCuotas(lista){return (Array.isArray(lista)?lista:[]).map(c=>({numero:Number(c?.numero||0),periodo:String(c?.periodo??""),fecha:String(c?.fecha||"").trim(),impuesto:Number(c?.impuesto||0)})).filter(c=>c.numero>=1&&c.numero<=6).sort((a,b)=>a.numero-b.numero);}
function fusionarObligacionSegura(base,ai){
  const a=base||{},b=ai||{},advertencias=[],nitA=normNit(a.nit),nitB=normNit(b.nit);if(nitA&&nitB&&nitA!==nitB)advertencias.push(`NIT: importador local ${nitA} ≠ IA ${nitB}; se conserva el NIT local.`);
  const rsA=normTextoObligacion(a.razonSocial),rsB=normTextoObligacion(b.razonSocial);if(rsA&&rsB&&rsA!==rsB)advertencias.push(`RAZÓN SOCIAL: importador local "${rsA}" ≠ IA "${rsB}"; se conserva la razón social local.`);
  const anA=Number(a.anio||0),anB=Number(b.anio||0);if(anA&&anB&&anA!==anB)advertencias.push(`AÑO: importador local ${anA} ≠ IA ${anB}; se conserva el año local.`);
  const qa=normCuotas(a.cuotas),qb=normCuotas(b.cuotas),byA=new Map(qa.map(c=>[c.numero,c]));
  for(const c of qb){const x=byA.get(c.numero);if(!x)continue;if(x.fecha&&c.fecha&&x.fecha!==c.fecha)advertencias.push(`CUOTA ${c.numero}: fecha local ${x.fecha} ≠ IA ${c.fecha}; se conserva la fecha local.`);if(Number.isFinite(x.impuesto)&&Number.isFinite(c.impuesto)&&x.impuesto>0&&c.impuesto>0&&Math.abs(x.impuesto-c.impuesto)>0.5)advertencias.push(`CUOTA ${c.numero}: impuesto local ${x.impuesto} ≠ IA ${c.impuesto}; se conserva el impuesto local.`);}
  const merged={...a};if(!nitA&&nitB)merged.nit=b.nit;if(!rsA&&rsB)merged.razonSocial=b.razonSocial;if(!anA&&anB)merged.anio=b.anio;const by=new Map(qa.map(c=>[c.numero,{...c}]));for(const c of qb){const x=by.get(c.numero)||{numero:c.numero,periodo:c.periodo,fecha:"",impuesto:0};if(!x.fecha&&c.fecha)x.fecha=c.fecha;if(!(Number(x.impuesto)>0)&&Number(c.impuesto)>0)x.impuesto=Number(c.impuesto);if(!x.periodo&&c.periodo)x.periodo=c.periodo;by.set(c.numero,x);}merged.cuotas=[...by.values()].sort((x,y)=>x.numero-y.numero).slice(0,6);merged.advertencias=[...(Array.isArray(a.advertencias)?a.advertencias:[])];merged.advertencias.push(...advertencias);if(b.advertencias?.length)merged.advertencias.push(...b.advertencias);merged.aiValidado=true;merged.aiConfidence=Number(b.confidence||0);return merged;
}

export async function interpretarObligacionConIA(texto,baseDeterminista=null){
  const text=String(texto??"");if(!text.trim())throw new Error("No hay información para enviar al motor IA.");
  const r=await fetch(`${getAIEndpoint()}/interpret/obligation`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text}),cache:"no-store"});
  let data=null;try{data=await r.json();}catch{}if(!r.ok)throw new Error(data?.detail||`Motor IA respondió HTTP ${r.status}.`);
  const fields=data?.fields||{},resultado=fusionarObligacionSegura(baseDeterminista||{},{...fields,confidence:data?.confidence});actualizarEstadoIA({estado:"OBLIGACION INTERPRETADA",version:data?.version||"—",confidence:Number(data?.confidence||0),pagosValidos:resultado.cuotas?.length||0,anomalies:Array.isArray(resultado.advertencias)?resultado.advertencias.length:0});return {...data,campos:fields,resultado};
}
