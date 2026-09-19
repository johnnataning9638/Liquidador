const DEFAULT_AI_URL = "http://127.0.0.1:8787";

export function getAIEndpoint(){
  try{return localStorage.getItem("dianAiEndpoint")||DEFAULT_AI_URL;}catch{return DEFAULT_AI_URL;}
}


let aiState={estado:"NO COMPROBADO",version:"—",confidence:null,pagosValidos:0,anomalies:0,timestamp:null};

export function getEstadoIA(){return {...aiState};}
function actualizarEstadoIA(p={}){aiState={...aiState,...p,timestamp:p.timestamp||new Date().toISOString()};try{window.dispatchEvent(new CustomEvent("dian-ai-status",{detail:{...aiState}}));}catch{}}

export function setAIEndpoint(url){
  const value=String(url||"").trim().replace(/\/$/,"");
  if(!value)throw new Error("La URL del motor IA no puede estar vacía.");
  try{localStorage.setItem("dianAiEndpoint",value);}catch{}
  return value;
}

export async function comprobarMotorIA(){
  try{
    const r=await fetch(`${getAIEndpoint()}/health`,{method:"GET",cache:"no-store"});
    if(!r.ok)throw new Error(`Motor IA respondió HTTP ${r.status}.`);
    const data=await r.json();
    if(!data?.ok)throw new Error("El motor IA no reportó estado OK.");
    actualizarEstadoIA({estado:"CONECTADO",version:data.version||"—",confidence:null,anomalies:0});
    return data;
  }catch(e){
    actualizarEstadoIA({estado:"NO COMPROBADO",version:"—",confidence:null,anomalies:0});
    throw e;
  }
}

function normalizarPagoIA(row){
  if(!row||typeof row!=="object")return null;
  const tipo=String(row.tipo||"").toUpperCase();
  const tdj=String(row.tdj_no||"").replace(/\D/g,"");
  const recibo=String(row.recibo_no||"").replace(/\D/g,"");
  const fechaRaw=String(row.fecha_pago||"").trim();
  const fechaMatch=fechaRaw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  const fecha=fechaMatch
    ? `${String(Number(fechaMatch[3])<100?((Number(fechaMatch[3])<=69?2000:1900)+Number(fechaMatch[3])):Number(fechaMatch[3])).padStart(4,"0")}-${String(Number(fechaMatch[2])).padStart(2,"0")}-${String(Number(fechaMatch[1])).padStart(2,"0")}`
    : fechaRaw;
  const valorRaw=row.valor_pago;
  let valor=Number(valorRaw);
  if(!Number.isFinite(valor) && typeof valorRaw==="string") {
    const s=valorRaw.trim().replace(/[$\s]/g,"");
    if(/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) valor=Number(s.replace(/[.,]/g,""));
    else if(/^\d+$/.test(s)) valor=Number(s);
  }

  // An incomplete AI record must never enter the tax engine as a payment.
  if(!fecha||!Number.isFinite(valor)||valor<=0)return null;
  if(tipo!=="TDJ"&&!tdj&&!recibo)return null;

  return {
    id:crypto.randomUUID(),
    numero:0,
    tdj:tipo==="TDJ"?tdj:(tdj||""),
    recibo:tipo==="TDJ"?"":(recibo||""),
    fecha,
    valor,
    tipo:tipo|| (tdj?"TDJ":"RECIBO"),
    tasa:String(row.tasa||""),
    observacion:String(row.observacion||"IMPORTADO IA DIAN"),
    aiConfidence:Number.isFinite(Number(row.confidence))?Number(row.confidence):null,
    aiAnomalies:Array.isArray(row.anomalies)?row.anomalies:[],
  };
}

