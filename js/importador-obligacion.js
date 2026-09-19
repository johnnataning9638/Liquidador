import {fechaISO,numeroDesdeTexto} from "./utilidades.js";

const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[º°]/g,"").replace(/[._:;|]/g," ").replace(/\s+/g," ").trim();
const upper=s=>String(s??"").trim().toUpperCase();

function limpiarCelda(s){return String(s??"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();}
function esFecha(s){return !!fechaISO(limpiarCelda(s));}
function esAnio(s){return /^20\d{2}$/.test(limpiarCelda(s));}
function soloDigitos(s){return String(s??"").replace(/\D/g,"");}
function esNumeroIdentidadOTaxId(s){const d=soloDigitos(s);return /^\d{6,12}$/.test(d)&&!esAnio(d);}

function dividirLinea(linea){
  const s=String(linea??"").trim();
  if(!s)return [];
  if(/\t/.test(s))return s.split("\t").map(limpiarCelda).filter(Boolean);
  if(/\s*[;|]\s*/.test(s))return s.split(/[;|]/).map(limpiarCelda).filter(Boolean);
  return [s];
}

function extraerNIT(raw,lineas){
  const rotulo=raw.match(/(?:N\.?\s*I\.?\s*T\.?|n[uú]mero\s+de\s+identificaci[oó]n|identificaci[oó]n\s+tributaria)\s*[:#\-]?\s*(\d{6,12})(?:\s*[-/]\s*\d)?/i);
  if(rotulo)return rotulo[1];

  const candidatos=[];
  const visto=new Set();
  const agregar=(t,contexto="")=>{
    const limpio=soloDigitos(t);
    if(!/^\d{6,12}$/.test(limpio)||esAnio(limpio)||visto.has(limpio))return;
    visto.add(limpio);
    let score=0;
    // Sin rótulo, los NIT colombianos de 8-10 dígitos son un patrón útil,
    // pero no se descartan otros números de identificación válidos.
    if(/^9\d{8}$/.test(limpio))score+=55;
    else if(/^8\d{8}$/.test(limpio))score+=50;
    else if(/^\d{8,10}$/.test(limpio))score+=30;
    if(/(?:nit|identificaci[oó]n|tributaria|documento)/i.test(contexto))score+=100;
    // Un número escrito como dinero tiene menor probabilidad de ser NIT.
    if(/\$|\d[.,]\d{3}/.test(t))score-=45;
    // Prioriza números aislados frente a cadenas con varios importes.
    if(/\s/.test(t.trim()))score-=10;
    candidatos.push({t:limpio,score});
  };
  for(const linea of lineas){
    const tokens=linea.match(/\d[\d.,\-\/]*\d|\d+/g)||[];
    tokens.forEach(t=>agregar(t,linea));
  }
  // También inspeccionamos el texto completo para casos horizontales sin saltos.
  const tokens=raw.match(/\b\d{6,12}(?:[-\/]\d)?\b/g)||[];
  tokens.forEach(t=>agregar(t,raw));
  candidatos.sort((a,b)=>b.score-a.score||a.t.localeCompare(b.t));
  return candidatos[0]?.t||"";
}

function extraerRazonSocial(raw,lineas){
  const rotulo=raw.match(/(?:raz[oó]n\s+social|nombre\s+(?:o\s+)?raz[oó]n|contribuyente)\s*[:#\-]?\s*([^\n\r]+)/i);
  if(rotulo){
    const v=limpiarCelda(rotulo[1]).replace(/^[-:#\s]+/,"");
    if(v&&!/^(nit|identificaci[oó]n|cuota|fecha|valor|impuesto|a[nñ]o|periodo)\b/i.test(v))return upper(v);
  }
  const candidatos=[];
  const sufijo=/(?:SAS|S\.?A\.?S?\.?|LTDA\.?|LIMITADA|E\.?U\.?|S\.?\s*EN\s*C\.?|S\.?\s*CO\.?|COOPERATIVA|FUNDACI[ÓO]N|ASOCIACI[ÓO]N)\b/i;
  const descartar=/(?:pegar|reconocer|ubicar|informaci[oó]n de la obligaci[oó]n|puede venir|ordenada|desordenada|filas|columnas|sin t[ií]tulos|datos|fecha|vencimiento|impuesto|cuota|periodo|vigencia|nit|identificaci[oó]n|tributaria)/i;

  const limpiarDatos=entrada=>{
    let v=String(entrada);
    // Quita fechas con separadores y fechas compactas. Primero las fechas para
    // que sus componentes no queden como texto suelto.
    v=v.replace(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:\d{2}|20\d{2})\b/g," ");
    v=v.replace(/\b20\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b/g," ");
    v=v.replace(/\b\d{2}\d{2}(?:\d{2}|\d{4})\b/g," ");
    // Quita NIT/documentos, años, importes y números de cuota.
    if(raw) v=v.replace(new RegExp(`\\b${soloDigitos(extraerNIT(raw,lineas))}\\b`,"g")," ");
    v=v.replace(/\b20\d{2}\b/g," ");
    v=v.replace(/(?:\$\s*)?(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d{4,})/g," ");
    v=v.replace(/\b[1-6]\b/g," ");
    return limpiarCelda(v).replace(/^[\s,:;|\-]+|[\s,:;|\-]+$/g,"");
  };

  for(const linea of lineas){
    const v=limpiarDatos(linea);
    if(!v||v.length<3||descartar.test(v))continue;
    if(!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(v))continue;
    let score=30+Math.min(60,v.length);
    if(sufijo.test(v))score+=120;
    if(v.split(/\s+/).length>=2)score+=20;
    candidatos.push({v,score});
  }
  // En un pegado horizontal puede existir toda la información en una sola
  // línea; después de limpiar números/fechas queda la razón social aislada.
  const limpioGlobal=limpiarDatos(raw);
  if(limpioGlobal&&!descartar.test(limpioGlobal)&&/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(limpioGlobal)){
    let score=35+Math.min(60,limpioGlobal.length)+(sufijo.test(limpioGlobal)?120:0);
    candidatos.push({v:limpioGlobal,score});
  }
  candidatos.sort((a,b)=>b.score-a.score||b.v.length-a.v.length);
  return candidatos[0]?.v?upper(candidatos[0].v):"";
}

function extraerFechas(raw){
  const halladas=[];
  const push=(f,idx,rawFecha)=>{if(!f)return;const clave=`${f}|${idx}`;if(halladas.some(x=>x.clave===clave))return;halladas.push({fecha:f,index:idx,raw:rawFecha,clave});};
  const re=/\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:20\d{2}|\d{2})|20\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{2}\d{2}(?:\d{2}|\d{4})|20\d{6})\b/g;
  let m;while((m=re.exec(raw))){const f=fechaISO(m[0]);if(f)push(f,m.index,m[0]);}
  // Formato separado por espacios: 01 01 26 / 01 01 2026.
  const reEsp=/\b(\d{1,2})\s+(\d{1,2})\s+(20\d{2}|\d{2})\b/g;
  while((m=reEsp.exec(raw))){const f=fechaISO(`${m[1]}/${m[2]}/${m[3]}`);if(f)push(f,m.index,m[0]);}
  return halladas.sort((a,b)=>a.index-b.index);
}

function extraerAnio(raw,fechas){
  const candidatos=[];
  const protegido=[];
  for(const f of fechas){const start=raw.indexOf(f.raw);if(start>=0)protegido.push([start,start+f.raw.length]);}
  const re=/\b(20\d{2})\b/g;let m;
  while((m=re.exec(raw))){if(protegido.some(([a,b])=>m.index>=a&&m.index<b))continue;candidatos.push({anio:Number(m[1]),index:m.index});}
  return candidatos[0]?.anio||0;
}

function extraerNumeros(raw,nit,fechas){
  const out=[];
  const protegidoFechas=fechas.map(f=>f.raw);
  const esMontoToken=t=>{const s=String(t).replace(/^\$\s*/,'').trim();const m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);if(m){const d=Number(m[1]),mo=Number(m[2]);return !(d>=1&&d<=31&&mo>=1&&mo<=12);}return /\d/.test(s);};
  const re=/(?:\$\s*)?(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d{4,})/g;let m;
  while((m=re.exec(raw))){
    const token=m[0].replace(/^\$\s*/,"");
    if(!esMontoToken(token))continue;
    const n=numeroDesdeTexto(token);if(!Number.isFinite(n)||n<=0)continue;
    const limpio=soloDigitos(token);
    if(limpio===soloDigitos(nit))continue;
    if(esAnio(token))continue;
    if(protegidoFechas.includes(token))continue;
    // Números con formato de fecha compacta no deben ser importes.
    if(/^(?:\d{6}|\d{8})$/.test(limpio)){const f=fechaISO(limpio);if(f)continue;}
    out.push({value:n,index:m.index,raw:token,formatted:/[.,]\d{3}/.test(token),score:0});
  }
  return out;
}

function extraerNumeroCuotaEnContexto(raw,index){
  const ventana=raw.slice(Math.max(0,index-45),Math.min(raw.length,index+45));
  const m=norm(ventana).match(/(?:cuota|periodo|periodo\s+gravable|vto|vencimiento)\s*(?:n(?:umero)?|no)?\s*(?:de)?\s*([1-6])\b/);
  if(m)return Number(m[1]);
  // También reconoce el número de cuota aislado cuando viene separado por
  // espacios o saltos de línea: "2\n30/04/2025" o "2 30/04/2025".
  const alrededor=raw.slice(Math.max(0,index-18),Math.min(raw.length,index+4));
  const bare=alrededor.match(/(?:^|\s)([1-6])(?=\s|$)/);
  return bare?Number(bare[1]):null;
}

function construirCuotas(raw,lineas,nit){
  const fechas=extraerFechas(raw);
  const numeros=extraerNumeros(raw,nit,fechas);
  if(!fechas.length)return [];

  // Los importes y las fechas se emparejan como secuencias de datos, no como
  // columnas rígidas. Esto permite: horizontal, vertical, fechas primero,
  // importes primero o cada fecha junto a su importe.
  const ordenFechas=[...fechas].sort((a,b)=>a.index-b.index);
  const ordenNumeros=[...numeros].sort((a,b)=>a.index-b.index);
  const usados=new Set();
  const pares=[];

  // Si hay el mismo número de fechas e importes, la correspondencia por orden
  // de aparición es la más estable cuando la fuente no trae títulos.
  if(ordenNumeros.length===ordenFechas.length){
    for(let i=0;i<ordenFechas.length;i++)pares.push({f:ordenFechas[i],n:ordenNumeros[i],score:100});
  }else{
    // En cantidades distintas, buscamos para cada fecha el importe más cercano
    // sin reutilizarlo. Se acepta que esté antes o después.
    for(const f of ordenFechas){
      let mejor=null;
      for(let i=0;i<ordenNumeros.length;i++){
        if(usados.has(i))continue;
        const n=ordenNumeros[i],dist=Math.abs(n.index-f.index);
        let score=250-dist+(n.index<f.index?-8:0)+(n.formatted?45:0);
        if(dist>500)score-=Math.min(100,dist-500);
        if(!mejor||score>mejor.score)mejor={i,n,score};
      }
      if(mejor){usados.add(mejor.i);pares.push({f,n:mejor.n,score:mejor.score});}
      else pares.push({f,n:null,score:60});
    }
  }

  const resultados=pares.map(p=>({
    numero:extraerNumeroCuotaEnContexto(raw,p.f.index),
    fecha:p.f.fecha,
    impuesto:p.n?Number(p.n.value||0):0,
    indice:p.f.index,
    score:p.score
  }));

  // Las cuotas rotuladas se respetan. Las que no tienen número se asignan por
  // orden de aparición de las fechas.
  const salida=[];const usadosN=new Set();
  for(const x of resultados.filter(x=>x.numero>=1&&x.numero<=6)){
    if(!usadosN.has(x.numero)){salida.push(x);usadosN.add(x.numero);}
  }
  let n=1;
  for(const x of resultados.filter(x=>!x.numero)){
    while(usadosN.has(n)&&n<=6)n++;
    if(n>6)break;
    salida.push({...x,numero:n});usadosN.add(n);n++;
  }
  return salida.sort((a,b)=>a.numero-b.numero).slice(0,6).map(x=>({numero:x.numero,periodo:String(x.numero),fecha:x.fecha,impuesto:x.impuesto}));
}

export function importarDatosObligacionInteligente(texto){
  const raw=String(texto??"").replace(/\r/g,"");
  const lineas=raw.split("\n").map(limpiarCelda).filter(Boolean);
  if(!lineas.length)throw new Error("No hay información para reconocer.");
  const nit=extraerNIT(raw,lineas);
  const razonSocial=extraerRazonSocial(raw,lineas);
  const fechas=extraerFechas(raw);
  const anio=extraerAnio(raw,fechas);
  const cuotas=construirCuotas(raw,lineas,nit);
  const advertencias=[];
  if(!nit)advertencias.push("No se pudo confirmar el NIT.");
  if(!razonSocial)advertencias.push("No se pudo confirmar la razón social.");
  if(!anio)advertencias.push("No se pudo identificar el año gravable.");
  if(!cuotas.length)advertencias.push("No se encontraron cuotas con fecha e impuesto declarado.");
  if(fechas.length>6)advertencias.push("Se encontraron más de seis fechas; solo se incorporan seis cuotas.");
  if(!nit&&!razonSocial&&!anio&&!cuotas.length)throw new Error("No pude reconocer NIT, razón social, año ni cuotas. Puede pegar los datos con o sin títulos, en filas o columnas y en cualquier orden.");
  return {nit,razonSocial,anio,cuotas,advertencias};
}
