import {dinero, numeroDesdeTexto, truncarValorEntero, fechaISO, fechaVisible} from "./utilidades.js?v=16.33.05";
import {MotorLiquidacion} from "./motor-liquidacion.js?v=16.33.05";
import {importarDatosInteligente} from "./importador.js?v=16.33.05";
import {importarDatosObligacionInteligente} from "./importador-obligacion.js?v=16.33.05";
import {interpretarObligacionConIA, interpretarPagosConIA, fusionarPagosSeguros, comprobarMotorIA} from "./ai-bridge.js?v=16.33.05";
import {MotorLiquidacionOficial} from "./motor-liquidacion-oficial.js?v=16.33.05";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./supabase-config.js?v=16.32.30";
import {leerXlsxPrimeraHoja,numExcel,fechaExcel,norm as normExcel} from "./importador-excel.js?v=16.33.07";

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const upper=v=>String(v??"").trim().toUpperCase();
const upperPreserveSpaces=v=>String(v??"").toUpperCase();
const hoyISO=()=>new Date().toISOString().slice(0,10);

// CÁLCULO DEL DÍGITO DE VERIFICACIÓN DEL NIT.
// Se define localmente porque tdj.js es un módulo ES y no comparte
// automáticamente las funciones de app.js.
function calcularDvNITTDJ(nit){
  const n=String(nit||"").replace(/\D/g,"");
  if(!n)return "";
  const pad=n.padStart(15,"0");
  const pesos=[71,67,59,53,47,43,41,37,29,23,19,17,13,7,3];
  const suma=[...pad].reduce((a,d,i)=>a+Number(d)*pesos[i],0);
  const r=suma%11;
  return r===0||r===1?String(11-r===10?0:11-r):String(11-r);
}

const TIPOS=[
  "TASA DIAN","ART. 45 LEY 2155","ART. 91 LEY 2277","ART. 93 LEY 2277 - OMISAS",
  "ART. 48 LEY 2155","ART. 1 DECRETO 688 DE 2020 - IBC","ART. 120 LEY 2010 2018 PARAG 3- IBC+2",
  "ART. 20 DECRETO 1474 DE 2025","ART. 21 DECRETO 1474 DE 2025, OMISO- CORRECION",
  "ART. 3 DECRETO 0240 DE 2026","ART. 4 DECRETO 0240 DE 2026, OMISO- CORRECION"
];

// MISMA LISTA DESPLEGABLE DE CONCEPTOS UTILIZADA EN EL LIQUIDADOR PRINCIPAL.
// SE REUTILIZA EN CADA OBLIGACIÓN DEL MÓDULO TDJ.
const CONCEPTOS=[
  "RENTA","RENTA CREE","VENTAS","CONSUMO","RETENCIÓN","RETENCIÓN CREE",
  "PATRIMONIO","RIQUEZA","GMF","SANCION","PRODUCTOS ULTRAPROCESADOS",
  "PRODUCTOS PLASTICOS","SIMPLE","OTROS"
];

let uvt=[],ipc=[],tasas=[];
let motor=null;
let motorOficial=null;
let obligaciones=[];
let titulos=[];
let resultado=null;
let resultadoDesactualizado=false;
function invalidarResultadoTDJ(){
  // Las ediciones dejan el resultado marcado como desactualizado, pero NO
  // lo ocultan ni lo borran. El usuario puede seguir viendo la liquidación
  // anterior hasta pulsar CALCULAR LIQUIDACIÓN, momento en que se reconstruye
  // y se actualiza en el mismo panel.
  resultadoDesactualizado=true;
}

let supabaseClient=null;

function uid(pref){return `${pref}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
function opcionTipo(tipo="TASA DIAN"){
  return TIPOS.map(x=>`<option value="${esc(x)}" ${upper(tipo)===upper(x)?"selected":""}>${esc(x)}</option>`).join("");
}
function opcionConcepto(concepto=""){
  const actual=upper(concepto);
  const normalizado=CONCEPTOS.find(x=>upper(x)===actual) || (actual?"OTROS":"");
  return `<option value="">SELECCIONE...</option>`+CONCEPTOS.map(x=>`<option value="${esc(x)}" ${upper(normalizado)===upper(x)?"selected":""}>${esc(x)}</option>`).join("");
}
function campoFecha(id,value=""){
  const iso=fechaISO(value);
  return `<div class="fecha-dual"><input id="${esc(id)}" class="fecha-campo" type="text" inputmode="numeric" maxlength="10" placeholder="dd/mm/aa o dd/mm/aaaa" value="${esc(fechaVisible(iso))}"><input id="${esc(id)}Picker" class="fecha-native" type="date" tabindex="-1" aria-label="Abrir calendario" title="Abrir calendario" value="${esc(iso)}"></div>`;
}
function montarFechaDual(root,onChange=()=>{}){
  if(!root)return;
  const text=root.querySelector('.fecha-campo'),picker=root.querySelector('.fecha-native');
  if(!text||!picker)return;
  const aplicar=iso=>{const valido=fechaISO(iso);if(valido){text.value=fechaVisible(valido);picker.value=valido;onChange(valido);}else if(!String(iso||'').trim()){text.value='';picker.value='';onChange('');}};
  picker.addEventListener('change',()=>aplicar(picker.value));
  text.addEventListener('input',()=>{const raw=String(text.value||'').trim();if(raw.length===10){const iso=fechaISO(raw);if(iso){picker.value=iso;onChange(iso);}}});
  const confirmar=()=>{const iso=fechaISO(text.value);if(!iso&&text.value.trim()){alert('Fecha no válida. Usa DD/MM/AA o DD/MM/AAAA.');text.value='';picker.value='';onChange('');return;}aplicar(iso||'');};
  text.addEventListener('blur',confirmar);
  text.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();confirmar();}});
  picker.addEventListener('click',()=>{try{if(typeof picker.showPicker==='function')picker.showPicker();}catch{}});
}
function nuevoVto(numero=1){return {id:uid("VTO"),numero,periodo:numero,fecha:"",impuesto:0};}
function nuevaObligacion(numero){
  return {
    id:uid("OBL"),numero,concepto:"",anio:"",periodo:"",tipoLiquidacion:"PRIVADA",fechaAutoAdmisorio:"",fechaProvidenciaDefinitiva:"",tieneSancion:"NO",valorSancion:0,fechaSancion:"",beneficioSancion:"",beneficioTributario:"NINGUNO",
    vencimientos:[nuevoVto(1)],pagos:[],importacion:""
  };
}
function nuevoTitulo(numero){return {id:uid("TDJ"),numero,tdj:"",fecha:"",valor:0,tipo:"TASA DIAN",observacion:""};}

function normalizarDatosLocal(){
  return Promise.all([
    fetch("datos/uvt.json").then(r=>r.json()),fetch("datos/ipc.json").then(r=>r.json()),fetch("datos/tasas-moratorias.json").then(r=>r.json()),
    fetch("datos/beneficios.json").then(r=>r.json()),fetch("datos/sanciones.json").then(r=>r.json()),fetch("datos/reglas-obligaciones.json").then(r=>r.json())
  ]).then(([a,b,c,d,e,f])=>{uvt=a||[];ipc=b||[];tasas=c||[];window.__tdjBeneficios=d||[];window.__tdjSanciones=e||[];window.__tdjReglas=f||[];reconstruirMotor();});
}
function reconstruirMotor(){
  const cfg={uvt,intereses:tasas,ipc,tasasMoratorias:tasas,beneficios:window.__tdjBeneficios||[],sanciones:window.__tdjSanciones||[],reglasObligaciones:window.__tdjReglas||[]};
  motor=new MotorLiquidacion(cfg);
  motorOficial=new MotorLiquidacionOficial(cfg);
}
function conTiempoLimite(promise,ms=6000){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("TIMEOUT")),ms))]);}
async function cargarSupabase(){
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY||SUPABASE_URL.includes("PEGAR_AQUI"))return;
  try{
    const mod=await conTiempoLimite(import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"),6000);
    supabaseClient=mod.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    const [tr,ir]=await Promise.all([
      conTiempoLimite(supabaseClient.from("tasas_liquidador").select("fecha_inicio,fecha_fin,tasa,tipo_tasa,fuente_url,norma,estado").eq("tipo_tasa","TASA DIAN").order("fecha_inicio",{ascending:true}),6000).catch(()=>({data:null})),
      conTiempoLimite(supabaseClient.from("ipc_liquidador").select("anio_inflacion,inflacion,aplicable_desde,fuente_url,norma,estado").order("anio_inflacion",{ascending:true}),6000).catch(()=>({data:null}))
    ]);
    if(Array.isArray(tr?.data)&&tr.data.length){
      const mapa=new Map(tasas.map(x=>[`${x.desde}|${x.hasta}`,x]));
      for(const x of tr.data){
        const d=String(x.fecha_inicio||"").slice(0,10),h=String(x.fecha_fin||"").slice(0,10); if(!d||!h)continue;
        const base=mapa.get(`${d}|${h}`)||{desde:d,hasta:h,tasas:{},metodologia:"INTERES_SIMPLE_DIARIO"};
        const tasaCentral=Number(x.tasa);
        base.tasas={...(base.tasas||{}),"TASA DIAN":Number.isFinite(tasaCentral)?(tasaCentral>1?tasaCentral/100:tasaCentral):null};base.fuente=x.fuente_url||"SUPABASE";base.norma=x.norma||"";mapa.set(`${d}|${h}`,base);
      }
      tasas=[...mapa.values()].sort((a,b)=>String(a.desde).localeCompare(String(b.desde))); 
    }
    if(Array.isArray(ir?.data)&&ir.data.length){
      const mapa=new Map(ipc.map(x=>[Number(x.anioInflacion??x.anio_inflacion),x]));
      for(const x of ir.data){const y=Number(x.anio_inflacion);if(y)mapa.set(y,{anioInflacion:y,inflacion:Number(x.inflacion),aplicableDesde:String(x.aplicable_desde||`${y+1}-01-01`).slice(0,10),fuente:x.fuente_url||"SUPABASE"});}
      ipc=[...mapa.values()].sort((a,b)=>a.anioInflacion-b.anioInflacion);
    }
    reconstruirMotor();
    renderPagos();
    renderObligaciones();
    renderTitulos();
    refrescarTasasPagos();
    renderPanelesTasasIPC();
    setStatus("MOTOR DE LIQUIDACIÓN DISPONIBLE","ok");
  }catch(e){setStatus("PARÁMETROS LOCALES — SUPABASE NO DISPONIBLE","warn");}
}
function setStatus(text,mode="ok"){
  const el=$("estadoMotorTDJ");if(!el)return;
  const listo=mode==="ok";
  el.className=`indicador-parametros ${listo?"listo":mode==="loading"?"cargando":"error"}`;
  el.title=text;el.setAttribute("aria-label",text);
}

function ordenarPagosCronologicamente(o){
  o.pagos.sort((a,b)=>String(a.fecha||"9999-12-31").localeCompare(String(b.fecha||"9999-12-31")) || Number(a._orden||0)-Number(b._orden||0));
  o.pagos.forEach((p,i)=>{
    p.numero=i+1;
    if(!p.tipo)p.tipo="TASA DIAN";
  });
}

function normalizarTasaTDJ(valor){
  const n=Number(valor);
  if(!Number.isFinite(n))return null;
  // Las tasas centrales se almacenan normalmente como decimal (0.2724),
  // pero si una fuente externa entrega 27.24, normalizamos a decimal.
  return n>1 ? n/100 : n;
}
function tasaParaPagoTDJ(p){
  if(!p)return null;
  try{
    const tipo=upper(p.tipo||"TASA DIAN");
    const esFijaSinFecha=
      (tipo.includes("DECRETO 1474") && (tipo.includes("ART. 20") || tipo.includes("ART. 21"))) ||
      (tipo.includes("DECRETO 0240") && (tipo.includes("ART. 3") || tipo.includes("ART. 4")));
    const fecha=fechaISO(p.fecha);
    // Los tratamientos con tasa fija (Art. 20, Art. 21, Art. 3 y Art. 4)
    // pueden mostrar su tasa aun antes de diligenciar la fecha. Para TASA DIAN
    // y tratamientos derivados sí se requiere una fecha para identificar el tramo.
    if(!fecha && !esFijaSinFecha)return null;
    let tasa=null;
    if(motor){
      const especial=motor.tasaEspecial(tipo,fecha||"");
      tasa=especial?.tasa;
      if(tasa==null && fecha)tasa=motor.tasaPorFecha(fecha,tipo);
      if(tasa==null && fecha && tipo!=="TASA DIAN") tasa=motor.tasaPorFecha(fecha,"TASA DIAN");
    }
    return normalizarTasaTDJ(tasa);
  }catch{return null;}
}
function refrescarTasasPagos(){
  document.querySelectorAll('.pago-obligacion-card').forEach(sec=>{
    const o=obligaciones.find(x=>x.id===sec.dataset.id);if(!o)return;
    sec.querySelectorAll('tbody tr').forEach((tr,i)=>{const p=o.pagos[i];if(!p)return;const celda=tr.querySelector('.tasa-pago');const tasa=tasaParaPagoTDJ(p);if(celda)celda.textContent=tasa==null?"SIN DATOS":(tasa*100).toFixed(3)+"%";});
  });
}

function opcionesTipoTDJ(actual="TASA DIAN"){
  return TIPOS.map(x=>`<option value="${esc(x)}" ${upper(actual||"TASA DIAN")==upper(x)?"selected":""}>${esc(x)}</option>`).join("");
}
function ordenarTitulosCronologicamente(){
  titulos.sort((a,b)=>String(a.fecha||"9999-12-31").localeCompare(String(b.fecha||"9999-12-31")) || Number(a._orden||0)-Number(b._orden||0));
  titulos.forEach((t,i)=>{t.numero=i+1;});
}

function valorSancionConBeneficioTDJ(o){
  const base=Math.max(0,Number(o?.valorSancion||0));
  if(upper(o?.beneficioSancion)!=="CON BENEFICIO"||!base)return 0;
  const pagos=[...(o?.pagos||[])].filter(p=>p?.tipo).sort((a,b)=>String(a.fecha||"9999-12-31").localeCompare(String(b.fecha||"9999-12-31")));
  // Si todavía no existe un pago con tratamiento especial, mostrar de inmediato
  // el valor base. Así el campo "VALOR SANCIÓN CON BENEFICIO" nunca queda vacío
  // al seleccionar CON BENEFICIO. Cuando exista el pago aplicable, se calcula la
  // reducción y se respeta la sanción mínima correspondiente.
  for(const p of pagos){
    try{
      const esp=motor?.tasaEspecial(p.tipo,p.fecha||hoyISO());
      if(esp?.reduceSancion){
        const minima=Math.max(0,Number(motor?.sancionMinima(Number((o.fechaSancion||o.vencimientos?.[0]?.fecha||"").slice(0,4))||o.anio)||0));
        return Math.min(base,Math.max(Math.round(base*Number(esp.factorSancion||1)/1000)*1000,minima));
      }
    }catch{}
  }
  return base;
}
function actualizarValorBeneficioUI(sec,o){
  const el=sec?.querySelector('[data-k="valorSancionBeneficio"]');
  if(!el)return;
  const v=valorSancionConBeneficioTDJ(o);
  el.value=v?dinero(v):"";
  el.disabled=upper(o?.beneficioSancion)!=="CON BENEFICIO";
}

function actualizarSelectoresImportacion(){
  const selects=[$("destinoImportacionObligacion"),$("destinoImportacionPagos")].filter(Boolean);
  selects.forEach(sel=>{
    const actual=sel.value;
    sel.innerHTML='<option value="">SELECCIONE LA OBLIGACIÓN DESTINO...</option>'+obligaciones.map((o,i)=>`<option value="${esc(o.id)}">OBLIGACIÓN ${i+1}${o.concepto?` — ${esc(o.concepto)}`:""}</option>`).join("");
    if(obligaciones.some(o=>o.id===actual))sel.value=actual;
  });
}

function renderObligaciones(){
  const root=$("listaObligaciones");if(!root)return;root.innerHTML="";
  obligaciones.forEach((o,idx)=>{
    const sec=document.createElement("section");sec.className="card obligacion-card";sec.dataset.id=o.id;
    sec.innerHTML=`
      <div class="card-head"><div><span class="kicker">OBLIGACIÓN ${idx+1}</span><h3>OBLIGACIÓN ${idx+1}</h3></div><div class="card-actions"><button class="peligro" data-action="eliminar">ELIMINAR</button></div></div>
      <div class="compact-grid obligation-fields">
        <label>CONCEPTO / IMPUESTO<select data-k="concepto">${opcionConcepto(o.concepto||"")}</select></label>
        <label>AÑO GRAVABLE<input data-k="anio" type="number" min="1900" max="2100" value="${esc(o.anio||"")}"></label>
        <label>PERÍODO<select data-k="periodo"><option value="">SELECCIONE...</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${String(o.periodo||"")===String(i+1)?"selected":""}>${i+1}</option>`).join("")}</select></label>
        <label>SANCIÓN<select data-k="tieneSancion"><option value="NO">NO</option><option value="SI">SÍ</option></select></label>
        <label>VALOR SANCIÓN<input data-k="valorSancion" class="money" inputmode="numeric" value="${o.valorSancion?dinero(o.valorSancion):""}" placeholder="$ 0"></label>
        <label>FECHA SANCIÓN ${campoFecha(`fs-${o.id}`,o.fechaSancion)}</label>
        <label>BENEFICIO SANCIÓN<select data-k="beneficioSancion"><option value="">SELECCIONE...</option><option>CON BENEFICIO</option><option>SIN BENEFICIO</option></select></label><label>VALOR SANCIÓN CON BENEFICIO<input data-k="valorSancionBeneficio" class="money" readonly value="" placeholder="$ 0"></label>
      </div>
      <div class="subpanel"><div class="subhead"><strong>CUOTAS / VENCIMIENTOS</strong><button class="primario small" data-action="agregar-cuota">+ AGREGAR CUOTA</button></div>
        <div class="tabla-scroll"><table class="mini-table cuotas-mini"><thead><tr><th>Nº</th><th>PERÍODO / CUOTA</th><th>FECHA VENCIMIENTO</th><th>IMPORTE / IMPUESTO</th><th></th></tr></thead><tbody></tbody></table></div>
      </div>`;
    root.appendChild(sec);
    sec.querySelector('[data-k="concepto"]').value=o.concepto||"";
    sec.querySelector('[data-k="tieneSancion"]').value=o.tieneSancion||"NO";
    sec.querySelector('[data-k="beneficioSancion"]').value=o.beneficioSancion||"";
    sec.querySelectorAll('[data-k]').forEach(el=>el.addEventListener("change",()=>{syncObligacion(sec,o);actualizarValorBeneficioUI(sec,o);}));
    const campoValorSancion=sec.querySelector('[data-k="valorSancion"]');
    campoValorSancion.addEventListener("input",e=>{o.valorSancion=numeroDesdeTexto(e.target.value);actualizarValorBeneficioUI(sec,o);});
    campoValorSancion.addEventListener("blur",e=>{o.valorSancion=numeroDesdeTexto(e.target.value);e.target.value=o.valorSancion?dinero(o.valorSancion):"";actualizarValorBeneficioUI(sec,o);});
    const fs=sec.querySelector(`#fs-${o.id}`); if(fs) montarFechaDual(fs.parentElement,v=>o.fechaSancion=v);
    sec.querySelector('[data-action="eliminar"]').addEventListener("click",()=>{if(obligaciones.length===1)return alert("Debe existir al menos una obligación.");obligaciones=obligaciones.filter(x=>x.id!==o.id);renderObligaciones();renderPagos();});
    sec.querySelector('[data-action="agregar-cuota"]').addEventListener("click",()=>{o.vencimientos.push(nuevoVto(o.vencimientos.length+1));renderObligaciones();});
    renderCuotasEn(sec,o);actualizarCamposSancion(sec,o);actualizarValorBeneficioUI(sec,o);
  });
  actualizarSelectoresImportacion();
}
function renderPagos(){
  const root=$("listaPagos");if(!root)return;root.innerHTML="";
  obligaciones.forEach((o,idx)=>{
    ordenarPagosCronologicamente(o);
    const sec=document.createElement("section");sec.className="card pago-obligacion-card";sec.dataset.id=o.id;
    sec.innerHTML=`<div class="card-head"><div><span class="kicker">PAGOS</span><h3>PAGO OBLIGACIÓN ${idx+1}</h3></div><div class="card-actions"><button class="primario small" data-action="agregar-pago">+ AGREGAR PAGO</button></div></div>
      <div class="tabla-scroll"><table class="mini-table pagos-mini"><thead><tr><th>Nº</th><th>RECIBO NÚMERO</th><th>FECHA PAGO</th><th>VALOR PAGO</th><th>TIPO</th><th>TASA</th><th>OBSERVACIÓN</th><th>ACCIÓN</th></tr></thead><tbody></tbody></table></div>`;
    root.appendChild(sec);
    sec.querySelector('[data-action="agregar-pago"]').addEventListener("click",()=>{const pos=o.pagos.length+1;o.pagos.push({id:uid("PAG"),numero:pos,recibo:"",fecha:"",valor:0,tipo:"TASA DIAN",observacion:"",_orden:Date.now()+o.pagos.length});invalidarResultadoTDJ();renderPagos();renderObligaciones();});
    renderPagosEn(sec,o);
  });
  actualizarSelectoresImportacion();
}
function syncObligacion(sec,o){sec.querySelectorAll('[data-k]').forEach(el=>{const k=el.dataset.k;if(k==="valorSancion")o[k]=numeroDesdeTexto(el.value);else o[k]=k==="anio"?Number(el.value||0):upper(el.value);});actualizarCamposSancion(sec,o);}
function actualizarCamposSancion(sec,o){const si=sec.querySelector('[data-k="tieneSancion"]')?.value==="SI";["valorSancion","fechaSancion","beneficioSancion"].forEach(k=>{const el=sec.querySelector(`[data-k="${k}"]`)||sec.querySelector(`#fs-${o.id}`);if(el)el.disabled=!si;});}
function renderCuotasEn(sec,o){
  const tbody=sec.querySelector('.cuotas-mini tbody');tbody.innerHTML="";
  o.vencimientos.sort((a,b)=>Number(a.numero)-Number(b.numero)).forEach((v,i)=>{
    const tr=document.createElement('tr');tr.innerHTML=`<td>${i+1}</td><td><input data-v="periodo" value="${esc(v.periodo??i+1)}"></td><td>${campoFecha(`vto-${v.id}`,v.fecha)}</td><td><input data-v="impuesto" class="money" inputmode="numeric" value="${v.impuesto?dinero(v.impuesto):""}" placeholder="$ 0"></td><td><button class="secundario" data-vdel tabindex="-1">Eliminar</button></td>`;
    tr.querySelector('[data-v="periodo"]').addEventListener('change',e=>v.periodo=upper(e.target.value));
    tr.querySelector('[data-v="impuesto"]').addEventListener('blur',e=>{v.impuesto=numeroDesdeTexto(e.target.value);e.target.value=v.impuesto?dinero(v.impuesto):"";});
    montarFechaDual(tr.querySelector(`#vto-${v.id}`).parentElement,iso=>v.fecha=iso);
    tr.querySelector('[data-vdel]').addEventListener('click',()=>{if(o.vencimientos.length===1){v.fecha="";v.impuesto=0;}else{o.vencimientos=o.vencimientos.filter(x=>x.id!==v.id);o.vencimientos.forEach((x,j)=>{x.numero=j+1;if(!x.periodo)x.periodo=j+1;});}renderObligaciones();});
    tbody.appendChild(tr);
  });
}
function enfocarSiguienteFila(tbody, fila, selectores, idx){
  const filas=[...tbody.querySelectorAll('tr')];
  const actual=filas.indexOf(fila);
  if(actual<0)return;
  const siguiente=filas[actual+1]?.querySelector(selectores[idx]);
  if(siguiente){siguiente.focus();if(siguiente.select)siguiente.select();}
}
function configurarTabPago(tr,tbody){
  const campos=[tr.querySelector('[data-p="recibo"]'),tr.querySelector('.fecha-campo'),tr.querySelector('[data-p="valor"]')].filter(Boolean);
  campos.forEach((el,i)=>el.addEventListener('keydown',e=>{
    if(e.key!=='Tab'||e.shiftKey)return;
    // Al salir del campo VALOR PAGO, convertir inmediatamente a formato COP.
    if(el.dataset?.p==='valor'){
      const n=numeroDesdeTexto(el.value);
      el.value=n?dinero(n):'';
      const sec=tr.closest('.pago-obligacion-card');
      const o=sec?obligaciones.find(x=>x.id===sec.dataset.id):null;
      if(o){const fila=[...tr.parentElement.querySelectorAll('tr')].indexOf(tr);if(fila>=0&&o.pagos[fila])o.pagos[fila].valor=n;}
    }
    if(i<campos.length-1){e.preventDefault();campos[i+1].focus();if(campos[i+1].select)campos[i+1].select();return;}
    e.preventDefault();
    const filas=[...tbody.querySelectorAll('tr')],actual=filas.indexOf(tr),siguiente=filas[actual+1]?.querySelector('[data-p="recibo"]');
    if(siguiente){siguiente.focus();if(siguiente.select)siguiente.select();}
  }));
}
function enfocarCampoErrorTDJ(selector){
  if(!selector)return;
  const el=typeof selector==='string'?document.querySelector(selector):selector;
  if(!el)return;
  setTimeout(()=>{try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});}catch(_){} try{el.focus({preventScroll:true});}catch(_){try{el.focus();}catch(__){}} if(typeof el.select==='function'&&el.tagName!=='SELECT')el.select();},50);
}
function enfocarCampoTDJ(el){
  if(!el)return;
  el.focus();
  if(typeof el.select==='function')el.select();
}
function configurarTabTitulo(tr,tbody){
  // FLUJO DE CAPTURA: TDJ -> FECHA -> VALOR -> OBSERVACIÓN -> SIGUIENTE TDJ.
  // TIPO Y TASA NO HACEN PARTE DEL TABULADO DE CAPTURA.
  // No se crean filas automáticamente al llegar al último TDJ: si no existe
  // una fila siguiente, se conserva el comportamiento nativo del navegador
  // para que el foco continúe hacia los controles existentes de la pantalla.
  const campos=[
    tr.querySelector('[data-t="tdj"]'),
    tr.querySelector('.fecha-campo'),
    tr.querySelector('[data-t="valor"]'),
    tr.querySelector('[data-t="observacion"]')
  ].filter(Boolean);
  campos.forEach((el,i)=>el.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const paso=e.shiftKey?-1:1;

    // TAB / SHIFT+TAB entre los campos de captura de la misma fila.
    if(i+paso>=0 && i+paso<campos.length){
      e.preventDefault();
      enfocarCampoTDJ(campos[i+paso]);
      return;
    }

    // SHIFT+TAB desde el primer campo: permitir que el navegador continúe
    // hacia el control enfocable anterior de la pantalla.
    if(paso<0)return;

    // Al salir de OBSERVACIÓN se conserva el valor entero del TDJ.
    const t=titulos.find(x=>x.id===tr.dataset.tituloId);
    if(t){
      const valor=tr.querySelector('[data-t="valor"]');
      const n=truncarValorEntero(numeroDesdeTexto(valor?.value||t.valor));
      t.valor=n;
      if(valor)valor.value=n?dinero(n):'';
    }

    // Si existe una fila siguiente, el TAB continúa en su TDJ.
    // Si esta es la última fila, NO se agrega ninguna nueva: dejamos que el
    // navegador lleve el foco al siguiente control existente (p. ej. botón).
    const filas=[...tbody.querySelectorAll('tr')];
    const actual=filas.indexOf(tr);
    const siguiente=filas[actual+1]?.querySelector('[data-t="tdj"]');
    if(siguiente){
      e.preventDefault();
      enfocarCampoTDJ(siguiente);
    }
  }));
}
function renderPagosEn(sec,o){
  ordenarPagosCronologicamente(o);
  const tbody=sec.querySelector('.pagos-mini tbody');tbody.innerHTML='';
  o.pagos.forEach((p,i)=>{
    const tr=document.createElement('tr');
    const tasa=tasaParaPagoTDJ(p);
    tr.innerHTML=`<td class="numero-fila">${i+1}</td><td><input data-p="recibo" value="${esc(p.recibo||"")}" inputmode="numeric" placeholder="Nº RECIBO"></td><td>${campoFecha(`pago-${p.id}`,p.fecha)}</td><td><input data-p="valor" class="money" inputmode="numeric" value="${p.valor?dinero(p.valor):""}" placeholder="$ 0"></td><td><select data-p="tipo" tabindex="-1">${opcionesTipoTDJ(p.tipo||"TASA DIAN")}</select></td><td class="tasa-pago">${tasa==null?"SIN DATOS":(tasa*100).toFixed(3)+"%"}</td><td><input data-p="observacion" value="${esc(upper(p.observacion||""))}" placeholder="OBSERVACIÓN" tabindex="-1"></td><td><button class="peligro" data-pdel tabindex="-1">Eliminar</button></td>`;
    tr.querySelectorAll('[data-p]').forEach(el=>el.addEventListener('change',()=>{
      const k=el.dataset.p;
      invalidarResultadoTDJ();
      if(k==='valor')p[k]=truncarValorEntero(numeroDesdeTexto(el.value));
      else p[k]=k==='tipo'?upper(el.value):String(el.value||'');
      if(k==='tipo'){ordenarPagosCronologicamente(o);renderPagos();renderObligaciones();}
      else if(k==='recibo'||k==='observacion')p[k]=k==='observacion'?upper(el.value):String(el.value||'');
      if(k==='observacion')el.value=p[k];
    }));
    montarFechaDual(tr.querySelector(`#pago-${p.id}`).parentElement,v=>{invalidarResultadoTDJ();p.fecha=v;ordenarPagosCronologicamente(o);const tasaActual=tasaParaPagoTDJ(p);const celda=tr.querySelector('.tasa-pago');if(celda)celda.textContent=tasaActual==null?"SIN DATOS":(tasaActual*100).toFixed(3)+"%";});
    tr.querySelector('[data-pdel]').addEventListener('click',()=>{invalidarResultadoTDJ();o.pagos=o.pagos.filter(x=>x.id!==p.id);ordenarPagosCronologicamente(o);renderPagos();});
    tbody.appendChild(tr);
    configurarTabPago(tr,tbody);
  });
}

