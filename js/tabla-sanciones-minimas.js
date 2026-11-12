// Consulta informativa de sanciones mínimas. No modifica los motores de liquidación.
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./supabase-config.js?v=16.33.161";

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const moneda=v=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(v));
const fecha=v=>{const s=String(v??"").slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4):"—";};
const enlace=v=>{try{const u=new URL(String(v||""));return u.protocol==="https:"?u.href:null;}catch{return null;}};
function filasNormalizadas(registros,remoto){
  return registros.map(x=>{
    const anio=Number(x.anio),minima=Number(x.sancion_minima??x.sancionMinima);
    if(!Number.isInteger(anio)||anio<1988||anio>2200||!Number.isSafeInteger(minima)||minima<=0)return null;
    if(remoto&&(x.estado!=="ACTIVA"||String(x.aplicable_desde||"").slice(0,10)!==`${anio}-01-01`))return null;
    return {anio,minima,desde:`${anio}-01-01`,hasta:`${anio}-12-31`,
      norma:remoto?String(x.norma||"Art. 639 del Estatuto Tributario"):"Art. 639 del Estatuto Tributario",
      url:remoto?enlace(x.resolucion_url)||enlace(x.fuente_url):null,
      origen:remoto?String(x.fuente_actualizacion||x.origen_actualizacion||"Supabase"):"Respaldo local"};
  }).filter(Boolean).sort((a,b)=>b.anio-a.anio);
}
function pintar(filas,estado){
  for(const id of ["tablaSancionesMinimas","tablaSancionesMinimasTDJ"]){
    const tbody=$(id)?.querySelector("tbody");if(!tbody)continue;
    tbody.innerHTML="";
    for(const x of filas){
      const tr=document.createElement("tr");
      const fuente=x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.norma)}</a>`:esc(x.norma);
      tr.innerHTML=`<td>${x.anio}</td><td>${fecha(x.desde)}</td><td>${fecha(x.hasta)}</td><td>${moneda(x.minima)}</td><td>${fuente}</td><td>${esc(x.origen)}</td>`;
      tbody.appendChild(tr);
    }
    if(!filas.length)tbody.innerHTML='<tr><td colspan="6">No hay registros disponibles.</td></tr>';
  }
  for(const id of ["estadoSancionesMinimas","estadoSancionesMinimasTDJ"]){const el=$(id);if(el)el.textContent=estado;}
}
async function cargar(){
  let local=[];
  try{
    const r=await fetch("datos/uvt.json",{cache:"no-store"});
    if(!r.ok)throw Error("Histórico local no disponible");
    local=filasNormalizadas(await r.json(),false);
  }catch(e){console.warn("Respaldo de sanciones mínimas no disponible",e);}
  pintar(local,`Respaldo local · ${local.length} años`);
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY||SUPABASE_URL.includes("PEGAR_AQUI"))return;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const url=SUPABASE_URL+"/rest/v1/uvt_liquidador?select=*&estado=eq.ACTIVA&order=anio.asc";
    const r=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:"Bearer "+SUPABASE_ANON_KEY},signal:controller.signal,cache:"no-store"});
    if(!r.ok)throw Error("Supabase HTTP "+r.status);
    const data=await r.json();if(!Array.isArray(data)||!data.length)throw Error("Sin registros centrales");
    const filas=filasNormalizadas(data,true);
    if(!filas.length)throw Error("Sin registros centrales válidos");
    pintar(filas,`Supabase conectado · ${filas.length} años · Consulta informativa`);
  }catch(e){
    console.warn("Consulta informativa de sanciones mínimas: usando respaldo local",e);
    pintar(local,`Supabase no disponible · Respaldo local (${local.length} años)`);
  }finally{clearTimeout(timeout);}
}
cargar();
