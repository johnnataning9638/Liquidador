import {fechaISO,numeroDesdeTexto} from "./utilidades.js";

const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[º°]/g,"").replace(/[._:;|]/g," ").replace(/\s+/g," ").trim();
const upper=s=>String(s??"").trim().toUpperCase();

function limpiarCelda(s){return String(s??"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();}
function esFecha(s){return !!fechaISO(limpiarCelda(s));}
function esReciboPago(s){return /^4\d{12,}$/.test(String(s??"").replace(/\D/g,""));}
function esAnio(s){return /^20\d{2}$/.test(limpiarCelda(s));}
function numeroSeguro(s){
  const t=limpiarCelda(s);
  if(!t||esFecha(t)||esAnio(t)||esReciboPago(t))return null;
  if(!/[\d]/.test(t))return null;
  const n=numeroDesdeTexto(t);
  return Number.isFinite(n)&&n>0?n:null;
}

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
  for(const linea of lineas){
    const tokens=linea.match(/\b\d{6,12}\b/g)||[];
    for(const t of tokens){
      if(esAnio(t)||esReciboPago(t))continue;
      const n=Number(t);
      if(n<1000000)continue;
      let score=0;
      if(/^9\d{7,11}$/.test(t))score+=40;
      if(/^8\d{7,11}$/.test(t))score+=20;
      if(/(?:nit|identificaci[oó]n)/i.test(linea))score+=50;
      if(/[.,]\d{3}/.test(t))score-=20;
      candidatos.push({t,score});
    }
  }
  candidatos.sort((a,b)=>b.score-a.score||a.t.localeCompare(b.t));
  return candidatos[0]?.t||"";
}

function extraerRazonSocial(raw,lineas){
  const rotulo=raw.match(/(?:raz[oó]n\s+social|nombre\s+(?:o\s+)?raz[oó]n|contribuyente)\s*[:#\-]?\s*([^\n\r]+)/i);
  if(rotulo){
    const v=limpiarCelda(rotulo[1]).replace(/^[-:#\s]+/,"");
    if(v&& !/^(nit|identificaci[oó]n|cuota|fecha|valor|impuesto)\b/i.test(v))return upper(v);
  }
  const sufijos=/(?:S\.?A\.?S?\.?|SAS|S\.?A\.?|LTDA\.?|LIMITADA|E\.?U\.?|S\.\s*EN\s*C\.?|S\.\s*CO\.?|COOPERATIVA)$/i;
  const candidatos=[];
  for(const linea of lineas){
    const celdas=dividirLinea(linea);
    for(const celda of celdas){
      const v=limpiarCelda(celda);
      if(!v||esFecha(v)||esAnio(v)||/^\d+[.,\d\s-]*$/.test(v))continue;
      if(/^(nit|raz[oó]n social|nombre|contribuyente|cuota|fecha|valor|impuesto|vencimiento)\b/i.test(v))continue;
      if(sufijos.test(v))candidatos.push(v);
    }
  }
  return candidatos.length?upper(candidatos[0]):"";
}

function contextoCuotaNumero(texto){
  const s=norm(texto);
  const m=s.match(/(?:cuota|cuot|periodo|periodo\s+gravable|vto|vencimiento)\s*(?:n(?:umero)?|no)?\s*(?:de)?\s*([1-6])\b/);
  if(m)return Number(m[1]);
  return null;
}

function extraerFechaDesdeTexto(texto){
  const s=String(texto??"");
  const candidatos=s.match(/\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]20\d{2}|20\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b/g)||[];
  for(const c of candidatos){const f=fechaISO(c);if(f)return f;}
  return "";
}

function numerosDeLinea(texto){
  const out=[];
  const s=String(texto??"");
  const tokens=s.match(/(?:\$\s*)?(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d{4,})/g)||[];
  for(const token of tokens){
    const limpio=token.replace(/^\$\s*/,"");
    if(esAnio(limpio)||esReciboPago(limpio))continue;
    const n=numeroSeguro(limpio);
    if(n!==null)out.push({raw:limpio,value:n});
  }
  return out;
}

function elegirValor(celdas,fechaIndex){
  // Primero prioriza números con formato monetario o separadores de miles.
  const candidatos=[];
  for(let i=Math.max(0,fechaIndex+1);i<celdas.length;i++){
    const s=limpiarCelda(celdas[i]);
    if(esFecha(s))continue;
    const ns=numerosDeLinea(s);
    for(const x of ns){
      let score=0;
      if(/[.,]\d{3}/.test(x.raw))score+=30;
      if(x.value>=100000)score+=20;
      if(/\$|valor|impuesto|pagar|declarado/i.test(s))score+=25;
      candidatos.push({...x,score,index:i});
    }
  }
  candidatos.sort((a,b)=>b.score-a.score||a.index-b.index);
  return candidatos[0]||null;
}

function analizarFila(celdas,indiceLinea){
  const texto=celdas.join(" ");
  const fechaIdx=celdas.findIndex(esFecha);
  const fecha=fechaIdx>=0?fechaISO(celdas[fechaIdx]):extraerFechaDesdeTexto(texto);
  if(!fecha)return null;
  const numero=contextoCuotaNumero(texto);
  let valor=elegirValor(celdas,fechaIdx>=0?fechaIdx:0);
  // Cuando una fila llega pegada como una sola cadena (por ejemplo:
  // "1 26/05/2025 3.499.000"), no existe una celda posterior a la fecha.
  // En ese caso se busca el importe dentro de toda la misma línea, excluyendo
  // años, NIT y recibos.
  if(!valor){
    const nums=numerosDeLinea(texto).filter(x=>x.value>=1000);
    if(nums.length)valor=nums.sort((a,b)=>b.value-a.value)[0];
  }
  if(!valor)return {numero,fecha,impuesto:0,indiceLinea,confianza:25};
  return {numero,fecha,impuesto:valor.value,indiceLinea,confianza:70};
}

function construirCuotas(raw,lineas){
  const filas=lineas.map(dividirLinea).filter(Boolean);
  const halladas=[];

  // 1) Primero resolvemos filas completas. Esto cubre pegados horizontales
  // como: "1 26/05/2025 3.499.000" o columnas separadas por TAB/; /|.
  for(let i=0;i<filas.length;i++){
    const r=analizarFila(filas[i],i);
    if(r)halladas.push(r);
  }

  // 2) Resolvemos bloques con número de cuota explícito. Se soportan tanto
  // bloques verticales como varias cuotas en una sola línea horizontal:
  // "Cuota 1 26/05/2025 3.499.000 Cuota 2 19/06/2025 3.045.000...".
  // Cada cuota se procesa dentro de su propio tramo de texto.
  const explicitas=[];
  const matches=[...raw.matchAll(/(?:cuota|periodo|vto)\s*(?:n(?:umero)?\s*)?([1-6])\b/gi)];
  for(let m=0;m<matches.length;m++){
    const numero=Number(matches[m][1]);
    const inicio=matches[m].index;
    const fin=(m+1<matches.length)?matches[m+1].index:raw.length;
    const segmento=raw.slice(inicio,fin);
    const fecha=extraerFechaDesdeTexto(segmento);
    if(!fecha)continue;
    const posFecha=segmento.search(/\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]20\d{2}|20\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b/);
    const despues=posFecha>=0?segmento.slice(posFecha):segmento;
    const candidatos=numerosDeLinea(despues).filter(x=>x.value>=1000);
    const valor=candidatos.length?candidatos.sort((a,b)=>b.value-a.value)[0].value:0;
    const indiceLinea=raw.slice(0,inicio).split("\n").length-1;
    explicitas.push({numero,fecha,impuesto:Number(valor||0),indiceLinea,confianza:120});
  }
  // Fallback para formatos donde el rótulo "Cuota 1" está en una línea
  // independiente y el texto fue pegado verticalmente.
  for(let i=0;i<lineas.length;i++){
    const numero=contextoCuotaNumero(lineas[i]);
    if(!numero||explicitas.some(x=>x.numero===numero&&x.indiceLinea===i))continue;
    let fecha="", valor=null, fechaLinea=-1;
    for(let j=i;j<Math.min(lineas.length,i+5);j++){
      const f=extraerFechaDesdeTexto(lineas[j]);
      if(f&&!fecha){fecha=f;fechaLinea=j;}
      if(fecha && j>=fechaLinea){
        const candidatos=numerosDeLinea(lineas[j]).filter(x=>x.value>=1000);
        if(candidatos.length){valor=candidatos.sort((a,b)=>b.value-a.value)[0].value;break;}
      }
    }
    if(fecha)explicitas.push({numero,fecha,impuesto:Number(valor||0),indiceLinea:i,confianza:110});
  }

  // Las cuotas explícitas sustituyen cualquier inferencia que haya producido
  // la misma cuota. Así una fecha/valor suelto no puede desplazar una cuota
  // correctamente rotulada.
  if(explicitas.length){
    const porNumero=new Map();
    for(const x of halladas.filter(x=>x.numero==null)){
      // Solo conservamos inferencias sin número para completar cuotas faltantes.
      porNumero.set(`F|${x.fecha}`,x);
    }
    for(const x of halladas.filter(x=>x.numero!=null)){
      if(!explicitas.some(e=>e.numero===x.numero))porNumero.set(`N|${x.numero}`,x);
    }
    halladas.length=0;
    halladas.push(...explicitas,...porNumero.values());
  }

  // 3) Para datos sin títulos y sin número de cuota, cada fecha se asocia al
  // importe más próximo que aparece después. No exige fila, columna ni orden.
  const fechas=[];
  for(let i=0;i<lineas.length;i++){
    const f=extraerFechaDesdeTexto(lineas[i]);
    if(f)fechas.push({fecha:f,linea:i});
  }
  for(const f of fechas){
    if(halladas.some(x=>x.fecha===f.fecha && x.indiceLinea===f.linea))continue;
    // Si ya existe una cuota explícita con esa fecha, no crear una segunda.
    if(halladas.some(x=>x.fecha===f.fecha && x.numero!=null))continue;
    let mejor=null;
    for(let j=f.linea;j<Math.min(lineas.length,f.linea+5);j++){
      const ns=numerosDeLinea(lineas[j]);
      for(const x of ns){
        if(x.value<1000)continue;
        const texto=lineas[j];
        if(/(?:nit|identificaci[oó]n|a[nñ]o|vigencia)/i.test(texto))continue;
        const dist=j-f.linea;
        let score=100-dist*18;
        if(/[.,]\d{3}/.test(x.raw))score+=25;
        if(/\$|valor|impuesto|pagar|declarado/i.test(texto))score+=20;
        if(!mejor||score>mejor.score)mejor={...x,score,linea:j};
      }
      if(mejor?.score>=120)break;
    }
    if(mejor)halladas.push({numero:null,fecha:f.fecha,impuesto:mejor.value,indiceLinea:f.linea,confianza:mejor.score});
  }

  // 4) Asignación final. Los números explícitos se respetan. Las cuotas sin
  // número se ordenan por aparición y completan los números que falten.
  const usados=new Set();
  const salida=[];
  for(const h of halladas){
    if(h.numero&&h.numero>=1&&h.numero<=6&&!usados.has(h.numero)){
      salida.push({...h,numero:h.numero});usados.add(h.numero);
    }
  }
  const anonimas=halladas
    .filter(h=>!h.numero&&h.fecha)
    .sort((a,b)=>a.indiceLinea-b.indiceLinea||a.fecha.localeCompare(b.fecha));
  let siguiente=1;
  for(const h of anonimas){
    while(usados.has(siguiente)&&siguiente<=6)siguiente++;
    if(siguiente>6)break;
    if(salida.some(x=>x.fecha===h.fecha))continue;
    salida.push({...h,numero:siguiente});usados.add(siguiente);siguiente++;
  }

  const mapa=new Map();
  for(const x of salida){
    const key=x.numero?`N${x.numero}`:`F${x.fecha}`;
    const prev=mapa.get(key);
    if(!prev || x.confianza>prev.confianza || (x.impuesto>prev.impuesto))mapa.set(key,x);
  }
  return [...mapa.values()]
    .sort((a,b)=>a.numero-b.numero)
    .slice(0,6)
    .map(x=>({numero:x.numero,periodo:String(x.numero),fecha:x.fecha,impuesto:Number(x.impuesto||0)}));
}

export function importarDatosObligacionInteligente(texto){
  const raw=String(texto??"").replace(/\r/g,"");
  const lineas=raw.split("\n").map(limpiarCelda).filter(Boolean);
  if(!lineas.length)throw new Error("No hay información para reconocer.");
  const nit=extraerNIT(raw,lineas);
  const razonSocial=extraerRazonSocial(raw,lineas);
  const cuotas=construirCuotas(raw,lineas);
  const advertencias=[];
  if(!nit)advertencias.push("No se pudo confirmar el NIT.");
  if(!razonSocial)advertencias.push("No se pudo confirmar la razón social.");
  if(!cuotas.length)advertencias.push("No se encontraron cuotas con fecha e impuesto declarado.");
  if(cuotas.length>6)advertencias.push("Se encontraron más de seis cuotas; solo se incorporan las seis primeras válidas.");
  if(!nit&&!razonSocial&&!cuotas.length)throw new Error("No pude reconocer NIT, razón social ni cuotas. Puede pegar los datos con o sin títulos, en filas o columnas.");
  return {nit,razonSocial,cuotas,advertencias};
}