function obtenerObligacionDestino(selectId,mensaje){
  const id=$(selectId)?.value||"";
  if(!id)throw new Error(mensaje||"Seleccione la obligación destino antes de importar.");
  const o=obligaciones.find(x=>x.id===id);
  if(!o)throw new Error("La obligación seleccionada ya no existe.");
  return o;
}

async function importarObligacionGlobal(usarIA){
  const text=$("importarObligacionTexto")?.value.trim();if(!text)return alert("Pegue primero la información de la obligación.");
  try{
    const o=obtenerObligacionDestino("destinoImportacionObligacion","Seleccione la obligación a la que desea aplicar la importación.");
    let obj=importarDatosObligacionInteligente(text);
    if(usarIA){setStatus("IA DIAN — VALIDANDO DATOS Y VENCIMIENTOS...","loading");const ai=await interpretarObligacionConIA(text,obj);obj=ai.resultado||obj;setStatus(`IA DIAN — VALIDACIÓN ${Math.round(Number(ai.confidence||0)*100)}%`,"ok");}
    if(obj.concepto)o.concepto=CONCEPTOS.find(x=>upper(x)===upper(obj.concepto))||"OTROS";if(obj.anio)o.anio=Number(obj.anio);if(obj.periodo&&Number(obj.periodo)>=1&&Number(obj.periodo)<=12)o.periodo=String(Number(obj.periodo));
    if(obj.nit&&!$("nitGlobal").value)$("nitGlobal").value=obj.nit;if(obj.razonSocial&&!$("razonGlobal").value)$("razonGlobal").value=upper(obj.razonSocial);
    if(Array.isArray(obj.cuotas)&&obj.cuotas.length)o.vencimientos=obj.cuotas.map((x,i)=>({id:uid("VTO"),numero:Number(x.numero||i+1),periodo:x.periodo??x.numero??i+1,fecha:fechaISO(x.fecha)||"",impuesto:Number(x.impuesto||0)}));
    if(obj.tieneSancion)o.tieneSancion=upper(obj.tieneSancion);if(obj.valorSancion!=null)o.valorSancion=Number(obj.valorSancion||0);if(obj.fechaSancion)o.fechaSancion=fechaISO(obj.fechaSancion);if(obj.beneficioSancion)o.beneficioSancion=upper(obj.beneficioSancion);
    $("resultadoImportacionObligacionTDJ").textContent=`Importación asignada a OBLIGACIÓN ${o.numero}${obj.cuotas?.length?` · ${obj.cuotas.length} cuota(s) reconocida(s)`:""}.`;$("importarObligacionTexto").value="";renderObligaciones();
  }catch(e){setStatus("LISTO","ok");alert(e.message||"No fue posible procesar la importación.");}
}

async function importarPagosGlobal(usarIA){
  const text=$("importarPagosTexto")?.value.trim();if(!text)return alert("Pegue primero los pagos.");
  try{
    const o=obtenerObligacionDestino("destinoImportacionPagos","Seleccione la obligación a la que desea aplicar los pagos importados.");
    const base=importarDatosInteligente(text);let nuevos=base.pagos||[];
    if(usarIA){setStatus("IA DIAN — VALIDANDO PAGOS...","loading");const ai=await interpretarPagosConIA(text);const fusion=fusionarPagosSeguros(nuevos,ai.pagos||[]);nuevos=fusion.pagos;setStatus(`IA DIAN — PAGOS VALIDADOS ${Math.round(Number(ai.confidence||0)*100)}%`,"ok");}
    if(!nuevos.length)throw new Error("No se encontraron pagos con fecha y valor válidos.");
    for(const p of nuevos){const pos=o.pagos.length+1;o.pagos.push({id:uid("PAG"),numero:pos,recibo:p.recibo||"",fecha:fechaISO(p.fecha)||"",valor:truncarValorEntero(p.valor),tipo:upper(p.tipo||"TASA DIAN"),observacion:upper(p.observacion||""),_orden:Date.now()+o.pagos.length});}
    ordenarPagosCronologicamente(o);$("resultadoImportacionPagosTDJ").textContent=`Se agregaron ${nuevos.length} pago(s) a OBLIGACIÓN ${o.numero}.`;$("importarPagosTexto").value="";renderPagos();renderObligaciones();refrescarTasasPagos();
  }catch(e){setStatus("LISTO","ok");alert(e.message||"No fue posible procesar los pagos.");}
}

async function procesarImportacionObligacion(o,sec,usarIA){
  const text=sec.querySelector('[data-import]').value.trim();if(!text)return alert("Pegue primero la información de la obligación.");
  try{
    let base=importarDatosObligacionInteligente(text);let obj=base;
    if(usarIA){setStatus("IA DIAN — VALIDANDO IMPORTACIÓN...","loading");const ai=await interpretarObligacionConIA(text,base);obj=ai.resultado;setStatus(`IA DIAN — VALIDACIÓN ${Math.round(Number(ai.confidence||0)*100)}%`,"ok");}
    if(obj.concepto)o.concepto=CONCEPTOS.find(x=>upper(x)===upper(obj.concepto))||"OTROS";if(obj.anio)o.anio=Number(obj.anio);if(obj.periodo && Number(obj.periodo)>=1 && Number(obj.periodo)<=12)o.periodo=String(Number(obj.periodo));if(obj.nit&&!( $("nitGlobal").value))$("nitGlobal").value=obj.nit;if(obj.razonSocial&&!$("razonGlobal").value)$("razonGlobal").value=upper(obj.razonSocial);
    if(Array.isArray(obj.cuotas)&&obj.cuotas.length){o.vencimientos=obj.cuotas.map((x,i)=>({id:uid("VTO"),numero:Number(x.numero||i+1),periodo:x.periodo??x.numero??i+1,fecha:fechaISO(x.fecha)||"",impuesto:Number(x.impuesto||0)}));}
    if(obj.tieneSancion)o.tieneSancion=upper(obj.tieneSancion);if(obj.valorSancion)o.valorSancion=Number(obj.valorSancion);if(obj.fechaSancion)o.fechaSancion=fechaISO(obj.fechaSancion);
    sec.querySelector('[data-import-result]').textContent=`Importación asignada a OBLIGACIÓN ${o.numero}${obj.cuotas?.length?` · ${obj.cuotas.length} cuota(s) reconocida(s)`:""}.`;
    renderObligaciones();
  }catch(e){setStatus("LISTO","ok");alert(e.message||"No fue posible procesar la importación.");}
}