function validarPagosIA(pagos){
  const out=[];
  const seen=new Set();
  for(const row of pagos||[]){
    const p=normalizarPagoIA(row);
    if(!p)continue;
    const key=`${p.tipo}|${p.tdj||p.recibo}|${p.fecha}|${p.valor}`;
    if(seen.has(key))continue;
    seen.add(key);
    out.push(p);
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

  // Un mismo recibo/TDJ puede aparecer en varios pagos. Por eso no usamos
  // el documento como clave única: emparejamos por orden de aparición dentro
  // de cada documento. El documento identifica el grupo; fecha/valor locales
  // son la fuente de verdad cuando ya fueron reconocidos determinísticamente.
  const gruposBase=new Map();
  const gruposIA=new Map();
  for(const p of base){const k=claveDocumentoPago(p);if(k){if(!gruposBase.has(k))gruposBase.set(k,[]);gruposBase.get(k).push(p);}}
  for(const p of ai){const k=claveDocumentoPago(p);if(k){if(!gruposIA.has(k))gruposIA.set(k,[]);gruposIA.get(k).push(p);}}

  for(const [k,arrBase] of gruposBase){
    const arrIA=gruposIA.get(k)||[];
    const n=Math.min(arrBase.length,arrIA.length);
    for(let i=0;i<n;i++){
      const a=arrBase[i],x=arrIA[i];
      const fA=String(a.fecha||"").trim(),fB=String(x.fecha||"").trim();
      const vA=Number(a.valor||0),vB=Number(x.valor||0);
      if(fA&&fB&&fA!==fB)advertencias.push(`${k} #${i+1}: fecha local ${fA} ≠ IA ${fB}; se conserva la fecha local.`);
      if(vA>0&&vB>0&&Math.abs(vA-vB)>0.5)advertencias.push(`${k} #${i+1}: valor local ${vA} ≠ IA ${vB}; se conserva el valor local.`);
    }
  }

  // Si la IA asigna un pago a un documento distinto y ese pago coincide por
  // fecha+valor con uno local, es un conflicto de identidad y se bloquea.
  const baseByDV=new Map();
  for(const p of base){baseByDV.set(`${p.fecha}|${Number(p.valor||0)}`,p);}
  for(const x of ai){
    const y=baseByDV.get(`${x.fecha}|${Number(x.valor||0)}`);if(!y)continue;
    const kd=claveDocumentoPago(y),ki=claveDocumentoPago(x);
    if(kd&&ki&&kd!==ki)conflictos.push(`PAGO ${x.fecha} $${Number(x.valor||0)}: documento local ${kd} ≠ IA ${ki}`);
  }
  if(conflictos.length)throw new Error("Validación IA de pagos: se detectaron diferencias de identidad entre la interpretación determinística y la IA. No se aplicaron los datos.\n\n"+conflictos.join("\n"));
  return advertencias;
}

export function fusionarPagosSeguros(deterministicos, ia){
  const base=Array.isArray(deterministicos)?deterministicos:[];
  const ai=Array.isArray(ia)?ia:[];
  const advertencias=compararFidelidadPagos(base,ai);
  const out=base.map(p=>({...p}));
  const gruposBase=new Map();
  const gruposIA=new Map();
  for(const p of out){const k=claveDocumentoPago(p);if(k){if(!gruposBase.has(k))gruposBase.set(k,[]);gruposBase.get(k).push(p);}}
  for(const p of ai){const k=claveDocumentoPago(p);if(k){if(!gruposIA.has(k))gruposIA.set(k,[]);gruposIA.get(k).push(p);}}

  // Documento ya reconocido localmente: preservar fecha/valor locales. La IA
  // solo puede completar campos que estén vacíos.
  for(const [k,arrBase] of gruposBase){
    const arrIA=gruposIA.get(k)||[];
    for(let i=0;i<Math.min(arrBase.length,arrIA.length);i++){
      const local=arrBase[i],p=arrIA[i];
      if(!local.fecha&&p.fecha)local.fecha=p.fecha;
      if(!(Number(local.valor)>0)&&Number(p.valor)>0)local.valor=p.valor;
      if(!local.tasa&&p.tasa)local.tasa=p.tasa;
      if(!local.observacion)local.observacion=p.observacion||"IMPORTADO IA DIAN";
    }
  }

  // Pagos adicionales que la IA encontró y que no existen localmente.
  for(const p of ai){
    const k=claveDocumentoPago(p);
    const arr= k ? gruposBase.get(k) : null;
    const yaExistePorDocumento = k && arr && arr.length>0;
    if(yaExistePorDocumento)continue;
    const misma=out.some(x=>String(x.fecha||"")===String(p.fecha||"")&&Number(x.valor||0)===Number(p.valor||0));
    if(misma)continue;
    out.push({...p});
  }
  out.sort((a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||"")));
  return {pagos:out.map((p,i)=>({...p,numero:i+1})),advertencias};
}

export async function interpretarPagosConIA(texto){
  const text=String(texto??"");
  if(!text.trim())throw new Error("No hay información para enviar al motor IA.");
  const r=await fetch(`${getAIEndpoint()}/interpret/payments`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({text}),
    cache:"no-store",
  });
  let data=null;
  try{data=await r.json();}catch{}
  if(!r.ok)throw new Error(data?.detail||`Motor IA respondió HTTP ${r.status}.`);
  const pagos=validarPagosIA(data?.records);
  actualizarEstadoIA({estado:"PAGOS INTERPRETADOS",version:data?.version||"—",confidence:Number(data?.confidence||0),pagosValidos:pagos.length,anomalies:Array.isArray(data?.aiAnomalies)?data.aiAnomalies.length:0});
  return {
    ...data,
    pagos,
    registrosReconocidos:Array.isArray(data?.records)?data.records.length:0,
    pagosValidos:pagos.length,
  };
}