async function procesarImportacionPagos(o,sec,usarIA){
  const text=sec.querySelector('[data-import-pagos]').value.trim();if(!text)return alert("Pegue primero los pagos de esta obligación.");
  try{
    const base=importarDatosInteligente(text);let nuevos=base.pagos||[];
    if(usarIA){setStatus("IA DIAN — VALIDANDO PAGOS...","loading");const ai=await interpretarPagosConIA(text);const fusion=fusionarPagosSeguros(nuevos,ai.pagos||[]);nuevos=fusion.pagos;setStatus(`IA DIAN — PAGOS VALIDADOS ${Math.round(Number(ai.confidence||0)*100)}%`,"ok");}
    if(!nuevos.length)throw new Error("No se encontraron pagos con fecha y valor válidos.");
    for(const p of nuevos){
      const pos=o.pagos.length+1;
      o.pagos.push({id:uid("PAG"),numero:pos,recibo:p.recibo||"",fecha:fechaISO(p.fecha)||"",valor:truncarValorEntero(p.valor),tipo:upper(p.tipo||"TASA DIAN"),observacion:upper(p.observacion||""),_orden:Date.now()+o.pagos.length});
    }
    ordenarPagosCronologicamente(o);
    sec.querySelector('[data-pagos-result]').textContent=`Se agregaron ${nuevos.length} pago(s) a OBLIGACIÓN ${o.numero}.`;
    renderPagos();renderObligaciones();
  }catch(e){setStatus("LISTO","ok");alert(e.message||"No fue posible procesar los pagos.");}
}

function renderTitulos(){
  const tabla=$("tablaTitulos");
  if(!tabla)return;
  const tbody=tabla.querySelector('tbody');
  if(!tbody)return;
  // EL ORDEN VISUAL ES EL ORDEN DE CAPTURA (TDJ 1, TDJ 2, TDJ 3...).
  // LA ORDENACIÓN CRONOLÓGICA SE HACE ÚNICAMENTE AL LIQUIDAR, NO DURANTE LA DIGITACIÓN.
  titulos.forEach((t,i)=>{t.numero=i+1;});
  tbody.innerHTML="";
  titulos.forEach((t,i)=>{
    const tr=document.createElement('tr');
    tr.dataset.tituloId=t.id;
    const tasa=tasaParaPagoTDJ(t);
    tr.innerHTML=`<td>${i+1}</td><td><input data-t="tdj" value="${esc(t.tdj||"")}" placeholder="TDJ Nº"></td><td>${campoFecha(`tdj-${t.id}`,t.fecha)}</td><td><input data-t="valor" class="money" inputmode="numeric" value="${t.valor?dinero(t.valor):""}" placeholder="$ 0"></td><td><select data-t="tipo" tabindex="-1">${opcionesTipoTDJ(t.tipo||"TASA DIAN")}</select></td><td class="tasa-titulo">${tasa==null?"SIN DATOS":(tasa*100).toFixed(3)+"%"}</td><td><input data-t="observacion" value="${esc(upper(t.observacion||""))}" placeholder="OBSERVACIÓN"></td><td><button class="peligro" data-del>Eliminar</button></td>`;
    const sincronizarCampoTitulo=el=>{
      const k=el.dataset.t;
      invalidarResultadoTDJ();
      if(k==='valor'){
        t[k]=truncarValorEntero(numeroDesdeTexto(el.value));
        if(document.activeElement!==el)el.value=t[k]?dinero(t[k]):"";
      }else{
        t[k]=upper(el.value);
        if(k==='tdj'||k==='observacion')el.value=t[k];
        if(k==='tipo'){
          const tasaActual=tasaParaPagoTDJ(t);
          const celda=tr.querySelector('.tasa-titulo');
          if(celda)celda.textContent=tasaActual==null?"SIN DATOS":(tasaActual*100).toFixed(3)+"%";
        }
      }
    };
    tr.querySelectorAll('[data-t]').forEach(el=>{
      el.addEventListener('input',()=>sincronizarCampoTitulo(el));
      el.addEventListener('change',()=>sincronizarCampoTitulo(el));
    });
    // AL SALIR DEL CAMPO VALOR (TAB O MOUSE), ESTANDARIZAR INMEDIATAMENTE A COP.
    const valorTitulo=tr.querySelector('[data-t="valor"]');
    if(valorTitulo)valorTitulo.addEventListener('blur',()=>{
      t.valor=truncarValorEntero(numeroDesdeTexto(valorTitulo.value));
      valorTitulo.value=t.valor?dinero(t.valor):"";
    });
    // ENTER EN UN CAMPO DEL TÍTULO NO CREA FILAS NI AGREGA UN TDJ.
    tr.querySelectorAll('[data-t]').forEach(el=>el.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        e.stopPropagation();
        if(el.dataset.t==='valor'){
          t.valor=numeroDesdeTexto(el.value);
          el.value=t.valor?dinero(t.valor):"";
        }
      }
    }));
    const fecha=tr.querySelector(`#tdj-${t.id}`);
    if(fecha)montarFechaDual(fecha.parentElement,iso=>{invalidarResultadoTDJ();t.fecha=iso;const tasaActual=tasaParaPagoTDJ(t);const celda=tr.querySelector(".tasa-titulo");if(celda)celda.textContent=tasaActual==null?"SIN DATOS":(tasaActual*100).toFixed(3)+"%";});
    configurarTabTitulo(tr,tbody);
    tr.querySelector('[data-del]').addEventListener('click',()=>{
      invalidarResultadoTDJ();
      titulos=titulos.filter(x=>x.id!==t.id);
      if(!titulos.length)titulos=[nuevoTitulo(1)];
      renderTitulos();
    });
    tbody.appendChild(tr);
  });
}
function renumerarTitulos(){titulos.forEach((t,i)=>{t.numero=i+1;});}

function agregarObligacion(){invalidarResultadoTDJ();obligaciones.push(nuevaObligacion(obligaciones.length+1));renderObligaciones();renderPagos();}
function agregarTitulo(){invalidarResultadoTDJ();titulos.push(nuevoTitulo(titulos.length+1));renderTitulos();}
function sincronizarPagosVisiblesTDJ(){
  // La interfaz puede conservar temporalmente un valor escrito en pantalla
  // mientras el evento change aún no se dispara. Antes de CADA cálculo leemos
  // nuevamente todas las filas visibles de pagos para garantizar que el motor
  // procese todos los registros, en orden cronológico y sin datos obsoletos.
  document.querySelectorAll('.pago-obligacion-card').forEach(sec=>{
    const o=obligaciones.find(x=>x.id===sec.dataset.id);
    if(!o)return;
    const filas=[...sec.querySelectorAll('.pagos-mini tbody tr')];
    filas.forEach((tr,i)=>{
      const p=o.pagos[i];
      if(!p)return;
      const recibo=tr.querySelector('[data-p="recibo"]');
      const valor=tr.querySelector('[data-p="valor"]');
      const tipo=tr.querySelector('[data-p="tipo"]');
      const obs=tr.querySelector('[data-p="observacion"]');
      const fechaText=tr.querySelector('.fecha-campo');
      const fechaPicker=tr.querySelector('.fecha-native');
      if(recibo)p.recibo=String(recibo.value||'').trim();
      if(valor)p.valor=truncarValorEntero(numeroDesdeTexto(valor.value));
      if(tipo)p.tipo=upper(tipo.value||p.tipo||'TASA DIAN');
      if(obs)p.observacion=upper(obs.value||'');
      const f=fechaISO(fechaText?.value||'')||fechaISO(fechaPicker?.value||'')||fechaISO(p.fecha||'');
      if(f){p.fecha=f;if(fechaPicker)fechaPicker.value=f;if(fechaText)fechaText.value=fechaVisible(f);}
      p._orden=Number(p._orden||i+1);
    });
    o.pagos=o.pagos.filter(p=>p.fecha&&Number(p.valor)>0).map(p=>({...p,fecha:fechaISO(p.fecha),valor:truncarValorEntero(p.valor)}));
    ordenarPagosCronologicamente(o);
  });
}

function validarDatos(){
  if(!$("nitGlobal").value.trim()){const e=new Error("Ingrese el NIT.");e.focusTarget="#nitGlobal";throw e;}
  if(!$("razonGlobal").value.trim()){const e=new Error("Ingrese la razón social.");e.focusTarget="#razonGlobal";throw e;}
  if(!obligaciones.length){const e=new Error("Debe existir al menos una obligación.");e.focusTarget="#listaObligaciones";throw e;}
  const activas=[];
  for(const o of obligaciones){
    o.vencimientos=o.vencimientos.filter(v=>v.fecha&&Number(v.impuesto)>0);
    if(!o.concepto){const e=new Error(`OBLIGACIÓN ${o.numero}: seleccione el concepto/impuesto.`);e.focusTarget=`#listaObligaciones [data-k="concepto"]`;throw e;}
    if(o.periodo!=="" && (!/^\d+$/.test(String(o.periodo)) || Number(o.periodo)<1 || Number(o.periodo)>12))throw new Error(`OBLIGACIÓN ${o.numero}: el período debe estar entre 1 y 12.`);
    if(!o.anio){const e=new Error(`OBLIGACIÓN ${o.numero}: indique el año gravable.`);e.focusTarget=`#listaObligaciones [data-k="anio"]`;throw e;}
    if(!o.vencimientos.length){const e=new Error(`OBLIGACIÓN ${o.numero}: registre al menos una cuota con fecha e importe.`);e.focusTarget=`#listaObligaciones .cuotas-mini .fecha-campo, #listaObligaciones .cuotas-mini [data-v="impuesto"]`;throw e;}
    if(!o.tieneSancion)o.tieneSancion="NO";
    if(o.tieneSancion==="SI"&&!Number(o.valorSancion||0)){const e=new Error(`OBLIGACIÓN ${o.numero}: indique el valor de la sanción.`);e.focusTarget=`#listaObligaciones [data-k="valorSancion"]`;throw e;}
    o.pagos=o.pagos.filter(p=>p.fecha&&Number(p.valor)>0).map(p=>({...p,fecha:fechaISO(p.fecha),valor:truncarValorEntero(p.valor)}));
    ordenarPagosCronologicamente(o);
    activas.push(o);
  }
  // SINCRONIZAR LOS TÍTULOS VISIBLES ANTES DE VALIDAR.
  // Esto evita que un valor/fecha que ya aparece en pantalla quede fuera del
  // estado interno si el usuario lo acaba de editar o si el navegador
  // disparó el cambio de forma distinta.
  const filasTitulos=[...document.querySelectorAll("#tablaTitulos tbody tr")];
  filasTitulos.forEach((tr,i)=>{
    let t=titulos.find(x=>x.id===tr.dataset.tituloId)||titulos[i];
    if(!t){
      t=nuevoTitulo(i+1);
      if(tr.dataset.tituloId)t.id=tr.dataset.tituloId;
      titulos.push(t);
    }
    const tdj=tr.querySelector('[data-t="tdj"]');
    const valor=tr.querySelector('[data-t="valor"]');
    const obs=tr.querySelector('[data-t="observacion"]');
    const tipo=tr.querySelector('[data-t="tipo"]');
    const fechaText=tr.querySelector('.fecha-campo');
    const fechaPicker=tr.querySelector('.fecha-native');
    if(tdj)t.tdj=upper(tdj.value||"");
    if(valor){
      const v=truncarValorEntero(numeroDesdeTexto(valor.value));
      if(Number.isFinite(v))t.valor=v;
    }
    if(obs)t.observacion=upper(obs.value||"");
    if(tipo)t.tipo=upper(tipo.value||t.tipo||"TASA DIAN");
    // La fecha visible es la fuente de verdad para el cálculo. En algunos
    // navegadores el input type=date puede conservar un valor parcial o
    // desactualizado cuando el usuario escribió directamente DD/MM/AAAA.
    // Intentamos primero la fecha visible y luego el picker.
    const f=fechaISO(fechaText?.value||"")||fechaISO(fechaPicker?.value||"")||fechaISO(t.fecha||"");
    if(f){
      t.fecha=f;
      if(fechaPicker)fechaPicker.value=f;
      if(fechaText)fechaText.value=fechaVisible(f);
    }
  });
  // Nunca eliminamos de la captura un título por una discrepancia transitoria
  // de fecha/valor. Los títulos incompletos se conservan y simplemente no
  // participan en la aplicación hasta tener fecha y valor válidos.
  titulos=titulos.map((t,i)=>({...t,numero:i+1,fecha:fechaISO(t.fecha)||"",valor:truncarValorEntero(t.valor||0)}));
  ordenarTitulosCronologicamente();
  // LOS TÍTULOS/TDJ SON OPCIONALES. Una liquidación puede ejecutarse
  // únicamente con la obligación, vencimientos y pagos normales.
  return activas;
}

function conceptoMotor(concepto){
  const c=upper(concepto).normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(c.includes("RETENCION"))return "RETENCION";
  if(c.includes("IMPUESTO SOBRE LAS VENTAS")||c==="IVA")return "VENTAS";
  if(c.includes("IMPUESTO NACIONAL AL CONSUMO"))return "CONSUMO";
  return upper(concepto);
}
function datosMotor(o,pagos,fechaCorte){
  return {nit:$("nitGlobal").value.replace(/\D/g,""),razonSocial:upper($("razonGlobal").value),anio:Number(o.anio),concepto:conceptoMotor(o.concepto),periodo:o.periodo,tipoLiquidacion:upper(o.tipoLiquidacion||"PRIVADA"),fechaAutoAdmisorio:o.fechaAutoAdmisorio||"",fechaProvidenciaDefinitiva:o.fechaProvidenciaDefinitiva||"",fechaCorte:fechaCorte||hoyISO(),vencimientos:o.vencimientos,tieneSancion:o.tieneSancion,valorSancion:Number(o.valorSancion||0),fechaSancion:o.fechaSancion||o.vencimientos[0]?.fecha||"",beneficioSancion:o.beneficioSancion||"",beneficioTributario:o.beneficioTributario||"NINGUNO",pagos};
}
function motorParaObligacion(o){
  return upper(o?.tipoLiquidacion||"PRIVADA")==="OFICIAL" && motorOficial ? motorOficial : motor;
}
function calcularLiquidacionBaseTDJ(o){
  const pagos=[...(o.pagos||[])].filter(p=>p.fecha&&Number(p.valor)>0).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  const fechaCorte=pagos.at(-1)?.fecha||hoyISO();
  return motorParaObligacion(o).calcular(datosMotor(o,pagos,fechaCorte));
}

function sincronizarTitulosVisiblesTDJ(){
  const filas=[...document.querySelectorAll("#tablaTitulos tbody tr")];
  filas.forEach((tr,i)=>{
    const id=tr.dataset.tituloId;
    let t=titulos.find(x=>x.id===id)||titulos[i];
    if(!t){
      t=nuevoTitulo(i+1);
      if(id)t.id=id;
      titulos.push(t);
    }
    const tdj=tr.querySelector('[data-t="tdj"]');
    const valor=tr.querySelector('[data-t="valor"]');
    const tipo=tr.querySelector('[data-t="tipo"]');
    const obs=tr.querySelector('[data-t="observacion"]');
    const fechaText=tr.querySelector('.fecha-campo');
    const fechaPicker=tr.querySelector('.fecha-native');
    if(tdj)t.tdj=upper(tdj.value||"");
    if(valor)t.valor=truncarValorEntero(numeroDesdeTexto(valor.value));
    if(tipo)t.tipo=upper(tipo.value||t.tipo||"TASA DIAN");
    if(obs)t.observacion=upper(obs.value||"");
    const f=fechaISO(fechaText?.value||"")||fechaISO(fechaPicker?.value||"")||fechaISO(t.fecha||"");
    if(f)t.fecha=f;
  });
  titulos=titulos.map((t,i)=>({...t,numero:i+1,fecha:fechaISO(t.fecha)||"",valor:truncarValorEntero(t.valor||0)}));
  ordenarTitulosCronologicamente();
}

function aplicarTitulos(){
  try{
    // Cada clic es un cálculo nuevo. Primero se toma exactamente lo que está
    // visible en PAGOS y TÍTULOS; luego se elimina cualquier resultado previo
    // y finalmente se ejecuta nuevamente toda la secuencia cronológica.
    sincronizarPagosVisiblesTDJ();
    sincronizarTitulosVisiblesTDJ();
    validarDatos();
    if(!motor)throw new Error("El motor de liquidación todavía no está listo.");

    // PRIMERO: liquidación normal de cada obligación, exactamente con los
    // pagos registrados para esa obligación. Esta liquidación queda guardada
    // como soporte base para PDF y Excel.
    const liquidacionesBase=new Map();
    for(const o of obligaciones){
      liquidacionesBase.set(o.id,calcularLiquidacionBaseTDJ(o));
    }

    // La secuencia de aplicación de TDJ respeta el orden de las obligaciones
    // que el usuario registró: OBLIGACIÓN 1, luego 2, luego 3, etc.
    // Los títulos, en cambio, siempre se procesan por fecha.
    const obligacionesOrden=[...obligaciones].sort((a,b)=>Number(a.numero||0)-Number(b.numero||0));
    const titulosOrden=[...titulos]
      .filter(t=>fechaISO(t.fecha)&&Number(t.valor)>0)
      .sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||Number(a.numero)-Number(b.numero));
    const aplicaciones=obligaciones.map(o=>({obligacionId:o.id,items:[]}));
    const prevTitlePayments=new Map(obligaciones.map(o=>[o.id,[]]));
    const resumenTitulos=[];

    // SEGUNDO: cada TDJ se comporta como un pago adicional, pero en ambos
    // sentidos: un título puede cubrir varias obligaciones y, a la inversa,
    // varias títulos pueden cubrir una misma obligación.
    //
    // Cuando un título no alcanza a cubrir la obligación actual, el siguiente
    // título vuelve a liquidar esa obligación a SU PROPIA FECHA. De esta forma
    // el motor recalcula intereses, sanción/actualización y saldo exactamente
    // hasta la fecha del nuevo título antes de imputarlo.
    //
    // Cuando un título excede la obligación, solamente el remanente continúa
    // hacia la obligación siguiente.
    for(const t of titulosOrden){
      let disponible=Number(t.valor||0);
      const traz=[];

      for(const o of obligacionesOrden){
        if(disponible<=0)break;

        const pagosBase=[...o.pagos]
          .filter(p=>p.fecha&&p.fecha<=t.fecha)
          .sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||Number(a.numero||0)-Number(b.numero||0))
          .map(p=>({...p,ordenInterno:0}));

        // Incluye únicamente los títulos anteriores que ya fueron imputados
        // a esta misma obligación. Así, si hacen falta 2, 3 o 4 títulos, cada
        // nuevo título se convierte en un nuevo pago fechado en su propia fecha.
        const anteriores=prevTitlePayments.get(o.id)||[];
        const pagoActual={
          id:uid("APTDJ"),numero:999999,fecha:t.fecha,valor:truncarValorEntero(disponible),
          tipo:upper(t.tipo||"TASA DIAN"),observacion:upper(t.observacion||""),tdj:t.tdj||`TDJ ${t.numero}`,ordenInterno:1
        };
        const todos=[...pagosBase,...anteriores,pagoActual];
        todos.sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||Number(a.ordenInterno||0)-Number(b.ordenInterno||0)||Number(a.numero||0)-Number(b.numero||0));

        // La fecha de corte es la fecha del TDJ actual. Por tanto, cuando
        // llega el TDJ 2/3/4, los intereses se calculan hasta esa nueva fecha.
        const r=motorParaObligacion(o).calcular(datosMotor(o,todos,t.fecha));
        // Buscar explícitamente el detalle generado por ESTE TDJ. No debemos
        // depender de que sea simplemente el último elemento del arreglo: si
        // existen pagos con la misma fecha, el orden interno del motor puede
        // dejar otro registro al final.
        const ultimo=r.detalle?.find(d=>d?.pago?.id===pagoActual.id) || r.detalle?.at(-1);
        if(!ultimo)continue;

        // EL TDJ ES UN PAGO MÁS: el valor efectivamente imputado se obtiene
        // por la variación real de la deuda total antes/después del pago, no
        // por una reconstrucción independiente del TDJ. Así, impuesto,
        // intereses y sanción siempre se consumen con la misma proporcionalidad
        // y el mismo redondeo del liquidador normal.
        // EL TDJ ES UN PAGO MÁS. La distribución económica ya fue realizada
        // por el mismo motor que usa el liquidador normal: impuesto + intereses
        // + sanción, mediante la proporcionalidad del Art. 804 E.T.
        // No se reconstruye ni se prioriza ningún componente aquí.
        const aplicado=Math.min(
          Math.max(0,disponible),
          Math.max(0,Number(ultimo?.aplicado?.total||0))
        );

        // Si esta obligación ya está totalmente cubierta (o el título todavía
        // no puede imputarse a ella), no generamos una fila ficticia. El título
        // continúa buscando la siguiente obligación y, si no encuentra deuda
        // imputable, conserva íntegramente su valor para endoso.
        if(aplicado<=0)continue;

        const excedente=Math.max(0,disponible-aplicado);

        // TRAZABILIDAD POR VENCIMIENTO: el motor ya calcula la imputación
        // económica correcta. Aquí NO se recalcula impuesto, intereses ni
        // sanción. Únicamente se protege la ubicación visual de la sanción
        // para que un vencimiento que ya estaba totalmente cancelado antes
        // del TDJ no vuelva a recibir una sanción en el PDF.
        //
        // Regla cerrada:
        // 1) Si el vencimiento todavía tiene impuesto o intereses pendientes
        //    a la fecha del TDJ, puede recibir la sanción proporcional de ese
        //    mismo pago.
        // 2) Si un vencimiento está completamente cancelado antes del TDJ,
        //    nunca se le asigna nuevamente sanción solo porque recibió sanción
        //    en un pago anterior.
        // 3) Si no queda impuesto/interés en ningún vencimiento y únicamente
        //    subsiste sanción, se conserva la ubicación que entrega el motor;
        //    esto permite el caso válido de sanción pendiente sin capital.
        const aplicacionesTDJ=[...(ultimo?.aplicacionesVto||[])].map(a=>({...a}));
        const idsVtosConDeudaActual=new Set(
          (ultimo?.interesesPorCuota||[])
            .filter(v=>Number(v.capitalBase||0)>0 || Number(v.interes||0)>0)
            .map(v=>v.vto)
        );
        const sancionAplicar=Math.max(0,Number(ultimo?.aplicado?.sancion||0));

        if(sancionAplicar>0 && idsVtosConDeudaActual.size){
          let sancionFueraDeVtoPendiente=0;
          aplicacionesTDJ.forEach(a=>{
            if(Number(a.aplicadoSancion||0)>0 && !idsVtosConDeudaActual.has(a.id)){
              sancionFueraDeVtoPendiente+=Number(a.aplicadoSancion||0);
              a.aplicadoSancion=0;
            }
          });

          if(sancionFueraDeVtoPendiente>0){
            const targetId=[...(idsVtosConDeudaActual)].find(id=>
              (ultimo?.interesesPorCuota||[]).some(v=>v.vto===id)
            );
            if(targetId){
              const filaSancion=aplicacionesTDJ.find(a=>a.id===targetId);
              if(filaSancion) filaSancion.aplicadoSancion=Number(filaSancion.aplicadoSancion||0)+sancionFueraDeVtoPendiente;
              else aplicacionesTDJ.push({id:targetId,aplicado:0,aplicadoIntereses:0,aplicadoSancion:sancionFueraDeVtoPendiente,saldo:0});
            }
          }
        }

        const detalleAplicacionTDJ={
          ...ultimo,
          aplicacionesVto:aplicacionesTDJ
        };

        const saldoDespues=Number(ultimo?.saldo?.total??r.total??0);
        const fila={
          tituloId:t.id,titulo:t.tdj||`TDJ ${t.numero}`,fecha:t.fecha,
          obligacionId:o.id,obligacionNumero:o.numero,
          obligacion:`${upper(o.concepto)} ${o.anio}${o.periodo?` · P${o.periodo}`:""}`,
          valorAntes:disponible,aplicado,saldoTitulo:excedente,saldoObligacion:saldoDespues,
          aplicadoImpuesto:Number(ultimo?.aplicado?.impuesto||0),
          aplicadoIntereses:Number(ultimo?.aplicado?.intereses||0),
          aplicadoSancion:sancionAplicar,
          interesesGenerados:Number(ultimo?.interesLiquidado||0),
          detalleMotor:r,detalleAplicacion:detalleAplicacionTDJ
        };

        // Registramos el paso incluso cuando el TDJ no alcanza: queda visible
        // el saldo pendiente que deberá atender el siguiente título.
        aplicaciones.find(x=>x.obligacionId===o.id).items.push(fila);
        traz.push(fila);
        disponible=excedente;

        if(aplicado>0){
          // El siguiente título verá este pago como antecedente y calculará
          // nuevamente la deuda a su propia fecha.
          prevTitlePayments.get(o.id).push({...pagoActual,valor:aplicado});
        }
      }

      // Si después de recorrer las obligaciones todavía queda saldo, este
      // título conserva ese saldo como excedente para endoso.
      resumenTitulos.push({titulo:t,trazabilidad:traz,excedente:disponible});
    }

    const resumenObligaciones=obligaciones.map(o=>{
      const apps=aplicaciones.find(x=>x.obligacionId===o.id)?.items||[];
      const base=liquidacionesBase.get(o.id);
      const last=apps.at(-1)?.detalleMotor;
      const totalPagos=o.pagos.reduce((a,p)=>a+Number(p.valor||0),0);
      const totalTDJ=apps.reduce((a,x)=>a+Number(x.aplicado||0),0);
      const saldo=Number(last?.total ?? base?.total ?? 0);
      return {obligacion:o,totalPagos,totalTDJ,saldo,ultima:apps.at(-1)||null,aplicaciones:apps,liquidacionBase:base};
    });
    const endoso=resumenTitulos.reduce((a,x)=>a+Number(x.excedente||0),0);

    // INVARIANTES DE SEGURIDAD TDJ: el sistema no puede declarar endoso por
    // dinero que en realidad corresponda a una obligación todavía exigible.
    // Además, la suma de títulos debe cerrar exactamente contra aplicado + endoso.
    const totalTitulos= titulos.filter(t=>fechaISO(t.fecha)&&Number(t.valor)>0).reduce((a,t)=>a+Math.max(0,Number(t.valor||0)),0);
    const totalAplicado=resumenTitulos.reduce((a,x)=>a+x.trazabilidad.reduce((z,y)=>z+Math.max(0,Number(y.aplicado||0)),0),0);
    const diferenciaCierre=Math.round((totalTitulos-totalAplicado-endoso)*100)/100;
    if(Math.abs(diferenciaCierre)>1){
      throw new Error(`INCONSISTENCIA DE CIERRE TDJ: TÍTULOS ${dinero(totalTitulos)}, APLICADO ${dinero(totalAplicado)}, ENDOSO ${dinero(endoso)}.`);
    }
    if(resumenObligaciones.some(x=>Number(x.saldo||0)<-1)){
      throw new Error("INCONSISTENCIA TDJ: una obligación quedó con saldo negativo.");
    }

    resultado={resumenObligaciones,resumenTitulos,endoso,fechaCalculo:hoyISO()};
    resultadoDesactualizado=false;
    pintarResultado(resultado);
    activarTab("titulos");
    setTimeout(()=>document.getElementById("resultadoTDJ")?.scrollIntoView({behavior:"smooth",block:"start"}),50);
  }catch(e){console.error(e);alert(e.message||"No fue posible realizar la aplicación de títulos.");enfocarCampoErrorTDJ(e.focusTarget);}
}

function pintarResultado(r){
  const box=$("resultadoTDJ");if(!box)return;box.hidden=false;box.style.display="";
  const totalTitulos=titulos.filter(t=>fechaISO(t.fecha)&&Number(t.valor)>0).reduce((a,t)=>a+Number(t.valor||0),0);
  const totalAplicado=r.resumenTitulos.reduce((a,t)=>a+t.trazabilidad.reduce((x,y)=>x+Number(y.aplicado||0),0),0);
  const totalSaldo=r.resumenObligaciones.reduce((a,o)=>a+Number(o.saldo||0),0);
  if($("resTotalTitulos"))$("resTotalTitulos").textContent=dinero(totalTitulos);if($("resAplicado"))$("resAplicado").textContent=dinero(totalAplicado);if($("resEndoso"))$("resEndoso").textContent=dinero(r.endoso);if($("resSaldo"))$("resSaldo").textContent=dinero(totalSaldo);
  const otbody=$("tablaResultadoObligaciones")?.querySelector("tbody");
  if(otbody){
    otbody.innerHTML="";
    r.resumenObligaciones.forEach(x=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(x.obligacion.numero)}</td><td>${esc(upper(x.obligacion.concepto))} ${esc(x.obligacion.anio)} ${esc(x.obligacion.periodo||"")}</td><td>${dinero(x.totalPagos)}</td><td>${dinero(x.totalTDJ)}</td><td>${dinero(x.saldo)}</td>`;otbody.appendChild(tr);});
  }
  const ttbody=$("tablaAplicacion")?.querySelector("tbody");
  if(ttbody){
    ttbody.innerHTML="";
    r.resumenTitulos.forEach(x=>{
      if(!x.trazabilidad.length){const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(x.titulo.tdj||`TDJ ${x.titulo.numero}`)}</td><td>${fechaVisible(x.titulo.fecha)}</td><td>—</td><td>${dinero(x.titulo.valor)}</td><td>$ 0</td><td>${dinero(x.excedente)}</td><td>ENDOSO</td>`;ttbody.appendChild(tr);return;}
      x.trazabilidad.forEach(a=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(a.titulo)}</td><td>${fechaVisible(a.fecha)}</td><td>${esc(a.obligacion)}</td><td>${dinero(a.valorAntes)}</td><td>${dinero(a.aplicadoImpuesto)}</td><td>${dinero(a.aplicadoIntereses)}</td><td>${dinero(a.aplicadoSancion)}</td><td>${dinero(a.aplicado)}</td><td>${dinero(a.saldoTitulo)}</td><td>${dinero(a.saldoObligacion)}</td>`;ttbody.appendChild(tr);});
    });
  }
  const nota=$("notaEndoso");if(nota)nota.textContent=r.endoso>0?`TÍTULOS SOBRANTES PARA ENDOSO: ${dinero(r.endoso)}.`:"NO QUEDARON TÍTULOS SOBRANTES PARA ENDOSO.";
  const eb=$("tablaEndoso")?.querySelector("tbody");
  if(eb){eb.innerHTML="";r.resumenTitulos.filter(x=>Number(x.excedente||0)>0).forEach(x=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(x.titulo.tdj||`TDJ ${x.titulo.numero}`)}</td><td>${fechaVisible(x.titulo.fecha)}</td><td>${dinero(x.titulo.valor)}</td><td>${dinero(x.excedente)}</td><td>ENDOSO</td>`;eb.appendChild(tr);});if(!eb.children.length){const tr=document.createElement("tr");tr.innerHTML="<td colspan=5>NO HAY TÍTULOS SOBRANTES.</td>";eb.appendChild(tr);}}
}