function normTextoObligacion(v){return String(v??"").trim().toUpperCase().replace(/\s+/g," ");}
function normNit(v){return String(v??"").replace(/\D/g,"");}
function normCuotas(lista){
  return (Array.isArray(lista)?lista:[]).map(c=>({
    numero:Number(c?.numero||0),
    periodo:String(c?.periodo??""),
    fecha:String(c?.fecha||"").trim(),
    impuesto:Number(c?.impuesto||0),
  })).filter(c=>c.numero>=1&&c.numero<=6).sort((a,b)=>a.numero-b.numero);
}

function fusionarObligacionSegura(base, ai){
  const a=base||{}; const b=ai||{};
  const advertencias=[];
  const nitA=normNit(a.nit),nitB=normNit(b.nit);
  // El dato determinístico ya reconocido es la fuente de verdad. La IA puede
  // advertir una discrepancia, pero nunca reemplazar silenciosamente el dato
  // local ni bloquear la importación por una lectura neuronal distinta.
  if(nitA&&nitB&&nitA!==nitB)advertencias.push(`NIT: importador local ${nitA} ≠ IA ${nitB}; se conserva el NIT local.`);
  const rsA=normTextoObligacion(a.razonSocial),rsB=normTextoObligacion(b.razonSocial);
  if(rsA&&rsB&&rsA!==rsB)advertencias.push(`RAZÓN SOCIAL: importador local "${rsA}" ≠ IA "${rsB}"; se conserva la razón social local.`);
  const anA=Number(a.anio||0),anB=Number(b.anio||0);
  if(anA&&anB&&anA!==anB)advertencias.push(`AÑO: importador local ${anA} ≠ IA ${anB}; se conserva el año local.`);

  const qa=normCuotas(a.cuotas),qb=normCuotas(b.cuotas);
  const byA=new Map(qa.map(c=>[c.numero,c]));
  for(const c of qb){
    const x=byA.get(c.numero);
    if(!x)continue;
    if(x.fecha&&c.fecha&&x.fecha!==c.fecha)advertencias.push(`CUOTA ${c.numero}: fecha local ${x.fecha} ≠ IA ${c.fecha}; se conserva la fecha local.`);
    if(Number.isFinite(x.impuesto)&&Number.isFinite(c.impuesto)&&x.impuesto>0&&c.impuesto>0&&Math.abs(x.impuesto-c.impuesto)>0.5){
      advertencias.push(`CUOTA ${c.numero}: impuesto local ${x.impuesto} ≠ IA ${c.impuesto}; se conserva el impuesto local.`);
    }
  }

  const merged={...a};
  if(!nitA&&nitB)merged.nit=b.nit;
  if(!rsA&&rsB)merged.razonSocial=b.razonSocial;
  if(!anA&&anB)merged.anio=b.anio;
  const by=new Map(qa.map(c=>[c.numero,{...c}]));
  for(const c of qb){
    const x=by.get(c.numero)||{numero:c.numero,periodo:c.periodo,fecha:"",impuesto:0};
    if(!x.fecha&&c.fecha)x.fecha=c.fecha;
    if(!(Number(x.impuesto)>0)&&Number(c.impuesto)>0)x.impuesto=Number(c.impuesto);
    if(!x.periodo&&c.periodo)x.periodo=c.periodo;
    by.set(c.numero,x);
  }
  merged.cuotas=[...by.values()].sort((x,y)=>x.numero-y.numero).slice(0,6);
  merged.advertencias=[...(Array.isArray(a.advertencias)?a.advertencias:[])];
  merged.advertencias.push(...advertencias);
  if(b.advertencias?.length)merged.advertencias.push(...b.advertencias);
  merged.aiValidado=true;
  merged.aiConfidence=Number(b.confidence||0);
  return merged;
}

export async function interpretarObligacionConIA(texto, baseDeterminista=null){
  const text=String(texto??"");
  if(!text.trim())throw new Error("No hay información para enviar al motor IA.");
  const r=await fetch(`${getAIEndpoint()}/interpret/obligation`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({text}),
    cache:"no-store",
  });
  let data=null; try{data=await r.json();}catch{}
  if(!r.ok)throw new Error(data?.detail||`Motor IA respondió HTTP ${r.status}.`);
  const fields=data?.fields||{};
  const resultado=fusionarObligacionSegura(baseDeterminista||{}, {...fields, confidence:data?.confidence});
  actualizarEstadoIA({estado:"OBLIGACION INTERPRETADA",version:data?.version||"—",confidence:Number(data?.confidence||0),pagosValidos:resultado.cuotas?.length||0,anomalies:Array.isArray(resultado.advertencias)?resultado.advertencias.length:0});
  return {
    ...data,
    campos:fields,
    resultado,
  };
}