function xmlEscTDJ(v){
  // XML 1.0 no admite determinados caracteres de control; se eliminan para
  // impedir que observaciones o textos pegados dañen el libro XLSX.
  return String(v??"")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
function xlsxColTDJ(n){let s="";while(n){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;}
function xlsxCellTDJ(v,col,row,style=0){
  const ref=xlsxColTDJ(col)+row;
  if(typeof v==="number"&&Number.isFinite(v))return `<c r="${ref}" s="${style}" t="n"><v>${String(v)}</v></c>`;
  const text=xmlEscTDJ(v);
  const preserve=/^\s|\s$/.test(String(v??""))?` xml:space="preserve"`:"";
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t${preserve}>${text}</t></is></c>`;
}
function xlsxSheetTDJ(rows,{moneyCols=[],percentCols=[],rowMoneyCols={},rowPercentCols={},titleRows=[],headerRows=[],columnWidths=[],mergeRanges=[],landscape=true,fitToWidth=1,fitToHeight=0}={}){
  const safeRows=Array.isArray(rows)?rows:[];
  const lastCol=Math.max(1,...safeRows.map(r=>Array.isArray(r)?r.length:0));
  const lastRow=Math.max(1,safeRows.length);
  const dimension=`A1:${xlsxColTDJ(lastCol)}${lastRow}`;
  const body=safeRows.map((r,i)=>{
    const row=Array.isArray(r)?r:[];
    const rm=Array.isArray(rowMoneyCols[i])?rowMoneyCols[i]:moneyCols;
    const rp=Array.isArray(rowPercentCols[i])?rowPercentCols[i]:percentCols;
    return `<row r="${i+1}">${row.map((v,j)=>{
      let style=0;
      if(titleRows.includes(i))style=1;
      else if(headerRows.includes(i))style=2;
      else if(rm.includes(j+1))style=3;
      else if(rp.includes(j+1))style=4;
      return xlsxCellTDJ(v,j+1,i+1,style);
    }).join("")}</row>`;
  }).join("");
  const cols=Array.from({length:lastCol},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${Number(columnWidths[i]||16)}" customWidth="1"/>`).join("");
  const merges=mergeRanges.map(x=>`<mergeCell ref="${x}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`+
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`+
    `<dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews>`+
    `<sheetFormatPr defaultRowHeight="16"/><cols>${cols}</cols><sheetData>${body}</sheetData>`+
    (merges?`<mergeCells count="${mergeRanges.length}">${merges}</mergeCells>`:"")+
    `<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>`+
    `<pageSetup orientation="${landscape?'landscape':'portrait'}" paperSize="9" fitToWidth="${fitToWidth}" fitToHeight="${fitToHeight}"/>`+
    `</worksheet>`;
}
function crc32TDJ(bytes){
  let table=crc32TDJ.table;
  if(!table){table=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}crc32TDJ.table=table;}
  let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;
}
function u16TDJ(v){return new Uint8Array([v&255,(v>>>8)&255]);}
function u32TDJ(v){return new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);}
function zipStoreTDJ(files){
  const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
  for(const f of files){
    const name=enc.encode(f.name),data=typeof f.data==="string"?enc.encode(f.data):f.data;
    const crc=crc32TDJ(data),local=new Uint8Array(30+name.length+data.length);let p=0;
    local.set([80,75,3,4],p);p+=4;
    local.set(u16TDJ(20),p);p+=2;local.set(u16TDJ(0),p);p+=2;local.set(u16TDJ(0),p);p+=2;
    local.set(u16TDJ(0),p);p+=2;local.set(u16TDJ(0),p);p+=2;local.set(u32TDJ(crc),p);p+=4;
    local.set(u32TDJ(data.length),p);p+=4;local.set(u32TDJ(data.length),p);p+=4;
    local.set(u16TDJ(name.length),p);p+=2;local.set(u16TDJ(0),p);p+=2;local.set(name,p);p+=name.length;local.set(data,p);
    chunks.push(local);central.push({name:f.name,data,crc,offset});offset+=local.length;
  }
  const cd=central.map(f=>{
    // Directorio central ZIP de 46 bytes antes del nombre. Mantener esta
    // estructura exactamente alineada evita XLSX corruptos al abrir en Excel.
    const name=enc.encode(f.name),c=new Uint8Array(46+name.length);let p=0;
    c.set([80,75,1,2],p);p+=4;
    c.set(u16TDJ(20),p);p+=2; // version made by
    c.set(u16TDJ(20),p);p+=2; // version needed
    c.set(u16TDJ(0),p);p+=2;  // flags
    c.set(u16TDJ(0),p);p+=2;  // compression: stored
    c.set(u16TDJ(0),p);p+=2;  // mod time
    c.set(u16TDJ(0),p);p+=2;  // mod date
    c.set(u32TDJ(f.crc),p);p+=4;
    c.set(u32TDJ(f.data.length),p);p+=4;
    c.set(u32TDJ(f.data.length),p);p+=4;
    c.set(u16TDJ(name.length),p);p+=2;
    c.set(u16TDJ(0),p);p+=2;  // extra length
    c.set(u16TDJ(0),p);p+=2;  // comment length
    c.set(u16TDJ(0),p);p+=2;  // disk number
    c.set(u16TDJ(0),p);p+=2;  // internal attributes
    c.set(u32TDJ(0),p);p+=4;  // external attributes
    c.set(u32TDJ(f.offset),p);p+=4;
    c.set(name,p);
    return c;
  });
  const cdSize=cd.reduce((a,c)=>a+c.length,0),end=new Uint8Array(22);let p=0;
  end.set([80,75,5,6],p);p+=4;end.set(u16TDJ(0),p);p+=2;end.set(u16TDJ(0),p);p+=2;
  end.set(u16TDJ(files.length),p);p+=2;end.set(u16TDJ(files.length),p);p+=2;end.set(u32TDJ(cdSize),p);p+=4;
  end.set(u32TDJ(offset),p);p+=4;end.set(u16TDJ(0),p);
  const all=new Uint8Array(offset+cdSize+end.length);let q=0;
  for(const x of chunks){all.set(x,q);q+=x.length;}for(const x of cd){all.set(x,q);q+=x.length;}all.set(end,q);
  return new Blob([all.buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
function descargarTDJ(blob,nombre){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=nombre;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
function construirFilasDetalleTDJ(rows,push,detalle,prefijo=""){
  (Array.isArray(detalle)?detalle:[]).forEach((x,i)=>{
    push([prefijo||"PAGO",i+1,x.pago?.tdj||"",x.pago?.recibo||"",x.pago?.fecha||"",x.pago?.valor||0,x.tipoAplicado||"TASA DIAN",x.tasaVisible??"",x.interesGenerado||0,x.aplicado?.impuesto||0,x.aplicado?.intereses||0,x.aplicado?.sancion||0,x.aplicado?.total||0,x.excedente||0],{money:[6,9,10,11,12,13,14],percent:[8]});
  });
}
function cargarScriptTDJ(src,globalName){
  return new Promise((resolve,reject)=>{
    if(globalName&&window[globalName])return resolve(window[globalName]);
    const existente=[...document.scripts].find(x=>x.src===src);
    if(existente){existente.addEventListener("load",()=>resolve(globalName?window[globalName]:true),{once:true});existente.addEventListener("error",reject,{once:true});return;}
    const s=document.createElement("script");s.src=src;s.async=true;s.onload=()=>resolve(globalName?window[globalName]:true);s.onerror=()=>reject(new Error(`No fue posible cargar la librería ${src}. Verifique la conexión a Internet.`));document.head.appendChild(s);
  });
}
function construirFilasExcelTDJ(){
  const rows=[],titleRows=[],headerRows=[],rowMoneyCols={},rowPercentCols=[];
  const push=(r,opt={})=>{const i=rows.length;rows.push(r);if(opt.title)titleRows.push(i);if(opt.header)headerRows.push(i);if(opt.money)rowMoneyCols[i]=opt.money;if(opt.percent)rowPercentCols[i]=opt.percent;};
  const nit=$("nitGlobal")?.value||"SIN_NIT";
  push(["LIQUIDADOR DIAN — LIQUIDACIÓN DE TÍTULOS / TDJ"],{title:true});
  push(["SOPORTE COMPLETO — LIQUIDACIÓN NORMAL + APLICACIÓN SECUENCIAL DE TÍTULOS"],{title:true});push([]);
  push(["NIT",nit,"DV",calcularDvNITTDJ(nit),"RAZÓN SOCIAL",upper($("razonGlobal")?.value||"")]);
  // METADATOS DE ENCABEZADO PARA RECUPERACIÓN COMPLETA DEL EXCEL
  // Se conservan como pares ETIQUETA/VALOR para que tanto el importador
  // normal como el importador TDJ puedan reconstruir la liquidación.
  const primeraObligacion=obligaciones?.[0]||{};
  push(["TIPO DE LIQUIDACIÓN",upper(primeraObligacion.tipoLiquidacion||"PRIVADA")]);
  push(["FECHA AUTO ADMISORIO",primeraObligacion.fechaAutoAdmisorio||""]);
  push(["FECHA PROVIDENCIA DEFINITIVA",primeraObligacion.fechaProvidenciaDefinitiva||""]);
  push(["TIENE SANCIÓN",upper(primeraObligacion.tieneSancion||"NO")]);
  push(["VALOR SANCIÓN",truncarValorEntero(primeraObligacion.valorSancion||0)],{money:[2]});
  push(["FECHA SANCIÓN",primeraObligacion.fechaSancion||""]);
  push([]);
  push(["RESUMEN GENERAL"],{title:true});push(["TOTAL TÍTULOS","TOTAL APLICADO","SALDO OBLIGACIONES","TOTAL ENDOSO"],{header:true});
  push([titulos.reduce((a,t)=>a+Number(t.valor||0),0),resultado.resumenTitulos.reduce((a,x)=>a+x.trazabilidad.reduce((z,y)=>z+Number(y.aplicado||0),0),0),resultado.resumenObligaciones.reduce((a,x)=>a+Number(x.saldo||0),0),resultado.endoso],{money:[1,2,3,4]});push([]);
  resultado.resumenObligaciones.forEach((x,idx)=>{
    const o=x.obligacion,base=x.liquidacionBase||{};
    push([`OBLIGACIÓN ${idx+1} — LIQUIDACIÓN NORMAL`],{title:true});
    push(["CONCEPTO","AÑO","PERÍODO","SANCIÓN","VALOR SANCIÓN","BENEFICIO SANCIÓN","FECHA SANCIÓN","BENEFICIO TRIBUTARIO"],{header:true});
    push([upper(o.concepto),o.anio,o.periodo||"",o.tieneSancion||"NO",o.valorSancion||0,o.beneficioSancion||"",o.fechaSancion||"",o.beneficioTributario||"NINGUNO"],{money:[5]});push([]);
    push(["VENCIMIENTOS / SALDOS"],{title:true});push(["Nº","PERÍODO","FECHA VENCIMIENTO","IMPUESTO DECLARADO","SALDO FINAL BASE"],{header:true});
    (base.vencimientos||o.vencimientos||[]).forEach((v,i)=>push([i+1,v.periodo||i+1,v.fecha,v.impuesto||0,v.saldo||0],{money:[4,5]}));push([]);
    push(["PAGOS REGISTRADOS — LIQUIDACIÓN NORMAL"],{title:true});push(["Nº","RECIBO","FECHA","VALOR","TIPO","TASA","OBSERVACIÓN","INTERÉS GENERADO","IMPUESTO APLICADO","INTERESES APLICADOS","SANCIÓN APLICADA","TOTAL APLICADO","EXCEDENTE"],{header:true});
    (base.detalle||[]).forEach((d,i)=>push([i+1,d.pago?.recibo||"",d.pago?.fecha||"",d.pago?.valor||0,d.tipoAplicado||"TASA DIAN",d.tasaVisible??"",d.pago?.observacion||"",d.interesGenerado||0,d.aplicado?.impuesto||0,d.aplicado?.intereses||0,d.aplicado?.sancion||0,d.aplicado?.total||0,d.excedente||0],{money:[4,7,8,9,10,11,12],percent:[6]}));
    if(!(base.detalle||[]).length)push(["NO HAY PAGOS REGISTRADOS."]);
    if((base.detalle||[]).length){
      push(["IMPUTACIÓN POR VENCIMIENTO — PAGOS NORMALES"],{title:true});
      push(["PAGO","VENCIMIENTO","FECHA VENCIMIENTO","IMPUESTO APLICADO","INTERESES APLICADOS","SANCIÓN APLICADA","SALDO"],{header:true});
      base.detalle.forEach((d,i)=>(d.aplicacionesVto||[]).filter(a=>Number(a.aplicado||0)>0||Number(a.aplicadoIntereses||0)>0||Number(a.aplicadoSancion||0)>0).forEach(a=>{const v=(o.vencimientos||[]).find(z=>z.id===a.id);push([i+1,a.id||"",v?.fecha||"",a.aplicado||0,a.aplicadoIntereses||0,a.aplicadoSancion||0,a.saldo||0],{money:[4,5,6,7]});}));
    }
    push([]);
    push(["DETALLE DE INTERESES POR CUOTA — LIQUIDACIÓN NORMAL"],{title:true});push(["PAGO","CUOTA","VENCIMIENTO","CAPITAL BASE","FECHA VENCIMIENTO","FECHA PAGO","DÍAS","TASA","INTERÉS","METODOLOGÍA","SITUACIÓN"],{header:true});
    (base.detalle||[]).forEach((d,i)=>(d.interesesPorCuota||[]).filter(t=>Number(t.capitalBase||0)>0||Number(t.interes||0)>0).forEach(t=>push([i+1,t.cuota||"",t.vto||"",t.capitalBase||0,t.fechaVencimiento||"",t.fechaPago||"",t.dias||0,t.tasa==null?"":Number(t.tasa)*100,t.interes||0,t.metodologia||"",t.aplica===false?"NO EXIGIBLE":"INTERÉS CALCULADO"],{money:[4,9],percent:[8]})));push([]);
    push(["ACTUALIZACIÓN DE SANCIÓN — LIQUIDACIÓN NORMAL"],{title:true});push(["PAGO","FECHA PAGO","AÑO ACTUALIZACIÓN","FECHA APLICACIÓN","AÑO IPC","VALOR ANTERIOR","IPC","ACTUALIZACIÓN","VALOR DESPUÉS"],{header:true});
    let hubo=false;(base.detalle||[]).forEach((d,i)=>(d.actualizacionSancion?.tramos||[]).forEach(t=>{hubo=true;push([i+1,d.pago?.fecha||"",t.anio||"",t.desde||"",t.anioInflacion||Number(t.anio||0)-1,t.saldoAntes||0,t.ipcPorcentaje||0,t.actualizacion||0,t.saldoDespues||0],{money:[6,8,9],percent:[7]});}));if(!hubo)push(["NO SE REALIZARON ACTUALIZACIONES DE SANCIÓN."]);push([]);
    push([`OBLIGACIÓN ${idx+1} — APLICACIÓN SECUENCIAL DE TÍTULOS / TDJ`],{title:true});push(["TDJ","FECHA","VALOR DISPONIBLE","IMPUESTO","INTERESES","SANCIÓN","TOTAL APLICADO","SALDO TDJ","SALDO OBLIGACIÓN"],{header:true});
    const aplicacionesTDJ=Array.isArray(x.aplicaciones)?x.aplicaciones:[];
    aplicacionesTDJ.forEach(a=>push([a.titulo,a.fecha,a.valorAntes||0,a.aplicadoImpuesto||0,a.aplicadoIntereses||0,a.aplicadoSancion||0,a.aplicado||0,a.saldoTitulo||0,a.saldoObligacion||0],{money:[3,4,5,6,7,8,9]}));
    if(!aplicacionesTDJ.length)push(["NO SE APLICARON TÍTULOS A ESTA OBLIGACIÓN."]);push([]);
    aplicacionesTDJ.forEach((a,j)=>{
      const d=a.detalleAplicacion||a.detalleMotor?.detalle?.at(-1);
      push([`DETALLE TDJ ${a.titulo} — APLICACIÓN ${j+1}`],{title:true});
      push(["DOCUMENTO","FECHA","VALOR DEL TÍTULO","TIPO","TASA"],{header:true});push([a.titulo,a.fecha,a.valorAntes||0,d?.tipoAplicado||"TASA DIAN",d?.tasaVisible??""],{money:[3],percent:[5]});
      push(["DEUDA ANTES DEL TDJ","IMPUESTO","INTERESES","SANCIÓN","TOTAL DEUDA"],{header:true});push(["",d?.deudaAntes?.impuesto||0,d?.deudaAntes?.intereses||0,d?.deudaAntes?.sancion||0,(Number(d?.deudaAntes?.impuesto||0)+Number(d?.deudaAntes?.intereses||0)+Number(d?.deudaAntes?.sancion||0))],{money:[2,3,4,5]});
      push(["APLICACIÓN DEL TDJ","IMPUESTO","INTERESES","SANCIÓN","TOTAL","EXCEDENTE"],{header:true});push(["",d?.aplicado?.impuesto||0,d?.aplicado?.intereses||0,d?.aplicado?.sancion||0,d?.aplicado?.total||0,a.saldoTitulo||0],{money:[2,3,4,5,6]});
      push(["SALDOS DESPUÉS DEL TDJ","IMPUESTO","INTERESES","SANCIÓN","TOTAL"],{header:true});push(["",d?.saldo?.impuesto||0,d?.saldo?.intereses||0,d?.saldo?.sancion||0,d?.saldo?.total||0],{money:[2,3,4,5]});
      push(["INTERESES POR CUOTA — TDJ"],{title:true});push(["CUOTA","CAPITAL BASE","FECHA VENCIMIENTO","FECHA TDJ","DÍAS","TASA","INTERÉS"],{header:true});
      (d?.interesesPorCuota||[]).filter(t=>Number(t.capitalBase||0)>0||Number(t.interes||0)>0).forEach(t=>push([t.cuota||"",t.capitalBase||0,t.fechaVencimiento||"",t.fechaPago||a.fecha,t.dias||0,t.tasa==null?"":Number(t.tasa)*100,t.interes||0],{money:[2,7],percent:[6]}));
      push(["IMPUTACIÓN POR VENCIMIENTO — TDJ"],{title:true});
      push(["VENCIMIENTO","FECHA VENCIMIENTO","IMPUESTO APLICADO","INTERESES APLICADOS","SANCIÓN APLICADA","SALDO"],{header:true});
      (d?.aplicacionesVto||[]).filter(v=>Number(v.aplicado||0)>0||Number(v.aplicadoIntereses||0)>0||Number(v.aplicadoSancion||0)>0).forEach(v=>{const vv=(o.vencimientos||[]).find(z=>z.id===v.id);push([v.id||"",vv?.fecha||"",v.aplicado||0,v.aplicadoIntereses||0,v.aplicadoSancion||0,v.saldo||0],{money:[3,4,5,6]});});
      const ats=d?.actualizacionSancion?.tramos||[];if(ats.length){push(["ACTUALIZACIÓN DE SANCIÓN — TDJ"],{title:true});push(["AÑO","FECHA APLICACIÓN","AÑO IPC","VALOR ANTES","IPC","ACTUALIZACIÓN","VALOR DESPUÉS"],{header:true});ats.forEach(t=>push([t.anio||"",t.desde||"",t.anioInflacion||Number(t.anio||0)-1,t.saldoAntes||0,t.ipcPorcentaje||0,t.actualizacion||0,t.saldoDespues||0],{money:[4,6,7],percent:[5]}));}
      push([]);
    });
  });
  // CONTROL DE TÍTULOS REGISTRADOS: se construye directamente desde el
  // estado actual de la tabla, no desde el resultado, para que ningún TDJ
  // diligenciado desaparezca del Excel por un recálculo pendiente.
  push(["TÍTULOS / TDJ — TÍTULOS REGISTRADOS"],{title:true});
  push(["Nº","TDJ","FECHA","VALOR","TIPO","TASA","OBSERVACIÓN"],{header:true});
  [...titulos].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||Number(a.numero||0)-Number(b.numero||0)).forEach((t,i)=>{
    const tasa=tasaParaPagoTDJ(t);
    push([i+1,t.tdj||"",t.fecha||"",truncarValorEntero(t.valor||0),upper(t.tipo||"TASA DIAN"),tasa==null?"":Number(tasa)*100,upper(t.observacion||"")],{money:[4],percent:[6]});
  });
  push([]);
  push(["TÍTULOS / TDJ — CONTROL FINAL"],{title:true});push(["Nº","TDJ","FECHA","VALOR ORIGINAL","TIPO","TASA","OBSERVACIÓN","APLICADO","SOBRANTE / ENDOSO"],{header:true});
  resultado.resumenTitulos.forEach((x,i)=>push([i+1,x.titulo.tdj||`TDJ ${i+1}`,x.titulo.fecha,x.titulo.valor||0,upper(x.titulo.tipo||"TASA DIAN"),tasaParaPagoTDJ(x.titulo)==null?"":Number(tasaParaPagoTDJ(x.titulo))*100,upper(x.titulo.observacion||""),x.trazabilidad.reduce((a,z)=>a+Number(z.aplicado||0),0),x.excedente||0],{money:[4,8,9],percent:[6]}));push([]);push(["TOTAL ENDOSO",resultado.endoso||0],{money:[2]});
  return {rows,titleRows,headerRows,rowMoneyCols,rowPercentCols,nit};
}
function exportarExcelTDJ(){
  try{
    sincronizarPagosVisiblesTDJ();
    sincronizarTitulosVisiblesTDJ();
    // Si el usuario agregó/modificó pagos o TDJ después del último cálculo,
    // el Excel debe representar el estado actual. Recalculamos antes de
    // exportar, sin borrar la captura ni ocultar el resultado.
    if(resultadoDesactualizado || !resultado){
      aplicarTitulos();
      if(resultadoDesactualizado || !resultado)return;
    }
    // MISMO MECANISMO DE EXPORTACIÓN DEL LIQUIDADOR NORMAL:
    // libro XLSX real, una sola hoja y todas las secciones apiladas.
    const {rows,titleRows,headerRows,rowMoneyCols,rowPercentCols,nit}=construirFilasExcelTDJ();
    const fechaGeneracion=new Date().toISOString();
    const files=[
      {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`},
      {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
      {name:"docProps/core.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Liquidación de Títulos / TDJ DIAN</dc:title><dc:creator>Liquidador DIAN</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${fechaGeneracion}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${fechaGeneracion}</dcterms:modified></cp:coreProperties>`},
      {name:"docProps/app.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Liquidador DIAN</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Hojas</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Liquidación TDJ</vt:lpstr></vt:vector></TitlesOfParts></Properties>`},
      {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="30626"/><workbookPr defaultThemeVersion="164011"/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="18000" windowHeight="12000"/></bookViews><sheets><sheet name="Liquidación TDJ" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`},
      {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {name:"xl/styles.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="[$$-es-CO] #,##0"/><numFmt numFmtId="165" formatCode="0.000%"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="14"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="DCEAF4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="173F5F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="A8BBC9"/></left><right style="thin"><color rgb="A8BBC9"/></right><top style="thin"><color rgb="A8BBC9"/></top><bottom style="thin"><color rgb="A8BBC9"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="3" borderId="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`},
      {name:"xl/worksheets/sheet1.xml",data:xlsxSheetTDJ(rows,{titleRows,headerRows,rowMoneyCols,rowPercentCols,columnWidths:[14,24,30,18,18,14,16,18,20,20,24,20,20,20],landscape:true,fitToWidth:1,fitToHeight:0})}
    ];
    const blob=zipStoreTDJ(files);
    if(!blob||blob.size<5000)throw new Error("Excel no generó un libro XLSX válido.");
    descargarTDJ(blob,`Liquidacion_TDJ_${nit||"SIN_NIT"}_${new Date().toISOString().slice(0,10)}.xlsx`);
    const estado=$("estadoExportacionTDJ");if(estado){estado.hidden=false;estado.textContent="EXCEL GENERADO CORRECTAMENTE: UNA SOLA HOJA CON LIQUIDACIÓN NORMAL, PAGOS, INTERESES, ACTUALIZACIÓN DE SANCIÓN, IMPUTACIÓN TDJ, SALDOS Y ENDOSO.";}
  }catch(e){console.error("EXPORTACIÓN EXCEL TDJ",e);alert(`No fue posible exportar el Excel TDJ. ${e.message||"Error desconocido"}`);}
}

function escPdf(v){return esc(v??"");}
function tablaInteresesTDJ(detalle,pagoFecha){
  const filas=(detalle?.interesesPorCuota||[]).filter(t=>Number(t.capitalBase||0)>0||Number(t.interes||0)>0);
  if(!filas.length)return "";
  const rows=filas.map(t=>`<tr><td>${escPdf(t.cuota??"")}</td><td>${dinero(t.capitalBase||0)}</td><td>${escPdf(fechaVisible(t.fechaVencimiento||""))}</td><td>${escPdf(fechaVisible(t.fechaPago||pagoFecha||""))}</td><td>${Number(t.dias||0)}</td><td>${t.tasa==null?"—":(Number(t.tasa)*100).toFixed(3)+"%"}</td><td>${dinero(t.interes||0)}</td></tr>`).join("");
  const total=filas.reduce((a,t)=>a+Number(t.interes||0),0);
  return `<section class="pdf-intereses"><h3>CÁLCULO DE INTERESES POR CUOTA</h3><table><thead><tr><th>CUOTA</th><th>CAPITAL BASE</th><th>FECHA VENCIMIENTO</th><th>FECHA PAGO / TDJ</th><th>DÍAS</th><th>TASA</th><th>INTERÉS</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="6">TOTAL INTERESES</th><th>${dinero(total)}</th></tr></tfoot></table></section>`;
}
function bloqueActualizacionSancionTDJ(detalle,etiqueta){
  const tramos=detalle?.actualizacionSancion?.tramos||[];
  if(!tramos.length)return "";
  const rows=tramos.map(t=>`<tr><td>${escPdf(t.anio)}</td><td>${escPdf(fechaVisible(t.desde))}</td><td>${escPdf(t.anioInflacion||Number(t.anio||0)-1)}</td><td>${dinero(t.saldoAntes||0)}</td><td>${Number(t.ipcPorcentaje||0).toFixed(3)}%</td><td>${dinero(t.actualizacion||0)}</td><td>${dinero(t.saldoDespues||0)}</td></tr>`).join("");
  const total=tramos.reduce((a,t)=>a+Number(t.actualizacion||0),0);
  return `<section class="pdf-actualizacion-sancion"><h3>ACTUALIZACIÓN DE SANCIÓN — ${escPdf(etiqueta)}</h3><div class="pdf-descripcion">Se conserva la misma lógica normativa de actualización de sanción del liquidador normal: se muestra el año de actualización, IPC, valor anterior, actualización y saldo posterior.</div><table><thead><tr><th>AÑO</th><th>FECHA APLICACIÓN</th><th>AÑO IPC</th><th>VALOR ANTERIOR</th><th>IPC</th><th>ACTUALIZACIÓN</th><th>VALOR DESPUÉS</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="5">TOTAL ACTUALIZACIÓN</th><th>${dinero(total)}</th><th></th></tr></tfoot></table></section>`;
}
function bloqueDetallePagoTDJ(detalle,i,o,modo="PAGO REGISTRADO"){
  if(!detalle)return "";
  const p=detalle.pago||{};
  const id=String(p.recibo||"").trim()?`RECIBO: ${p.recibo}`:(p.tdj?`TDJ: ${p.tdj}`:`PAGO ${i+1}`);
  const vtos=(detalle.aplicacionesVto||[]).filter(a=>Number(a.aplicado||0)>0||Number(a.aplicadoIntereses||0)>0||Number(a.aplicadoSancion||0)>0).map(a=>{const v=o.vencimientos.find(z=>z.id===a.id);return {fecha:v?.fecha||"",aplicado:a.aplicado||0,intereses:a.aplicadoIntereses||0,sancion:a.aplicadoSancion||0,saldo:a.saldo||0};});
  const rows=vtos.length?vtos.map(v=>`<tr><td>${escPdf(fechaVisible(v.fecha))}</td><td>${dinero(v.aplicado)}</td><td>${dinero(v.intereses)}</td><td>${dinero(v.sancion)}</td><td>${dinero(v.saldo)}</td></tr>`).join(""):"<tr><td colspan='5'>SIN IMPUTACIÓN POR VENCIMIENTO.</td></tr>";
  const deudaTotal=Number(detalle.deudaAntes?.impuesto||0)+Number(detalle.deudaAntes?.intereses||0)+Number(detalle.deudaAntes?.sancion||0);
  return `<article class="pdf-pago-completo"><div class="pdf-pago-titulo">${escPdf(modo)} — ${escPdf(id)}</div><div class="pdf-datos"><div class="pdf-dato"><b>FECHA</b><strong>${escPdf(fechaVisible(p.fecha))}</strong></div><div class="pdf-dato"><b>VALOR</b><strong>${dinero(p.valor||0)}</strong></div><div class="pdf-dato"><b>TIPO / BENEFICIO</b><strong>${escPdf(detalle.tipoAplicado||p.tipo||"TASA DIAN")}</strong></div><div class="pdf-dato"><b>TASA</b><strong>${detalle.tasaVisible==null?"—":Number(detalle.tasaVisible).toFixed(3)+"%"}</strong></div></div>${tablaInteresesTDJ(detalle,p.fecha)}${bloqueActualizacionSancionTDJ(detalle,modo)}<table class="pdf-tabla"><thead><tr><th>CONCEPTO</th><th>DEUDA</th><th>APLICADO</th><th>SALDO</th></tr></thead><tbody><tr><td>IMPUESTO</td><td>${dinero(detalle.deudaAntes?.impuesto)}</td><td>${dinero(detalle.aplicado?.impuesto)}</td><td>${dinero(detalle.saldo?.impuesto)}</td></tr><tr><td>INTERESES</td><td>${dinero(detalle.deudaAntes?.intereses)}</td><td>${dinero(detalle.aplicado?.intereses)}</td><td>${dinero(detalle.saldo?.intereses)}</td></tr><tr><td>SANCIÓN</td><td>${dinero(detalle.deudaAntes?.sancion)}</td><td>${dinero(detalle.aplicado?.sancion)}</td><td>${dinero(detalle.saldo?.sancion)}</td></tr><tr class="total"><td>TOTALES</td><td>${dinero(deudaTotal)}</td><td>${dinero(detalle.aplicado?.total)}</td><td>${dinero(detalle.saldo?.total)}</td></tr></tbody></table><section class="pdf-aplicaciones"><h3>APLICACIÓN POR VENCIMIENTO</h3><table><thead><tr><th>VENCIMIENTO</th><th>IMPUESTO APLICADO</th><th>INTERESES APLICADOS</th><th>SANCIÓN APLICADA</th><th>SALDO</th></tr></thead><tbody>${rows}</tbody></table></section>${Number(detalle.excedente||detalle.aplicado?.excedente||0)>0?`<div class="pdf-excedente"><b>EXCEDENTE:</b> ${dinero(detalle.excedente??detalle.aplicado?.excedente)}</div>`:""}</article>`;
}
async function exportarPdfTDJ(){
  try{
    sincronizarPagosVisiblesTDJ();
    sincronizarTitulosVisiblesTDJ();
    // Igual que Excel: si hubo cambios después del último cálculo, el PDF
    // debe salir con el cálculo actualizado y con todos los pagos/TDJ actuales.
    if(resultadoDesactualizado || !resultado){
      aplicarTitulos();
      if(resultadoDesactualizado || !resultado)return;
    }
    const totalTitulos=titulos.reduce((a,t)=>a+Number(t.valor||0),0);
    const totalAplicado=resultado.resumenTitulos.reduce((a,x)=>a+x.trazabilidad.reduce((z,y)=>z+Number(y.aplicado||0),0),0);
    const totalSaldo=resultado.resumenObligaciones.reduce((a,x)=>a+Number(x.saldo||0),0);
    const paginas=[];

    // PÁGINA INICIAL: conserva el resumen general del soporte TDJ.
    paginas.push(`<section class="pdf-hoja"><article class="pdf-liquidacion"><div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">LIQUIDACIÓN DE TÍTULOS / TDJ — SOPORTE COMPLETO</div><div class="pdf-generado">Generado: ${fechaVisible(hoyISO())}</div></div><div class="pdf-datos"><div class="pdf-dato"><b>NIT</b><strong>${escPdf($("nitGlobal")?.value||"")}</strong></div><div class="pdf-dato"><b>D.V.</b><strong>${escPdf(calcularDvNITTDJ($("nitGlobal")?.value||""))}</strong></div><div class="pdf-dato ancho-2"><b>RAZÓN SOCIAL</b><strong>${escPdf(upper($("razonGlobal")?.value||""))}</strong></div><div class="pdf-dato"><b>TIPO</b><strong>PRIVADA</strong></div></div><div class="pdf-resumen-grid"><div><b>TOTAL TÍTULOS</b><strong>${dinero(totalTitulos)}</strong></div><div><b>TOTAL APLICADO</b><strong>${dinero(totalAplicado)}</strong></div><div><b>SALDO OBLIGACIONES</b><strong>${dinero(totalSaldo)}</strong></div><div><b>ENDOSO</b><strong>${dinero(resultado.endoso)}</strong></div></div><section class="pdf-bloque"><h2>SECUENCIA DE APLICACIÓN</h2><table><thead><tr><th>TDJ</th><th>FECHA</th><th>OBLIGACIÓN</th><th>DISPONIBLE</th><th>APLICADO</th><th>SALDO TDJ</th></tr></thead><tbody>${resultado.resumenTitulos.flatMap(x=>x.trazabilidad.length?x.trazabilidad.map(a=>`<tr><td>${escPdf(a.titulo)}</td><td>${escPdf(fechaVisible(a.fecha))}</td><td>${escPdf(a.obligacion)}</td><td>${dinero(a.valorAntes)}</td><td>${dinero(a.aplicado)}</td><td>${dinero(a.saldoTitulo)}</td></tr>`):[`<tr><td>${escPdf(x.titulo.tdj||`TDJ ${x.titulo.numero}`)}</td><td>${escPdf(fechaVisible(x.titulo.fecha))}</td><td>ENDOSO</td><td>${dinero(x.titulo.valor)}</td><td>${dinero(0)}</td><td>${dinero(x.excedente)}</td></tr>`]).join("")}</tbody></table></section></article></section>`);

    resultado.resumenObligaciones.forEach((x,idx)=>{
      const o=x.obligacion,base=x.liquidacionBase||{};
      // Hoja de obligación: igual al soporte anterior, con vencimientos y
      // resumen de pagos; el detalle completo de CADA pago va inmediatamente
      // después, una hoja por pago, para no recortar información.
      paginas.push(`<section class="pdf-hoja"><article class="pdf-liquidacion"><div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">OBLIGACIÓN ${idx+1} — LIQUIDACIÓN COMPLETA</div><div class="pdf-generado">Generado: ${fechaVisible(hoyISO())}</div></div><div class="pdf-datos"><div class="pdf-dato"><b>OBLIGACIÓN</b><strong>${idx+1}</strong></div><div class="pdf-dato"><b>CONCEPTO</b><strong>${escPdf(upper(o.concepto))}</strong></div><div class="pdf-dato"><b>AÑO GRAVABLE</b><strong>${escPdf(o.anio)}</strong></div><div class="pdf-dato"><b>PERÍODO</b><strong>${escPdf(o.periodo||"")}</strong></div><div class="pdf-dato"><b>NIT</b><strong>${escPdf($("nitGlobal")?.value||"")}</strong></div><div class="pdf-dato ancho-2"><b>RAZÓN SOCIAL</b><strong>${escPdf(upper($("razonGlobal")?.value||""))}</strong></div><div class="pdf-dato"><b>SANCIÓN</b><strong>${escPdf(o.tieneSancion||"NO")}</strong></div><div class="pdf-dato"><b>VALOR SANCIÓN</b><strong>${dinero(o.valorSancion||0)}</strong></div><div class="pdf-dato"><b>BENEFICIO</b><strong>${escPdf(o.beneficioSancion||"SIN BENEFICIO")}</strong></div></div><section class="pdf-bloque"><h2>VENCIMIENTOS / IMPUESTO DECLARADO</h2><table><thead><tr><th>Nº</th><th>PERÍODO</th><th>FECHA VENCIMIENTO</th><th>IMPUESTO DECLARADO</th><th>SALDO FINAL BASE</th></tr></thead><tbody>${(base.vencimientos||o.vencimientos||[]).map((v,i)=>`<tr><td>${i+1}</td><td>${escPdf(v.periodo||i+1)}</td><td>${escPdf(fechaVisible(v.fecha))}</td><td>${dinero(v.impuesto||0)}</td><td>${dinero(v.saldo||0)}</td></tr>`).join("")}</tbody></table></section><section class="pdf-bloque"><h2>PAGOS REGISTRADOS — LIQUIDACIÓN NORMAL</h2>${(base.detalle||[]).length?`<table><thead><tr><th>Nº</th><th>IDENTIFICADOR</th><th>FECHA</th><th>VALOR</th><th>TIPO</th><th>APLICADO</th></tr></thead><tbody>${base.detalle.map((d,i)=>{const pp=d.pago||{};const idp=String(pp.recibo||"").trim()?`RECIBO: ${pp.recibo}`:(pp.tdj?`TDJ: ${pp.tdj}`:`PAGO ${i+1}`);return `<tr><td>${i+1}</td><td>${escPdf(idp)}</td><td>${escPdf(fechaVisible(pp.fecha||""))}</td><td>${dinero(pp.valor||0)}</td><td>${escPdf(d.tipoAplicado||pp.tipo||"TASA DIAN")}</td><td>${dinero(d.aplicado?.total||0)}</td></tr>`;}).join("")}</tbody></table>`:`<div class="pdf-nota">NO HAY PAGOS REGISTRADOS PARA ESTA OBLIGACIÓN.</div>`}</section><section class="pdf-resumen-final"><h2>RESULTADO DE LA LIQUIDACIÓN NORMAL</h2><div class="pdf-resumen-grid"><div><b>SALDO IMPUESTO</b><strong>${dinero(base.impuesto||0)}</strong></div><div><b>SALDO INTERESES</b><strong>${dinero(base.intereses||0)}</strong></div><div><b>SALDO SANCIÓN</b><strong>${dinero(base.sancion||0)}</strong></div><div><b>SALDO TOTAL</b><strong>${dinero(base.total||0)}</strong></div></div></section></article></section>`);

      // DETALLE COMPLETO DE CADA PAGO NORMAL — UNA HOJA POR PAGO.
      (base.detalle||[]).forEach((d,j)=>{
        paginas.push(`<section class="pdf-hoja"><article class="pdf-liquidacion"><div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">OBLIGACIÓN ${idx+1} — DETALLE DEL PAGO</div><div class="pdf-generado">Generado: ${fechaVisible(hoyISO())}</div></div><div class="pdf-datos"><div class="pdf-dato"><b>OBLIGACIÓN</b><strong>${idx+1}</strong></div><div class="pdf-dato"><b>CONCEPTO</b><strong>${escPdf(upper(o.concepto))}</strong></div><div class="pdf-dato"><b>AÑO</b><strong>${escPdf(o.anio)}</strong></div><div class="pdf-dato"><b>PERÍODO</b><strong>${escPdf(o.periodo||"")}</strong></div></div>${bloqueDetallePagoTDJ(d,j,o,"PAGO REGISTRADO")}</article></section>`);
      });

      // DETALLE COMPLETO DE CADA TDJ — UNA HOJA POR IMPUTACIÓN.
      const aplicacionesTDJ=Array.isArray(x.aplicaciones)?x.aplicaciones:[];
      aplicacionesTDJ.forEach((a,j)=>{
        const d=a.detalleAplicacion||a.detalleMotor?.detalle?.at(-1);
        if(!d)return;
        paginas.push(`<section class="pdf-hoja"><article class="pdf-liquidacion"><div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">OBLIGACIÓN ${idx+1} — APLICACIÓN DE TÍTULO / TDJ</div><div class="pdf-generado">Generado: ${fechaVisible(hoyISO())}</div></div><div class="pdf-datos"><div class="pdf-dato"><b>TDJ</b><strong>${escPdf(a.titulo)}</strong></div><div class="pdf-dato"><b>FECHA TDJ</b><strong>${escPdf(fechaVisible(a.fecha))}</strong></div><div class="pdf-dato"><b>VALOR DISPONIBLE</b><strong>${dinero(a.valorAntes)}</strong></div><div class="pdf-dato"><b>OBLIGACIÓN</b><strong>${idx+1}</strong></div><div class="pdf-dato ancho-2"><b>CONCEPTO</b><strong>${escPdf(upper(o.concepto))}</strong></div><div class="pdf-dato"><b>AÑO</b><strong>${escPdf(o.anio)}</strong></div><div class="pdf-dato"><b>PERÍODO</b><strong>${escPdf(o.periodo||"")}</strong></div></div>${bloqueDetallePagoTDJ(d,j,o,"APLICACIÓN DEL TDJ")}</article></section>`);
      });
    });

    const endRows=resultado.resumenTitulos.filter(x=>Number(x.excedente||0)>0).map(x=>`<tr><td>${escPdf(x.titulo.tdj||`TDJ ${x.titulo.numero}`)}</td><td>${escPdf(fechaVisible(x.titulo.fecha))}</td><td>${dinero(x.titulo.valor)}</td><td>${dinero(x.excedente)}</td><td>ENDOSO</td></tr>`).join("")||`<tr><td colspan="5">NO HAY TÍTULOS SOBRANTES.</td></tr>`;
    paginas.push(`<section class="pdf-hoja"><article class="pdf-liquidacion"><div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">RESUMEN FINAL — TÍTULOS Y ENDOSO</div><div class="pdf-generado">Generado: ${fechaVisible(hoyISO())}</div></div><div class="pdf-resumen-grid"><div><b>TOTAL TÍTULOS</b><strong>${dinero(totalTitulos)}</strong></div><div><b>TOTAL APLICADO</b><strong>${dinero(totalAplicado)}</strong></div><div><b>SALDO FINAL OBLIGACIONES</b><strong>${dinero(totalSaldo)}</strong></div><div><b>TOTAL ENDOSO</b><strong>${dinero(resultado.endoso)}</strong></div></div><section class="pdf-bloque"><h2>TÍTULOS SOBRANTES PARA ENDOSO</h2><table><thead><tr><th>TDJ</th><th>FECHA</th><th>VALOR ORIGINAL</th><th>SOBRANTE</th><th>DESTINO</th></tr></thead><tbody>${endRows}</tbody><tfoot><tr><th colspan="3">TOTAL ENDOSO</th><th>${dinero(resultado.endoso)}</th><th>ENDOSO</th></tr></tfoot></table></section><div class="pdf-nota">Nota: la liquidación TDJ conserva la misma estructura de cálculo de obligaciones, pagos, intereses, sanciones y actualización; el título/TDJ se incorpora como pago adicional en la secuencia de imputación.</div></article></section>`);

    const css=`  @page{size:A4 portrait;margin:22mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:#17324d;font-family:Arial,Helvetica,sans-serif}
  body{font-size:11pt}
  .pdf-soporte{width:100%;padding:0;margin:0}
  .pdf-hoja{width:100%;height:253mm;min-height:253mm;page-break-after:always;break-after:page;overflow:hidden}
  .pdf-hoja:last-child{page-break-after:auto;break-after:auto}
  .pdf-pagina{width:100%;height:100%;display:block}
  .pdf-liquidacion{width:100%;height:100%;min-height:0;overflow:hidden;border:1px solid #8aa0b2;background:#fff;break-inside:avoid;page-break-inside:avoid}
  .pdf-marca{display:grid;grid-template-columns:18mm 1fr 30mm;align-items:center;border-bottom:1px solid #7f9aae;background:#f5f8fa;height:10mm}
  .pdf-logo{font-weight:700;color:#007f9e;font-size:11pt;text-align:center;padding:1mm;border-right:1px solid #9aadb9}
  .pdf-titulo{text-align:center;font-weight:700;font-size:11pt;letter-spacing:.1px;padding:1mm}
  .pdf-generado{text-align:right;font-size:8pt;padding:1mm 1.5mm}
  .pdf-datos{display:grid;grid-template-columns:1fr 1.1fr .8fr 1fr .55fr;border-bottom:1px solid #9aadb9}
  .pdf-dato{padding:1.5mm 1.5mm;border-right:1px solid #9aadb9;border-bottom:1px solid #d1dbe1;min-height:8mm}
  .pdf-dato b{display:block;font-size:8pt;color:#4b6578;margin-bottom:.5mm}
  .pdf-dato strong{font-size:11pt}
  .pdf-dato.ancho-2{grid-column:span 2}
  .pdf-bloque{margin:2.5mm;border:1px solid #8da6b7;break-inside:avoid;page-break-inside:avoid;border-radius:.5mm;overflow:hidden}
  .pdf-bloque h2{margin:0;padding:2mm;background:#dceaf4;color:#17324d;font-size:10pt;border-bottom:1px solid #8da6b7;letter-spacing:.1px}
  .pdf-bloque table,.pdf-tabla,.pdf-aplicaciones table,.pdf-intereses table,.pdf-actualizacion-sancion table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-bloque th,.pdf-bloque td,.pdf-tabla th,.pdf-tabla td,.pdf-aplicaciones th,.pdf-aplicaciones td,.pdf-intereses th,.pdf-intereses td,.pdf-actualizacion-sancion th,.pdf-actualizacion-sancion td{border:1px solid #b4c4cf;padding:1.35mm;font-size:8.2pt;line-height:1.05}
  .pdf-bloque th,.pdf-tabla th,.pdf-aplicaciones th,.pdf-intereses th,.pdf-actualizacion-sancion th{background:#e9eff3;color:#17324d;font-size:7.7pt;font-weight:800}
  .pdf-pago-completo{margin:2mm;border:1px solid #78a2bc;break-inside:avoid;page-break-inside:avoid}
  .pdf-pago-titulo{font-weight:800;text-align:center;font-size:10pt;padding:1.7mm;background:#e8f1f6;border-bottom:1px solid #78a2bc;color:#17324d}
  .pdf-pago-completo .pdf-datos{grid-template-columns:repeat(4,1fr);border-bottom:0}
  .pdf-pago-completo .pdf-dato{min-height:7.5mm}
  .pdf-intereses,.pdf-actualizacion-sancion,.pdf-aplicaciones{margin:1.6mm 2mm;border:1px solid #8da6b7;break-inside:avoid;page-break-inside:avoid;overflow:hidden}
  .pdf-intereses h3,.pdf-actualizacion-sancion h3,.pdf-aplicaciones h3{margin:0;padding:1.45mm;background:#dceaf4;color:#17324d;font-size:9pt;font-weight:800;border-bottom:1px solid #8da6b7}
  .pdf-intereses th,.pdf-intereses td,.pdf-actualizacion-sancion th,.pdf-actualizacion-sancion td{font-size:7.2pt}
  .pdf-tabla{margin:1.6mm 2mm;width:calc(100% - 4mm)}
  .pdf-tabla th:first-child,.pdf-tabla td:first-child,.pdf-aplicaciones th:first-child,.pdf-aplicaciones td:first-child{text-align:left}
  .pdf-tabla td:not(:first-child),.pdf-tabla th:not(:first-child),.pdf-aplicaciones td:not(:first-child),.pdf-aplicaciones th:not(:first-child),.pdf-intereses td,.pdf-intereses th,.pdf-actualizacion-sancion td,.pdf-actualizacion-sancion th{text-align:right}
  .pdf-tabla .total td{font-weight:800;background:#e8f1f6}
  .pdf-excedente{margin:1.6mm 2mm;padding:1.6mm;border:1px solid #c58a1a;background:#fff6d8;color:#7a5200;font-weight:800}
  .pdf-aplicaciones{margin:1.5mm 2mm;border:1px solid #9db1bf}
  .pdf-aplicaciones h3{font-size:9.5pt;margin:0;padding:1.25mm;background:#edf3f6}
  .pdf-aplicaciones table{width:100%;border-collapse:collapse}
  .pdf-aplicaciones th,.pdf-aplicaciones td{border:1px solid #b7c4cc;padding:1.1mm;font-size:8.5pt;line-height:1.05}
  .pdf-nota{text-align:center;font-weight:700;padding:1mm;font-size:8pt}
  .pdf-resumen-final{overflow:hidden}
  .pdf-resumen-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin:3mm 2mm}
  .pdf-resumen-grid>div{border:1px solid #8da6b7;padding:3mm;text-align:center;background:#eef5f9}
  .pdf-resumen-grid b{display:block;font-size:8pt;margin-bottom:1mm}
  .pdf-resumen-grid strong{font-size:13pt}
  @media print{html,body{width:210mm;background:#fff!important}.pdf-soporte{display:block!important;width:100%!important}.pdf-hoja{display:block!important;width:100%!important;height:246.2mm!important;min-height:246.2mm!important;page-break-after:always!important;break-after:page!important}.pdf-hoja:last-child{page-break-after:auto!important;break-after:auto!important}.pdf-pagina{display:block!important;width:100%!important;height:100%!important}.pdf-liquidacion{display:block!important;visibility:visible!important;width:100%!important;height:100%!important}}
`;
    const win=window.open("","_blank","width=1200,height=1000");
    if(!win)throw new Error("El navegador bloqueó la ventana del soporte PDF. Permita ventanas emergentes para este formulario.");
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Soporte Liquidación TDJ / Títulos</title><style>${css}</style></head><body><main class="pdf-soporte">${paginas.join("")}</main></body></html>`);
    win.document.close();
    const imprimir=()=>setTimeout(()=>{try{win.focus();win.print();}catch(e){console.error(e);}},700);
    if(win.document.readyState==="complete")imprimir();else win.addEventListener("load",imprimir,{once:true});
    const estado=$("estadoExportacionTDJ");
    if(estado){estado.hidden=false;estado.textContent="SOPORTE PDF PREPARADO: SE MUESTRA LA LIQUIDACIÓN TDJ EN PANTALLA Y SE ABRE LA OPCIÓN DE IMPRESIÓN. SI CANCELA, EL SOPORTE PERMANECE VISIBLE.";}
  }catch(e){console.error("EXPORTACIÓN PDF TDJ",e);alert(`No fue posible preparar el soporte PDF TDJ. ${e.message||"Error desconocido"}`);}
}
function renderPanelesTasasIPC(){
  const tbodyT=$("tablaTasasTDJ")?.querySelector("tbody");
  const tbodyI=$("tablaIPCTDJ")?.querySelector("tbody");
  if(tbodyT){
    const filas=[...tasas].sort((a,b)=>String(a.desde||"").localeCompare(String(b.desde||"")));
    tbodyT.innerHTML=filas.map(t=>{
      const tasa=normalizarTasaTDJ(t?.tasas?.["TASA DIAN"]);
      return `<tr><td>${esc(fechaVisible(t.desde||""))}</td><td>${esc(fechaVisible(t.hasta||""))}</td><td>${tasa==null?"SIN DATOS":(tasa*100).toFixed(3)+"%"}</td><td>${esc(t.fuente||"LOCAL")}</td><td>${esc(t.norma||"—")}</td></tr>`;
    }).join("") || `<tr><td colspan="5">NO HAY TASAS DISPONIBLES.</td></tr>`;
  }
  if(tbodyI){
    const filas=[...ipc].sort((a,b)=>Number(a.anioInflacion ?? a.anio_inflacion ?? 0)-Number(b.anioInflacion ?? b.anio_inflacion ?? 0));
    tbodyI.innerHTML=filas.map(x=>{
      const y=Number(x.anioInflacion??x.anio_inflacion);
      const v=Number(x.inflacion);
      return `<tr><td>${Number.isFinite(y)?y:""}</td><td>${Number.isFinite(v)?(v*100).toFixed(3)+"%":"SIN DATOS"}</td><td>${esc(fechaVisible(x.aplicableDesde||x.aplicable_desde||""))}</td><td>${esc(x.fuente||x.fuente_url||"LOCAL")}</td></tr>`;
    }).join("") || `<tr><td colspan="4">NO HAY IPC DISPONIBLE.</td></tr>`;
  }
  const st=$("estadoTasasConexionTDJ"); if(st) st.textContent=`Disponible · ${tasas.length} registros`;
  const si=$("estadoIPCConexionTDJ"); if(si) si.textContent=`Disponible · ${ipc.length} registros`;
}

function exportarJSON(){if(!resultado)return alert("Primero realice la aplicación.");const data={version:"16.33.00-TDJ",nit:$("nitGlobal").value,razonSocial:upper($("razonGlobal").value),obligaciones,titulos,resultado};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});descargar(blob,`liquidacion_tdj_${$("nitGlobal").value||"expediente"}.json`);}
function descargar(blob,nombre){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nombre;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}


function filasEntre(rows,a,b){return rows.slice(a+1,b<0?rows.length:b)}
function idxFila(rows,fn,desde=0){for(let i=desde;i<rows.length;i++){if(fn(rows[i]))return i}return -1}
function esTituloObligacionExcel(r){return /^OBLIGACION\s+\d+\s+—\s+LIQUIDACION NORMAL/.test(normExcel(r?.filter(Boolean).join(" ")))}
function fechaCampoTDJImport(v){return fechaExcel(v)||""}

function obtenerMetaExcelRobusta(rows){
  const meta={};
  const claves=new Set([
    "NIT","RAZON SOCIAL","DV","ANO GRAVABLE","CONCEPTO","PERIODO",
    "TIPO DE LIQUIDACION","FECHA DE PRESENTACION","FECHA AUTO ADMISORIO",
    "FECHA PROVIDENCIA DEFINITIVA","FECHA VENCIMIENTO PARA DECLARAR",
    "TIENE SANCION","VALOR SANCION","FECHA SANCION","BENEFICIO SANCION",
    "BENEFICIO TRIBUTARIO"
  ]);
  for(const r of rows){
    const cells=Array.isArray(r)?r:[];
    for(let i=0;i<cells.length;i++){
      const k=normExcel(cells[i]);
      if(!k||!claves.has(k))continue;
      let v="";
      for(let j=i+1;j<cells.length;j++){
        if(String(cells[j]??"").trim()!==""){v=cells[j];break;}
      }
      if(v!=="" && v!=null){if(!(k in meta)||meta[k]==="")meta[k]=v;}
      else if(!(k in meta))meta[k]="";
    }
  }
  return meta;
}

function buscarCabeceraVencimientos(rows,desde=0){
  for(let i=desde;i<rows.length;i++){
    const r=rows[i]||[];
    const n=r.map(x=>normExcel(x));
    const tieneNumero=n.includes("Nº")||n.includes("NO")||n.includes("N");
    const tienePeriodo=n.includes("PERIODO")||n.includes("PERIODO / CUOTA");
    const tieneFecha=n.includes("FECHA VENCIMIENTO");
    const tieneImpuesto=n.includes("IMPUESTO DECLARADO")||n.includes("IMPORTE / IMPUESTO");
    if(tieneNumero&&tienePeriodo&&tieneFecha&&tieneImpuesto)return i;
  }
  return -1;
}

function leerVencimientosExcel(rows,headerIdx){
  if(headerIdx<0)return [];
  const h=rows[headerIdx]||[], nh=h.map(x=>normExcel(x));
  const idxNum=nh.findIndex(x=>x==="Nº"||x==="NO"||x==="N");
  const idxPeriodo=nh.findIndex(x=>x==="PERIODO"||x==="PERIODO / CUOTA");
  const idxFecha=nh.findIndex(x=>x==="FECHA VENCIMIENTO");
  const idxImpuesto=nh.findIndex(x=>x==="IMPUESTO DECLARADO"||x==="IMPORTE / IMPUESTO");
  if(idxFecha<0||idxImpuesto<0)return [];
  const out=[];
  const secciones=/^(PAGOS Y APLICACION|PAGOS REGISTRADOS|DETALLE DE INTERESES|ACTUALIZACION DE SANCION|RESUMEN FINAL|RESUMEN GENERAL|TITULOS \/ TDJ|TITULOS \/ TDJ — CONTROL FINAL|OBSERVACION)/;
  for(let i=headerIdx+1;i<rows.length;i++){
    const r=rows[i]||[];
    const nonEmpty=r.filter(x=>String(x??"").trim()!=="");
    const s=normExcel(nonEmpty.join(" | "));
    if(secciones.test(s))break;
    const f=fechaCampoTDJImport(idxFecha>=0?r[idxFecha]:"");
    const imp=truncarValorEntero(numExcel(idxImpuesto>=0?r[idxImpuesto]:""));
    if(f&&imp>0){
      const n=idxNum>=0?Number(r[idxNum]):NaN;
      const per=idxPeriodo>=0?r[idxPeriodo]:(out.length+1);
      out.push({id:uid("VTO"),numero:Number.isFinite(n)&&n>0?n:out.length+1,periodo:per??out.length+1,fecha:f,impuesto:imp});
    }
  }
  out.forEach((v,i)=>{v.numero=i+1;});
  return out;
}

async function importarExcelTDJ(){
  // IMPORTACIÓN CRUZADA: el Excel del Liquidador normal puede cargarse en TDJ.
  // Se reconstruye una sola obligación y los pagos normales; no se inventan títulos.
  // Si el archivo sí es TDJ, continúa el flujo existente más abajo.

  const input=document.createElement("input");input.type="file";input.accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  input.addEventListener("change",async()=>{const file=input.files?.[0];if(!file)return;try{
    const rows=await leerXlsxPrimeraHoja(file);const meta=obtenerMetaExcelRobusta(rows);
    // IMPORTACIÓN ROBUSTA: normExcel elimina tildes, por lo que las claves
    // quedan como RAZON SOCIAL, ANO GRAVABLE, PERIODO, TIPO DE LIQUIDACION,
    // TIENE SANCION, etc. Nunca se deben consultar con tildes literales.
    const getMeta=k=>meta[normExcel(k)]??"";
    const tituloLibro=normExcel(rows.find(r=>r.some(c=>normExcel(c).includes("LIQUIDADOR")))?.filter(Boolean).join(" ")||"");
    const esNormal=/LIQUIDADOR DE OBLIGACIONES DIAN/.test(tituloLibro)&&!/TITULOS\s*\/\s*TDJ/.test(tituloLibro);
    if(esNormal){
      if(!getMeta("NIT")&&!getMeta("RAZON SOCIAL"))throw new Error("El Excel normal no contiene NIT ni razón social reconocibles.");
      if(getMeta("NIT"))$("nitGlobal").value=String(getMeta("NIT")).replace(/\D/g,"");
      if(getMeta("RAZON SOCIAL"))$("razonGlobal").value=upper(getMeta("RAZON SOCIAL"));
      const o=nuevaObligacion(1);
      o.concepto=upper(getMeta("CONCEPTO")||"");o.anio=Number(getMeta("ANO GRAVABLE")||0)||"";o.periodo=getMeta("PERIODO")??"";/* EN TDJ LA APLICACION DE TITULOS ES SIEMPRE PRIVADA: se migra la informacion del Excel, pero se ignora cualquier indicador OFICIAL del archivo de origen. */o.tipoLiquidacion="PRIVADA";o.fechaAutoAdmisorio="";o.fechaProvidenciaDefinitiva="";o.tieneSancion=upper(getMeta("TIENE SANCION")||"NO").startsWith("SI")?"SI":"NO";o.valorSancion=truncarValorEntero(numExcel(getMeta("VALOR SANCION")));o.beneficioSancion=upper(getMeta("BENEFICIO SANCION")||"");o.fechaSancion=fechaCampoTDJImport(getMeta("FECHA SANCION")||getMeta("FECHA DE PRESENTACION"));o.beneficioTributario=upper(getMeta("BENEFICIO TRIBUTARIO")||"NINGUNO");
      const vh=buscarCabeceraVencimientos(rows,0);const arr=leerVencimientosExcel(rows,vh);if(arr.length)o.vencimientos=arr;
      const ph=idxFila(rows,r=>normExcel(r?.[0])==="Nº"&&normExcel(r?.[1])==="TDJ Nº"&&normExcel(r?.[2])==="RECIBO Nº"&&normExcel(r?.[3])==="FECHA PAGO / CORTE"&&normExcel(r?.[4])==="VALOR PAGO"&&normExcel(r?.[5])==="TIPO");
      if(ph>=0){const h=rows[ph]||[];const oi=h.findIndex(c=>normExcel(c)==="OBSERVACION");o.pagos=[];for(let i=ph+1;i<rows.length;i++){const r=rows[i],ss=normExcel(r.filter(Boolean).join(" | "));if(!ss)break;if(/^(DETALLE DE INTERESES|ACTUALIZACION DE SANCION|RESUMEN FINAL)/.test(ss))break;const f=fechaCampoTDJImport(r[3]),val=truncarValorEntero(numExcel(r[4]));if(f||val>0)o.pagos.push({id:uid("PAG"),numero:o.pagos.length+1,recibo:upper(r[2]||""),tdj:upper(r[1]||""),fecha:f,valor:val,tipo:upper(r[5]||"TASA DIAN"),observacion:upper(oi>=0?r[oi]:"")});}}
      obligaciones=[o];titulos=[nuevoTitulo(1)];resultado=null;$('resultadoTDJ').hidden=true;renderObligaciones();renderTitulos();actualizarSelectoresImportacion();
      alert(`Excel del Liquidador normal importado correctamente.\n\nObligaciones cargadas: 1\nVencimientos: ${o.vencimientos.length}\nPagos: ${o.pagos.length}\nTítulos / TDJ: 0\n\nLa liquidación NO se ejecutó. Revise los datos y luego pulse CALCULAR LIQUIDACIÓN.`);
      return;
    }
    if(!meta["NIT"]&&!meta["RAZON SOCIAL"])throw new Error("El archivo no parece ser un Excel exportado por el módulo de Títulos / TDJ ni por el Liquidador de Obligaciones DIAN.");
    const nuevas=[];let pos=0;const marcas=[];for(let i=0;i<rows.length;i++)if(esTituloObligacionExcel(rows[i]))marcas.push(i);
    const finTitulos=idxFila(rows,r=>/^TITULOS \/ TDJ — CONTROL FINAL/.test(normExcel(r?.filter(Boolean).join(" "))));
    for(let m=0;m<marcas.length;m++){
      const start=marcas[m],end=marcas[m+1]>=0?marcas[m+1]:(finTitulos>=0?finTitulos:rows.length),o=nuevaObligacion(nuevas.length+1),seg=rows.slice(start+1,end);
      const info=idxFila(seg,r=>normExcel(r?.[0])==="CONCEPTO");if(info>=0){const v=seg[info+1]||[];o.concepto=upper(v[0]||"");o.anio=Number(v[1]||0)||"";o.periodo=v[2]??"";o.tieneSancion=upper(v[3]||"NO")==="SI"?"SI":"NO";o.valorSancion=truncarValorEntero(numExcel(v[4]));o.beneficioSancion=upper(v[5]||"");o.fechaSancion=fechaCampoTDJImport(v[6]);o.beneficioTributario=upper(v[7]||"NINGUNO");}
      const vh=idxFila(seg,r=>normExcel(r?.[0])==="Nº"&&normExcel(r?.[2])==="FECHA VENCIMIENTO"&&normExcel(r?.[3])==="IMPUESTO DECLARADO");if(vh>=0){const arr=[];for(let i=vh+1;i<seg.length;i++){const r=seg[i],s=normExcel(r.filter(Boolean).join(" | "));if(!s)break;if(/^(PAGOS REGISTRADOS|IMPUTACION POR|DETALLE DE INTERESES|ACTUALIZACION DE SANCION)/.test(s))break;const f=fechaCampoTDJImport(r[2]),imp=truncarValorEntero(numExcel(r[3]));if(f&&imp>0)arr.push({id:uid("VTO"),numero:Number(r[0])||arr.length+1,periodo:r[1]??arr.length+1,fecha:f,impuesto:imp});}if(arr.length)o.vencimientos=arr;}
      const ph=idxFila(seg,r=>normExcel(r?.[0])==="Nº"&&normExcel(r?.[1])==="RECIBO"&&normExcel(r?.[2])==="FECHA"&&normExcel(r?.[3])==="VALOR"&&normExcel(r?.[4])==="TIPO");if(ph>=0){const phRow=seg[ph]||[];const obsIdx=phRow.findIndex(c=>normExcel(c)==="OBSERVACION");o.pagos=[];for(let i=ph+1;i<seg.length;i++){const r=seg[i],s=normExcel(r.filter(Boolean).join(" | "));if(!s)break;if(/^(IMPUTACION POR|DETALLE DE INTERESES|ACTUALIZACION DE SANCION)/.test(s))break;const f=fechaCampoTDJImport(r[2]),val=truncarValorEntero(numExcel(r[3]));if(f||val>0)o.pagos.push({id:uid("PAG"),numero:o.pagos.length+1,recibo:upper(r[1]||""),fecha:f,valor:val,tipo:upper(r[4]||"TASA DIAN"),observacion:upper(obsIdx>=0?r[obsIdx]:"")});}}
      nuevas.push(o);
    }
    const th=finTitulos;const nuevosTitulos=[];if(th>=0){const hh=idxFila(rows,r=>normExcel(r?.[0])==="Nº"&&normExcel(r?.[1])==="TDJ"&&normExcel(r?.[2])==="FECHA"&&normExcel(r?.[3])==="VALOR ORIGINAL"&&normExcel(r?.[4])==="TIPO",th);if(hh>=0){const hhRow=rows[hh]||[];const obsIdxTitulo=hhRow.findIndex(c=>normExcel(c)==="OBSERVACION");for(let i=hh+1;i<rows.length;i++){const r=rows[i],s=normExcel(r.filter(Boolean).join(" | "));if(!s)break;if(/^TOTAL ENDOSO/.test(s))break;const val=truncarValorEntero(numExcel(r[3])),f=fechaCampoTDJImport(r[2]);if((r[1]||f||val>0)&&f&&val>=0)nuevosTitulos.push({id:uid("TDJ"),numero:nuevosTitulos.length+1,tdj:upper(r[1]||""),fecha:f,valor:val,tipo:upper(r[4]||"TASA DIAN"),observacion:upper(obsIdxTitulo>=0?r[obsIdxTitulo]:"")});}}}
    if(!nuevas.length&&!nuevosTitulos.length)throw new Error("No se encontraron obligaciones, pagos, vencimientos o títulos reconocibles en el Excel.");
    if(meta["NIT"])$("nitGlobal").value=String(meta["NIT"]).replace(/\D/g,"");if(meta["RAZON SOCIAL"])$("razonGlobal").value=upper(meta["RAZON SOCIAL"]);
    obligaciones=nuevas.length?nuevas:[nuevaObligacion(1)];titulos=nuevosTitulos.length?nuevosTitulos:[nuevoTitulo(1)];resultado=null;$("resultadoTDJ").hidden=true;renderObligaciones();renderTitulos();actualizarSelectoresImportacion();
    alert(`Excel importado correctamente.\n\nObligaciones: ${nuevas.length}\nVencimientos: ${nuevas.reduce((a,o)=>a+o.vencimientos.length,0)}\nPagos: ${nuevas.reduce((a,o)=>a+o.pagos.length,0)}\nTítulos / TDJ: ${nuevosTitulos.length}\n\nLa liquidación NO se ejecutó. Revise los datos y luego pulse CALCULAR LIQUIDACIÓN.`);
  }catch(e){console.error("IMPORTACIÓN EXCEL TDJ",e);alert(`No fue posible importar el Excel TDJ. ${e.message||"Formato no reconocido."}`);}});input.click();
}

function limpiarTodo(){if(!confirm("¿Desea iniciar una nueva liquidación de títulos?"))return;$("nitGlobal").value="";$("razonGlobal").value="";obligaciones=[nuevaObligacion(1)];titulos=[nuevoTitulo(1)];resultado=null;$("resultadoTDJ").hidden=true;renderObligaciones();renderTitulos();window.scrollTo({top:0,behavior:"smooth"});}

function importarTitulos(){const text=$("importarTitulosTexto").value.trim();if(!text)return alert("Pegue primero los datos de los títulos.");try{const r=importarDatosInteligente(text);const pagosReconocidos=r.pagos||[];const tituladosExplicitos=pagosReconocidos.filter(p=>p.tdj||upper(p.tipo)==="TDJ");let encontrados=tituladosExplicitos.length?tituladosExplicitos:pagosReconocidos.filter(p=>p.fecha&&Number(p.valor)>0);
  // En el importador de TÍTULOS el contexto ya identifica la primera columna
  // numérica como TDJ cuando la fila contiene fecha + valor. Esto permite
  // estructuras abiertas como TDJ|FECHA|VALOR, FECHA|TDJ|VALOR o FECHA|VALOR.
  if(!encontrados.length){
    const lineas=text.replace(/\r/g,"").split("\n").filter(x=>x.trim());
    for(const linea of lineas){
      const c=linea.includes("\t")?linea.split("\t").map(x=>x.trim()):linea.split("|").map(x=>x.trim());
      if(c.length<2)continue;
      let fecha="",valor=null,tdj="",tipo="TASA DIAN",observacion="";
      for(const celda of c){
        const f=fechaISO(celda);if(f&&!fecha){fecha=f;continue;}
        const raw=String(celda).replace(/\s/g,"");
        const esSci=/^[+-]?\d+(?:[.,]\d+)?[eE][+-]?\d+$/.test(raw);
        const n=esSci?Number(raw.replace(",",".")):numeroDesdeTexto(celda);
        if(n>0 && raw.length>=5 && (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(celda)||esSci)){
          if(esSci){valor=truncarValorEntero(n);} else if(/[.,]/.test(raw)){valor=truncarValorEntero(n);} else if(valor===null&&tdj===""){tdj=raw.replace(/\D/g,"");}
        }
        const tt=TIPOS.find(x=>upper(x)===upper(celda));if(tt)tipo=tt;
        if(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(celda)&&!tt&&!/fecha|tdj|valor|titulo/i.test(celda))observacion=upper(celda);
      }
      if(fecha&&tdj&&valor>0)encontrados.push({tdj,fecha,valor,tipo,observacion});
    }
  }
  if(!encontrados.length)throw new Error("No se encontraron títulos/TDJ en la importación.");titulos=encontrados.map((p,i)=>({id:uid("TDJ"),numero:i+1,tdj:p.tdj||p.recibo||"",fecha:fechaISO(p.fecha)||"",valor:truncarValorEntero(p.valor),tipo:TIPOS.find(x=>upper(x)===upper(p.tipo))||"TASA DIAN",observacion:upper(p.observacion||""),_orden:Date.now()+i}));ordenarTitulosCronologicamente();renderTitulos();$("importarTitulosTexto").value="";$("resultadoImportacionTitulos").textContent=`Se reconocieron ${titulos.length} título(s)/TDJ.`;}catch(e){alert(e.message||"No fue posible reconocer los títulos.");}}

async function importarTitulosIA(){const text=$("importarTitulosTexto").value.trim();if(!text)return alert("Pegue primero los datos de los títulos.");try{setStatus("IA DIAN — VALIDANDO TÍTULOS...","loading");const base=importarDatosInteligente(text);const ai=await interpretarPagosConIA(text);const combinados=[...(base.pagos||[]),...(ai?.pagos||[])];const explicitos=combinados.filter(p=>String(p?.tdj||"").trim()||upper(p?.tipo||"")==="TDJ");const fuente=explicitos.length?explicitos:combinados;const mapa=new Map();for(const p of fuente){const es=String(p?.tdj||"").trim()||upper(p?.tipo||"")==="TDJ"|| (p?.fecha&&Number(p?.valor)>0);if(!es)continue;const tdj=String(p.tdj||p.recibo||"").trim();const fecha=fechaISO(p.fecha)||"";const valor=Number(p.valor||0);if(!fecha||!Number.isFinite(valor)||valor<=0)continue;const key=`${tdj}|${fecha}|${valor}`;if(!mapa.has(key))mapa.set(key,{tdj,fecha,valor:truncarValorEntero(valor),tipo:TIPOS.find(x=>upper(x)===upper(p.tipo))||"TASA DIAN",observacion:upper(p.observacion||"")});}const encontrados=[...mapa.values()];if(!encontrados.length)throw new Error("La IA no reconoció títulos/TDJ válidos con TDJ, fecha y valor.");titulos=encontrados.map((p,i)=>({id:uid("TDJ"),numero:i+1,tdj:p.tdj,fecha:p.fecha,valor:truncarValorEntero(p.valor),tipo:p.tipo||"TASA DIAN",observacion:upper(p.observacion||""),_orden:Date.now()+i}));ordenarTitulosCronologicamente();renderTitulos();$("importarTitulosTexto").value="";$("resultadoImportacionTitulos").textContent=`IA DIAN reconoció ${titulos.length} título(s)/TDJ.`;setStatus(`IA DIAN — TÍTULOS VALIDADOS ${Math.round(Number(ai?.confidence||0)*100)}%`,"ok");}catch(e){setStatus("LISTO","ok");alert(e.message||"No fue posible procesar los títulos con IA.");}}

function actualizarIndicadoresIA(){
  let estado=null;try{estado=window.__tdjEstadoIA||null;}catch{}
  const ok=estado?.estado&&["CONECTADO","PAGOS APLICADOS","OBLIGACION VALIDADA"].includes(String(estado.estado).toUpperCase());
  [$("estadoIAImportObligacion"),$("estadoIAImportPagos"),$("estadoIAImportTitulos")].filter(Boolean).forEach(dot=>{dot.className=`indicador-parametros indicador-ia ${ok?"listo":"error"}`;dot.title=ok?`IA DIAN activa · motor v${estado.version||"—"}`:"IA DIAN no comprobada";dot.setAttribute("aria-label",dot.title);});
}
window.addEventListener("dian-ai-status",e=>{window.__tdjEstadoIA=e.detail||null;actualizarIndicadoresIA();});

function activarTab(nombre){
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===nombre));
  document.querySelectorAll(".tab-pane").forEach(p=>p.classList.toggle("active",p.dataset.pane===nombre));
  if(nombre==="pagos")renderPagos();
  window.scrollTo({top:0,behavior:"smooth"});
}
function iniciarTabs(){
  document.querySelectorAll(".tab-btn").forEach(b=>b.addEventListener("click",()=>activarTab(b.dataset.tab)));
}

function init(){
  obligaciones=[nuevaObligacion(1)];titulos=[nuevoTitulo(1)];renderObligaciones();renderPagos();renderTitulos();
  const razonGlobal=$("razonGlobal");
  if(razonGlobal){
    // NO USAR upper() DURANTE INPUT: trim() ELIMINARÍA EL ESPACIO FINAL
    // CADA VEZ QUE EL USUARIO PRESIONE LA BARRA ESPACIADORA.
    razonGlobal.value=upperPreserveSpaces(razonGlobal.value);
    razonGlobal.addEventListener("input",()=>{razonGlobal.value=upperPreserveSpaces(razonGlobal.value);});
    razonGlobal.addEventListener("blur",()=>{razonGlobal.value=razonGlobal.value.trim();});
  }
  const bind=(id,event,fn)=>{const el=$(id);if(el)el.addEventListener(event,fn);};
  bind("btnAgregarObligacion","click",agregarObligacion);bind("btnAgregarTitulo","click",agregarTitulo);document.querySelectorAll(".tdj-excel").forEach(b=>b.addEventListener("click",exportarExcelTDJ));document.querySelectorAll(".tdj-pdf").forEach(b=>b.addEventListener("click",exportarPdfTDJ));bind("btnProcesarImportTitulos","click",importarTitulos);bind("btnProcesarImportTitulosIA","click",importarTitulosIA);bind("btnImportarObligacionTDJ","click",()=>importarObligacionGlobal(false));bind("btnImportarObligacionTDJIA","click",()=>importarObligacionGlobal(true));bind("btnImportarPagosTDJ","click",()=>importarPagosGlobal(false));document.querySelectorAll(".tdj-import-excel").forEach(b=>b.addEventListener("click",importarExcelTDJ));bind("btnImportarPagosTDJIA","click",()=>importarPagosGlobal(true));document.querySelectorAll(".btn-calcular-tdj").forEach(b=>b.addEventListener("click",aplicarTitulos));document.querySelectorAll(".btn-limpiar-tdj").forEach(b=>b.addEventListener("click",limpiarTodo));iniciarTabs();actualizarIndicadoresIA();renderPanelesTasasIPC();
  setStatus("CARGANDO MOTOR DE LIQUIDACIÓN...","loading");
  normalizarDatosLocal().then(()=>{renderPagos();renderObligaciones();refrescarTasasPagos();renderPanelesTasasIPC();setStatus("MOTOR DE LIQUIDACIÓN DISPONIBLE","ok");cargarSupabase();}).catch(e=>{console.error(e);setStatus("ERROR CARGANDO PARÁMETROS","error");});
  comprobarMotorIA().then(r=>{window.__tdjEstadoIA={estado:"CONECTADO",version:r?.version||"—"};actualizarIndicadoresIA();if(r?.disponible||r?.version)setStatus(`MOTOR DISPONIBLE · IA DIAN v${r.version||"—"}`,"ok");}).catch(()=>{window.__tdjEstadoIA={estado:"NO COMPROBADO",version:"—"};actualizarIndicadoresIA();});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
