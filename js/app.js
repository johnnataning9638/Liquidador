import {dinero,numeroDesdeTexto,fechaISO,fechaVisible} from "./utilidades.js?v=16.32.18";
import {importarDatosInteligente} from "./importador.js?v=16.32.18";
import {MotorLiquidacion} from "./motor-liquidacion.js?v=16.32.18";
import {MotorLiquidacionOficial} from "./motor-liquidacion-oficial.js?v=16.32.18";
import {ActualizadorSancion} from "./actualizacion-sancion.js?v=16.32.18";
import {CalendarioTributario} from "./calendario-tributario.js?v=16.32.18";
import {MotorNormativoHistorico} from "./motor-normativo-historico.js?v=16.32.18";
import {AuditoriaTrazabilidad} from "./auditoria-trazabilidad.js?v=16.32.18";
import {importarDatosObligacionInteligente} from "./importador-obligacion.js?v=16.32.18";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./supabase-config.js?v=16.32.18";

const $=id=>document.getElementById(id);
const N=6;
const TIPOS=[
  "TASA DIAN",
  "ART. 45 LEY 2155",
  "ART. 91 LEY 2277",
  "ART. 93 LEY 2277 - OMISAS",
  "ART. 48 LEY 2155",
  "ART. 1 DECRETO 688 DE 2020 - IBC",
  "ART. 120 LEY 2010 2018 PARAG 3- IBC+2",
  "ART. 20 DECRETO 1474 DE 2025",
  "ART. 21 DECRETO 1474 DE 2025, OMISO- CORRECION",
  "ART. 3 DECRETO 0240 DE 2026",
  "ART. 4 DECRETO 0240 DE 2026, OMISO- CORRECION"
];

let motor=null,motorPrivado=null,motorOficial=null,actualizadorSancion=null,calendarioMotor=null,normativoHistorico=null,auditoria=null;
let uvt=[],tasasMoratorias=[],tasasBase=[],ipc=[],ipcBase=[],ipcCentrales=[],beneficios=[],sanciones=[],reglasObligaciones=[],calendarioData=null;
let pagos=[];
let tasasPersonalizadas=[];
let tasasCentrales=[];
let supabaseClient=null;
let adminEmail=null;
let ultimaLiquidacion=null,ultimaAuditoria=null;
let obligacionVencimientos=[];
// Estado de interfaz: conserva sanción y pagos mientras el funcionario navega entre pestañas.
let estadoSancionUI={tiene:"",valor:"",fecha:"",beneficio:""};

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const upper=v=>String(v??"").trim().toUpperCase();
const hoyISO=()=>new Date().toISOString().slice(0,10);


const URL_TIM_DIAN="https://www.dian.gov.co/normatividad/Paginas/TIM.aspx";
const MESES_TASA=["","ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
const MES_NUM={ENERO:1,FEBRERO:2,MARZO:3,ABRIL:4,MAYO:5,JUNIO:6,JULIO:7,AGOSTO:8,SEPTIEMBRE:9,OCTUBRE:10,NOVIEMBRE:11,DICIEMBRE:12};
function primerDiaMes(anio,mes){return `${Number(anio)}-${String(Number(mes)).padStart(2,"0")}-01`;}
function ultimoDiaMes(anio,mes){return new Date(Number(anio),Number(mes),0).toISOString().slice(0,10);}
async function iniciarSupabase(){
  const url=String(SUPABASE_URL||"").trim();
  const key=String(SUPABASE_ANON_KEY||"").trim();
  if(!url||!key||url.includes("PEGAR_AQUI")||key.includes("PEGAR_AQUI"))return null;
  try{
    // Supabase se carga de forma diferida para que una caída o bloqueo del CDN
    // nunca impida iniciar el liquidador con sus parámetros locales.
    const modulo=await conTiempoLimite(import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"),6000);
    return modulo.createClient(url,key);
  }catch(e){
    console.error("No se pudo cargar/inicializar Supabase. Se continuará con parámetros locales.",e);
    return null;
  }
}
function conTiempoLimite(promise,ms=8000){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error("TIEMPO_ESPERA_SUPABASE")),ms))
  ]);
}
function renderIPC(){
  const tbody=$("tablaIPC")?.querySelector("tbody");
  if(!tbody)return;
  tbody.innerHTML="";
  const filas=ipcCentrales.length?ipcCentrales:ipc;
  [...filas].sort((a,b)=>Number(b.anio_inflacion??b.anioInflacion)-Number(a.anio_inflacion??a.anioInflacion)).forEach(x=>{
    const anio=Number(x.anio_inflacion??x.anioInflacion);
    const valor=Number(x.inflacion??0);
    const desde=String(x.aplicable_desde??x.aplicableDesde??"").slice(0,10);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${anio}</td><td>${(valor*100).toFixed(2)}%</td><td>${fechaVisible(desde)}</td><td>${esc(x.fuente_url||x.fuente||"SUPABASE")}</td><td>${esc(x.norma||"—")}</td>`;
    tbody.appendChild(tr);
  });
}
function ipcRemotoPorAnio(anio){return ipcCentrales.find(x=>Number(x.anio_inflacion)===Number(anio));}
function prepararIPCRemoto(){
  ipcBase=JSON.parse(JSON.stringify(ipc));
  if(!ipcCentrales.length){ipc=ipcBase;return;}
  const mapa=new Map(ipcBase.map(x=>[Number(x.anioInflacion??x.anio_inflacion),x]));
  for(const x of ipcCentrales){const y=Number(x.anio_inflacion);mapa.set(y,{anioInflacion:y,inflacion:Number(x.inflacion),aplicableDesde:String(x.aplicable_desde).slice(0,10),fuente:x.fuente_url||x.fuente||"SUPABASE"});}
  ipc=[...mapa.values()].sort((a,b)=>a.anioInflacion-b.anioInflacion);
  reconstruirMotor();
}
function mensajeActualizacionesPendientes(){
  const box=$("avisosParametros"); if(!box)return;
  const hoy=new Date(); const anio=hoy.getFullYear(), mes=hoy.getMonth()+1, dia=hoy.getDate();
  const pendientes=[];
  const timOk=tasasCentrales.some(t=>String(t.fecha_inicio).slice(0,7)===`${anio}-${String(mes).padStart(2,"0")}` && String(t.tipo_tasa)==="TASA DIAN");
  if(dia<=7 && supabaseClient && !timOk) pendientes.push(`Actualizar TIM — ${MESES_TASA[mes]} ${anio}`);
  const ipcObjetivo=anio-1;
  const ipcOk=ipcObjetivo>=2003 && ipcCentrales.some(x=>Number(x.anio_inflacion)===ipcObjetivo);
  if(ipcObjetivo>=2003 && !ipcOk && supabaseClient) pendientes.push(`Actualizar IPC — año ${ipcObjetivo}`);
  if(!supabaseClient){box.hidden=true;return;}
  box.hidden=!pendientes.length;
  if(pendientes.length)box.innerHTML=`<strong>Parámetros pendientes de actualización:</strong> ${pendientes.map(x=>`<span class="aviso-parametro">${esc(x)}</span>`).join(" ")}<span class="aviso-parametro-nota">El aviso es informativo y no bloquea el liquidador.</span>`;
}
async function cargarIPCRemotos(){
  if(!supabaseClient)return false;
  let data,error;
  try{
    ({data,error}=await conTiempoLimite(supabaseClient.from("ipc_liquidador").select("id,anio_inflacion,inflacion,aplicable_desde,fuente_url,norma,estado").order("anio_inflacion",{ascending:true})));
  }catch(e){
    console.warn("No fue posible consultar IPC en Supabase dentro del tiempo de espera.",e);
    $("estadoIPCConexion").textContent="Supabase no respondió; se usan parámetros locales.";
    return false;
  }
  if(error){console.error(error);$("estadoIPCConexion").textContent="No fue posible leer Supabase.";return false;}
  ipcCentrales=Array.isArray(data)?data:[];
  prepararIPCRemoto();
  $("estadoIPCConexion").textContent=`Conectado · ${ipcCentrales.length} IPC anuales`;
  renderIPC();
  mensajeActualizacionesPendientes();
  return true;
}
async function guardarIPCManual(){
  if(!esAdministradorLogueado())return alert("Inicie sesión como administrador para guardar un IPC.");
  if(!supabaseClient)return alert("Supabase no está configurado.");
  const anio=Number($("ipcAnio").value);
  const valor=numeroTasaTexto($("ipcValor").value);
  const norma=String($("ipcNorma")?.value||"").trim()||null;
  if(!Number.isInteger(anio)||anio<1900||anio>2100)return alert("Ingrese un año válido.");
  if(!Number.isFinite(valor)||valor<0||valor>100)return alert("Ingrese un IPC entre 0 y 100%.");
  const payload={anio_inflacion:anio,inflacion:Number((valor/100).toFixed(8)),aplicable_desde:`${anio+1}-01-01`,fuente_url:"DANE / DIAN",norma,estado:"ACTIVA"};
  const {data:existente,error:err}=await supabaseClient.from("ipc_liquidador").select("id,inflacion").eq("anio_inflacion",anio).maybeSingle();
  if(err)return alert(`No fue posible consultar el IPC existente: ${err.message}`);
  let error;
  if(existente){({error}=await supabaseClient.from("ipc_liquidador").update(payload).eq("id",existente.id));}
  else {({error}=await supabaseClient.from("ipc_liquidador").insert(payload));}
  if(error)return alert(`No fue posible guardar el IPC: ${error.message}`);
  $("estadoIPC").innerHTML=`IPC central guardado: <strong>${valor.toFixed(2)}%</strong> · año ${anio}.`;
  await cargarIPCRemotos();
}
function renderTasasPersonalizadas(){
  const tbody=$("tablaTasasPersonalizadas")?.querySelector("tbody");
  if(!tbody)return;
  tbody.innerHTML="";
  const filas=tasasCentrales.length?tasasCentrales:[...tasasPersonalizadas].map(t=>({fecha_inicio:t.desde,fecha_fin:t.hasta,tasa:Number(t.tasa)/100,tipo_tasa:"TASA DIAN",fuente_url:t.fuente||"LOCAL",norma:null}));
  [...filas].sort((a,b)=>String(b.fecha_inicio).localeCompare(String(a.fecha_inicio))).forEach(t=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${fechaVisible(t.fecha_inicio)}</td><td>${fechaVisible(t.fecha_fin)}</td><td>${(Number(t.tasa)*100).toFixed(3)}%</td><td>${esc(t.tipo_tasa||"TASA DIAN")}</td><td>${esc(t.fuente_url||"SUPABASE")}</td><td>${esc(t.norma||"—")}</td>`;
    tbody.appendChild(tr);
  });
}
function leerTasasPersonalizadas(){
  try{const raw=localStorage.getItem("liquidador_dian_tasas_personalizadas");tasasPersonalizadas=raw?JSON.parse(raw):[];if(!Array.isArray(tasasPersonalizadas))tasasPersonalizadas=[];}catch{tasasPersonalizadas=[];}
}
function guardarTasasPersonalizadas(){localStorage.setItem("liquidador_dian_tasas_personalizadas",JSON.stringify(tasasPersonalizadas));}
function reconstruirMotor(){
  actualizadorSancion=new ActualizadorSancion({ipc});
  motorPrivado=new MotorLiquidacion({uvt,tasasMoratorias,ipc,beneficios,sanciones,reglasObligaciones});
  motorOficial=new MotorLiquidacionOficial({uvt,tasasMoratorias,ipc,beneficios,sanciones,reglasObligaciones});
  seleccionarMotorPorTipo();
}
function seleccionarMotorPorTipo(){
  const tipo=upper($("tipoLiquidacion")?.value||"");
  motor=tipo==="OFICIAL"?motorOficial:motorPrivado;
  return motor;
}
function aplicarTasaEnMemoria(desde,hasta,tasa,fuente="ACTUALIZACIÓN MANUAL",reconstruir=true){
  const d=String(desde).slice(0,10),h=String(hasta).slice(0,10),valor=Number(tasa)/100;
  const filaExistente=tasasMoratorias.find(x=>String(x.desde).slice(0,10)===d&&String(x.hasta).slice(0,10)===h);
  if(filaExistente){
    filaExistente.tasas=filaExistente.tasas||{};
    filaExistente.tasas["TASA DIAN"]=valor;
    filaExistente.formulario=Number(tasa);
    filaExistente.fuente=fuente;
    filaExistente.prioridadFuente=0;
  }else{
    tasasMoratorias.push({desde:d,hasta:h,tasas:{"TASA DIAN":valor},formulario:Number(tasa),metodologia:"INTERES_SIMPLE_DIARIO",fuente,prioridadFuente:0,id:`TIM-CUSTOM-${d}`});
  }
  tasasMoratorias.sort((a,b)=>String(a.desde).localeCompare(String(b.desde)));
  if(reconstruir)reconstruirMotor();
}
function aplicarTasasGuardadas(){
  tasasMoratorias=JSON.parse(JSON.stringify(tasasBase));
  for(const t of tasasPersonalizadas)aplicarTasaEnMemoria(t.desde,t.hasta,t.tasa,t.fuente||"ACTUALIZACIÓN MANUAL",false);
  reconstruirMotor();
}
function esAdministradorLogueado(){return Boolean(adminEmail);}
async function verificarAdministrador(){
  if(!supabaseClient)return false;
  let authData;
  try{authData=await conTiempoLimite(supabaseClient.auth.getUser());}
  catch(e){console.warn("Supabase Auth no respondió durante el arranque.",e);adminEmail=null;actualizarUIAdmin();return false;}
  const {data:{user}}=authData;
  adminEmail=user?.email||null;
  if(!user){actualizarUIAdmin();return false;}
  const {data,error}=await supabaseClient.from("admin_users").select("email").eq("email",user.email).maybeSingle();
  if(error){console.warn("No fue posible verificar administrador",error);adminEmail=null;actualizarUIAdmin();return false;}
  if(!data)adminEmail=null;
  actualizarUIAdmin();
  return Boolean(adminEmail);
}
function actualizarUIAdmin(){
  const estado=$("estadoAdmin"),login=$("btnIniciarAdmin"),logout=$("btnCerrarAdmin"),panel=$("panelEdicionTasa"),panelIPC=$("panelEdicionIPC");
  if(!estado)return;
  const ok=Boolean(adminEmail);
  estado.textContent=ok?`Administrador: ${adminEmail}`:"Modo consulta pública";
  if(login)login.hidden=ok;
  if(logout)logout.hidden=!ok;
  if(panel)panel.hidden=!ok;
  if(panelIPC)panelIPC.hidden=!ok;
}
async function iniciarSesionAdmin(){
  if(!supabaseClient)return alert("Supabase aún no está configurado en js/supabase-config.js.");
  const email=prompt("Correo del administrador:");
  if(email===null)return;
  const password=prompt("Contraseña de Supabase Auth:");
  if(password===null)return;
  const {error}=await supabaseClient.auth.signInWithPassword({email:email.trim(),password});
  if(error)return alert(`No fue posible iniciar sesión: ${error.message}`);
  if(!(await verificarAdministrador())){
    await supabaseClient.auth.signOut();
    return alert("El usuario inició sesión, pero no está autorizado como administrador de tasas.");
  }
  $("estadoTasas").innerHTML="Sesión de administrador iniciada. Puede registrar una nueva tasa central.";
}
async function cerrarSesionAdmin(){if(supabaseClient)await supabaseClient.auth.signOut();adminEmail=null;actualizarUIAdmin();$("estadoTasas").textContent="Sesión administrativa cerrada.";}
async function cargarTasasRemotas(){
  if(!supabaseClient){$("estadoTasasConexion").textContent="Supabase no configurado; se usan parámetros locales.";return false;}
  let data,error;
  try{
    ({data,error}=await conTiempoLimite(supabaseClient.from("tasas_liquidador").select("id,fecha_inicio,fecha_fin,tasa,tipo_tasa,fuente_url,norma,estado").eq("tipo_tasa","TASA DIAN").order("fecha_inicio",{ascending:true}).order("id",{ascending:true})));
  }catch(e){
    console.warn("No fue posible consultar tasas en Supabase dentro del tiempo de espera.",e);
    $("estadoTasasConexion").textContent="Supabase no respondió; se usan parámetros locales.";
    return false;
  }
  if(error){console.error(error);$("estadoTasasConexion").textContent="No fue posible leer Supabase.";return false;}
  tasasCentrales=Array.isArray(data)?data:[];
  for(const t of tasasCentrales)aplicarTasaEnMemoria(t.fecha_inicio,t.fecha_fin,Number(t.tasa)*100,t.fuente_url||"SUPABASE",false);
  reconstruirMotor();
  $("estadoTasasConexion").textContent=`Conectado · ${tasasCentrales.length} tasas centrales`;
  renderTasasPersonalizadas();
  return true;
}
function numeroTasaTexto(v){const s=String(v||"").trim().replace(/\s/g,"");if(s.includes(","))return Number(s.replace(/\./g,"").replace(",","."));return Number(s);}
async function guardarTasaManual(){
  if(!esAdministradorLogueado())return alert("Inicie sesión como administrador para guardar una tasa.");
  if(!supabaseClient)return alert("Supabase no está configurado.");
  const mes=Number($("tasaMes").value),anio=Number($("tasaAnio").value),tasa=numeroTasaTexto($("tasaValor").value),norma=String($("tasaNorma")?.value||"").trim()||null;
  if(!Number.isInteger(anio)||anio<1900||anio>2100)return alert("Ingrese un año válido.");
  if(!Number.isInteger(mes)||mes<1||mes>12)return alert("Seleccione un mes válido.");
  if(!Number.isFinite(tasa)||tasa<0||tasa>100)return alert("Ingrese una tasa entre 0 y 100%.");
  const desde=primerDiaMes(anio,mes),hasta=ultimoDiaMes(anio,mes);
  const primerDiaMesActual=primerDiaMes(Number(hoyISO().slice(0,4)),Number(hoyISO().slice(5,7)));
  if(desde<primerDiaMesActual)return alert("Por seguridad, este panel no permite modificar períodos anteriores al mes actual.");
  const {data:existente,error:errExist}=await supabaseClient.from("tasas_liquidador").select("id,tasa,fecha_inicio,fecha_fin,tipo_tasa").eq("fecha_inicio",desde).eq("fecha_fin",hasta).eq("tipo_tasa","TASA DIAN").maybeSingle();
  if(errExist)return alert(`No fue posible consultar la tasa existente: ${errExist.message}`);
  const payload={fecha_inicio:desde,fecha_fin:hasta,tasa:Number((tasa/100).toFixed(8)),tipo_tasa:"TASA DIAN",fuente_url:URL_TIM_DIAN,norma,estado:"ACTIVA"};
  if(existente){
    if(Math.abs(Number(existente.tasa)-payload.tasa)<1e-9){$("estadoTasas").innerHTML=`La tasa ${tasa.toFixed(3)}% para ${MESES_TASA[mes]} ${anio} ya está registrada. No se modificó nada.`;return;}
    const {error}=await supabaseClient.from("tasas_liquidador").update(payload).eq("id",existente.id);
    if(error)return alert(`No fue posible actualizar la tasa: ${error.message}`);
    $("estadoTasas").innerHTML=`Tasa central actualizada: <strong>${tasa.toFixed(3)}%</strong> · ${MESES_TASA[mes]} ${anio}.`;
  }else{
    const {error}=await supabaseClient.from("tasas_liquidador").insert(payload);
    if(error)return alert(`No fue posible guardar la tasa: ${error.message}`);
    $("estadoTasas").innerHTML=`Tasa central guardada: <strong>${tasa.toFixed(3)}%</strong> · ${MESES_TASA[mes]} ${anio}.`;
  }
  await cargarTasasRemotas();
  renderPagos();
}
async function actualizarDesdeDIAN(){
  await cargarTasasRemotas();
  $("estadoTasas").textContent="Tasas centrales recargadas desde Supabase.";
}

async function cargarDatos(){
  let normativoData;
  [uvt,tasasMoratorias,ipc,beneficios,sanciones,reglasObligaciones,calendarioData,normativoData]=await Promise.all([
    fetch("datos/uvt.json").then(r=>r.json()),
    fetch("datos/tasas-moratorias.json").then(r=>r.json()),
    fetch("datos/ipc.json").then(r=>r.json()),
    fetch("datos/beneficios.json").then(r=>r.json()),
    fetch("datos/sanciones.json").then(r=>r.json()),
    fetch("datos/reglas-obligaciones.json").then(r=>r.json()),
    fetch("datos/calendario.json").then(r=>r.json()),
    fetch("datos/reglas-historicas.json").then(r=>r.json())
  ]);
  tasasBase=JSON.parse(JSON.stringify(tasasMoratorias));
  leerTasasPersonalizadas();
  aplicarTasasGuardadas();
  supabaseClient=await iniciarSupabase();
  await cargarTasasRemotas();
  await cargarIPCRemotos();
  await verificarAdministrador();
  mensajeActualizacionesPendientes();
  calendarioMotor=new CalendarioTributario({datos:calendarioData.tablas||[]});
  normativoHistorico=new MotorNormativoHistorico({datos:normativoData});
  auditoria=new AuditoriaTrazabilidad({version:"REAJUSTE 16.32.18"});
  $("estadoSistema").textContent="Parámetros históricos cargados";
  $("estadoSistema").classList.add("ok");
}

function opcionesTipo(actual){return TIPOS.map(t=>`<option value="${esc(t)}" ${actual===t?"selected":""}>${esc(t)}</option>`).join("");}
function dineroCampo(id){const el=$(id);if(!el)return;const n=numeroDesdeTexto(el.value);el.value=n?dinero(n):"";}
function fechaCampo(id){const el=$(id);if(!el)return "";const raw=String(el.value||"").trim();if(!raw)return "";const iso=fechaISO(raw);if(!iso){alert("Fecha no válida. Usa DD/MM/AAAA.");el.value="";return "";}el.value=fechaVisible(iso);return iso;}
function sincronizarFechaDual(textId,pickerId,onChange=()=>{}){
  const text=$(textId),picker=$(pickerId);if(!text||!picker)return;
  const aplicar=iso=>{const valido=fechaISO(iso);if(valido){text.value=fechaVisible(valido);picker.value=valido;onChange(valido);}else if(!String(iso||"").trim()){text.value="";picker.value="";onChange("");}};
  picker.addEventListener("change",()=>aplicar(picker.value));
  text.addEventListener("blur",()=>{const iso=fechaCampo(textId);if(iso)picker.value=iso;else if(!text.value.trim())picker.value="";onChange(iso||"");});
  picker.addEventListener("click",()=>{try{if(typeof picker.showPicker==="function")picker.showPicker();}catch{}});
}
function montarFechaDual(root,onChange=()=>{}){
  if(!root)return;const text=root.querySelector(".fecha-campo"),picker=root.querySelector(".fecha-native");if(!text||!picker)return;
  const aplicar=iso=>{const valido=fechaISO(iso);if(valido){text.value=fechaVisible(valido);picker.value=valido;onChange(valido);}else if(!String(iso||"").trim()){text.value="";picker.value="";onChange("");}};
  picker.addEventListener("change",()=>aplicar(picker.value));
  text.addEventListener("blur",()=>{const iso=fechaCampo(text.id);if(iso)picker.value=iso;else if(!text.value.trim())picker.value="";onChange(iso||"");});
  picker.addEventListener("click",()=>{try{if(typeof picker.showPicker==="function")picker.showPicker();}catch{}});
}
function campoFechaHtml({idText,idPicker,value="",clase=""}){const iso=fechaISO(value);return `<div class="fecha-dual"><input id="${esc(idText)}" class="fecha-campo ${esc(clase)}" type="text" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" value="${esc(fechaVisible(iso))}"><input id="${esc(idPicker)}" class="fecha-native" type="date" aria-label="Abrir calendario" title="Abrir calendario" value="${esc(iso)}"></div>`;}

function actualizarCamposTipoLiquidacion(){
  const tipo=upper($("tipoLiquidacion")?.value||"");
  const esOficial=tipo==="OFICIAL";
  const campoAuto=$("campoFechaAutoAdmisorio");
  const campoProv=$("campoFechaProvidenciaDefinitiva");
  if(campoAuto)campoAuto.hidden=!esOficial;
  if(campoProv)campoProv.hidden=!esOficial;
  ["fechaAutoAdmisorio","fechaAutoAdmisorioPicker","fechaProvidenciaDefinitiva","fechaProvidenciaDefinitivaPicker"].forEach(id=>{
    const el=$(id);
    if(el)el.disabled=!esOficial;
  });
  if(!esOficial){
    ["fechaAutoAdmisorio","fechaAutoAdmisorioPicker","fechaProvidenciaDefinitiva","fechaProvidenciaDefinitivaPicker"].forEach(id=>{
      const el=$(id);
      if(el)el.value="";
    });
  }
}

function leerFormulario(){
  const concepto=upper($("concepto").value);
  const periodicidad=concepto==="SIMPLE"?"ANTICIPO BIMESTRAL":upper($("periodicidadObligacion")?.value||"");
  return {
    nit:$("nit").value.replace(/\D/g,""),
    anio:Number($("anio").value||0),
    concepto,
    periodo:$("periodo").value,
    razonSocial:upper($("razonSocial").value),
    tipoLiquidacion:upper($("tipoLiquidacion").value),
    fechaAutoAdmisorio:fechaISO($("fechaAutoAdmisorio")?.value||""),
    fechaProvidenciaDefinitiva:fechaISO($("fechaProvidenciaDefinitiva")?.value||""),
    perfilContribuyente:upper($("perfilContribuyente")?.value||""),
    periodicidadObligacion:periodicidad,
    // La fecha para declarar ya no se captura en un campo independiente.
    // Para el PDF/Excel se deriva siempre de la CUOTA 1.
    fechaVencimientoDeclarar:fechaISO((obligacionVencimientos.find(v=>Number(v.numero)===1)||{}).fecha||""),
    fechaCorte:hoyISO(),
    vencimientos:obligacionVencimientos
      .filter(v=>v.fecha&&Number(v.impuesto)>0)
      .map(v=>({...v,impuesto:Number(v.impuesto)})),
    tieneSancion:upper($("tieneSancion").value),
    valorSancion:numeroDesdeTexto($("valorSancion").value),
    fechaSancion:fechaISO($("fechaSancion").value),
    beneficioSancion:upper($("beneficioSancion").value),
    beneficioTributario:upper($("beneficioTributario")?.value||"NINGUNO"),
    beneficioEscenario:upper($("beneficioTributario")?.value||"").replace("D0240_ART4_","").replace("_"," "),
    fechaActuacionBeneficio:fechaISO($("fechaActuacionBeneficio")?.value),
    fechaDeclaracionOriginal:fechaISO($("fechaDeclaracionOriginal")?.value),
    obligacionFormalCumplida:upper($("obligacionFormalCumplida")?.value)==="SI",
    aceptaGlosas:upper($("aceptaGlosas")?.value)==="SI",
    informaDian:upper($("informaDian")?.value)==="SI",
    resolucionReconsideracion:upper($("resolucionReconsideracion")?.value)==="SI",
    pagos
  };
}

function renderBeneficio(){
  const out=$("resultadoBeneficio");
  if(out)out.innerHTML="<strong>Selección manual:</strong> el tipo de tasa/beneficio se define en cada pago. El liquidador decide si utiliza TASA DIAN o alguno de los tratamientos disponibles; el sistema liquida exactamente la opción seleccionada y no valida requisitos de elegibilidad. ";
}

function renderResultadoBeneficio(r){
  const box=$("resultadoBeneficio");
  if(!box)return;
  const tipos=[...new Set((r?.detalle||[]).map(x=>x.tipoAplicado).filter(Boolean))];
  box.innerHTML=tipos.length
    ? `<strong>Tratamientos seleccionados:</strong> ${esc(tipos.join(" · "))}`
    : "<strong>Sin pagos procesados.</strong> Seleccione el tipo de tasa/beneficio al agregar cada pago.";
}

function renderMetadatosConcepto(){
  const c=upper($("concepto").value);
}

function renderVencimientos(){
  const tbody=$("tablaVencimientos").querySelector("tbody");
  tbody.innerHTML="";
  for(let i=1;i<=N;i++){
    const v=obligacionVencimientos.find(x=>Number(x.numero)===i)||{};
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${i}</td><td><input data-v="periodo" value="${esc(v.periodo??(i))}" inputmode="text"></td><td>${campoFechaHtml({idText:`fechaVto-${i}`,idPicker:`fechaVtoPicker-${i}`,value:v.fecha,clase:"fecha-vto"})}</td><td><input data-v="impuesto" class="money" inputmode="numeric" value="${v.impuesto?dinero(v.impuesto):""}" placeholder="$ 0"></td><td><button class="secundario" data-clear="1">Limpiar</button></td>`;
    tr.querySelectorAll("[data-v]").forEach(el=>el.addEventListener("change",()=>{
      const key=el.dataset.v;
      let x=obligacionVencimientos.find(z=>Number(z.numero)===i);
      if(!x){x={id:`VTO-${i}`,numero:i,periodo:i,fecha:"",impuesto:0};obligacionVencimientos.push(x);}
      if(key==="impuesto"){x.impuesto=numeroDesdeTexto(el.value);el.value=x.impuesto?dinero(x.impuesto):"";}
      else if(key==="periodo"){x.periodo=upper(el.value);}
    }));
    montarFechaDual(tr,iso=>{
      let x=obligacionVencimientos.find(z=>Number(z.numero)===i);
      if(!x){x={id:`VTO-${i}`,numero:i,periodo:i,fecha:"",impuesto:0};obligacionVencimientos.push(x);}
      x.fecha=iso||"";
    });
    tr.querySelector("[data-clear]").addEventListener("click",()=>{obligacionVencimientos=obligacionVencimientos.filter(x=>Number(x.numero)!==i);renderVencimientos();});
    tbody.appendChild(tr);
  }
}

function renderCalendario(){
  const box=$("resultadoCalendario");
  if(!calendarioMotor)return;
  const d=leerFormulario();
  if(!d.nit||!d.anio||!d.concepto){box.innerHTML="Complete NIT, año y concepto para consultar el calendario.";return;}
  const r=calendarioMotor.fechaVencimiento(d);
  if(r.disponible){
    box.innerHTML=`<div class="cal-grid"><div><span>Fecha DIAN</span><strong>${fechaVisible(r.fecha)}</strong></div><div><span>Regla</span><strong>${esc(r.clave)}</strong></div></div><div class="nota">${esc(r.detalle)} · ${esc(r.fuente)}</div><button type="button" id="btnAplicarVencimiento" class="primario">Aplicar al vencimiento ${esc(d.periodo||"1")}</button>`;
    $("btnAplicarVencimiento").addEventListener("click",()=>{
      const n=Math.min(N,Math.max(1,Number(d.periodo||1)));
      let x=obligacionVencimientos.find(v=>Number(v.numero)===n);
      if(!x){x={id:`VTO-${n}`,numero:n,periodo:n,impuesto:0,fecha:""};obligacionVencimientos.push(x);}
      x.fecha=r.fecha;
      renderVencimientos();
    });
  }else box.innerHTML=`<div class="detalle-alerta">⚠ ${esc((r.advertencias||[]).join(" "))}</div>`;
}

function tasaParaPago(p){
  if(!motor||!p.fecha)return null;
  return motor.tasaEspecial(p.tipo,p.fecha)?.tasa??null;
}
function renderPagos(){
  const tbody=$("tablaPagos").querySelector("tbody");tbody.innerHTML="";
  pagos.forEach((p,i)=>{
    const tr=document.createElement("tr"),tasa=tasaParaPago(p);
    tr.innerHTML=`<td>${i+1}</td><td><input data-k="tdj" value="${esc(p.tdj||"")}"></td><td><input data-k="recibo" value="${esc(p.recibo||"")}"></td><td>${campoFechaHtml({idText:`fechaPago-${p.id}`,idPicker:`fechaPagoPicker-${p.id}`,value:p.fecha,clase:"fecha-pago"})}</td><td><input data-k="valor" class="money" inputmode="numeric" value="${p.valor?dinero(p.valor):""}" placeholder="$ 0"></td><td><select data-k="tipo">${opcionesTipo(p.tipo)}</select></td><td>${tasa==null?"SIN DATOS":(tasa*100).toFixed(3)+"%"}</td><td><input data-k="observacion" value="${esc(p.observacion||"")}"></td><td><button class="peligro" data-del="1">Eliminar</button></td>`;
    tr.querySelectorAll("[data-k]").forEach(el=>el.addEventListener("change",()=>{
      const k=el.dataset.k;
      if(k==="valor"){p.valor=numeroDesdeTexto(el.value);el.value=p.valor?dinero(p.valor):"";}
      else if(k==="tipo"){p.tipo=upper(el.value);renderPagos();}
      else p[k]=upper(el.value);
    }));
    montarFechaDual(tr,iso=>{p.fecha=iso||"";});
    tr.querySelector("[data-del]").addEventListener("click",()=>{pagos=pagos.filter(x=>x.id!==p.id);renderPagos();});
    tbody.appendChild(tr);
  });
}

function agregarPago(p={}){
  pagos.push({id:crypto.randomUUID(),tdj:upper(p.tdj),recibo:upper(p.recibo),fecha:fechaISO(p.fecha)||"",valor:Number(p.valor||0),tipo:upper(p.tipo)||"TASA DIAN",observacion:upper(p.observacion)||""});
  renderPagos();
}

function capturarSancionUI(){
  const tiene=$("tieneSancion");
  if(!tiene)return;
  estadoSancionUI={
    tiene:tiene.value||"",
    valor:$("valorSancion")?.value||"",
    fecha:$("fechaSancion")?.value||"",
    beneficio:$("beneficioSancion")?.value||""
  };
}
function restaurarSancionUI(){
  const tiene=$("tieneSancion");
  if(!tiene)return;
  if(tiene.value!==estadoSancionUI.tiene)tiene.value=estadoSancionUI.tiene;
  if($("valorSancion") && estadoSancionUI.valor)$("valorSancion").value=estadoSancionUI.valor;
  if($("fechaSancion") && estadoSancionUI.fecha)$("fechaSancion").value=estadoSancionUI.fecha;
  if($("fechaSancionPicker") && estadoSancionUI.fecha){const iso=fechaISO(estadoSancionUI.fecha);if(iso)$("fechaSancionPicker").value=iso;}
  if($("beneficioSancion"))$("beneficioSancion").value=estadoSancionUI.beneficio;
}
function actualizarSancionMinimaUI(){
  const campo=$("sancionMinima");
  if(!campo)return;
  const tiene=upper($("tieneSancion")?.value||"");
  const beneficio=upper($("beneficioSancion")?.value||"");
  const anio=Number($("anio")?.value||0);
  const fechaS=fechaISO($("fechaSancion")?.value||"");
  const usaAnioFechaSancion=(pagos||[]).some(p=>{
    const t=upper(p?.tipo||"");
    return t.includes("ART. 20 DECRETO 1474")||t.includes("ART. 3 DECRETO 0240");
  });
  const anioMinimo=(usaAnioFechaSancion && Number(fechaS.slice(0,4))) || anio;
  // Para Art. 20 D.1474 y Art. 3 D.0240, la sanción mínima se consulta
  // con el año de la fecha de sanción. Para los demás tratamientos se
  // conserva el año gravable de la obligación.
  if(motor && tiene==="SI" && beneficio==="CON BENEFICIO" && Number.isInteger(anioMinimo) && anioMinimo>0){
    const v=Number(motor.sancionMinima(anioMinimo)||0);
    campo.value=v?dinero(v):"";
  }else{
    campo.value="";
  }
}
function habilitarSancion(){
  const tiene=$("tieneSancion");
  if(!tiene)return;
  const on=upper(tiene.value)==="SI";
  ["valorSancion","fechaSancion","beneficioSancion"].forEach(id=>{
    const el=$(id);
    if(el)el.disabled=!on;
  });
  actualizarSancionMinimaUI();
  // Se captura después de aplicar el estado real de los controles.
  capturarSancionUI();
}

function pintarInforme(r){
  const u=r.ultimo||null;
  const d=u?.deudaAntes||{impuesto:0,intereses:0,sancion:0};
  const p=u?.aplicado||{impuesto:0,intereses:0,sancion:0,total:0};
  const s=u?.saldo||{impuesto:r.impuesto||0,intereses:r.intereses||0,sancion:r.sancion||0};
  $("rFechaPago").textContent=u?.pago?.fecha?fechaVisible(u.pago.fecha):"—";
  $("rTasa").textContent=u?.tasaVisible==null?"—":Number(u.tasaVisible).toFixed(3)+"%";
  ["Impuesto","Intereses","Sancion"].forEach((x,j)=>{const k=["impuesto","intereses","sancion"][j];$("rDeuda"+x).textContent=dinero(d[k]);$("rProp"+x).textContent=dinero(p[k]);$("rSaldo"+x).textContent=dinero(s[k]);});
  const totalDeuda=d.impuesto+d.intereses+d.sancion,totalAplicado=p.total,totalSaldo=s.impuesto+s.intereses+s.sancion;
  $("rDeudaTotal").textContent=dinero(totalDeuda);$("rPropTotal").textContent=dinero(totalAplicado);$("rSaldoTotal").textContent=dinero(totalSaldo);$("rSaldoTotalFooter").textContent=dinero(totalSaldo);
  const excedente=Number(r.excedente||0);
  const excedenteBox=$("rExcedenteBox");
  if(excedenteBox){excedenteBox.hidden=excedente<=0;if($("rExcedente"))$("rExcedente").textContent=dinero(excedente);}
  const detalle=(r.detalle||[]).map((x,i)=>`<div class="detalle-item"><strong>Pago ${i+1} — ${fechaVisible(x.pago.fecha)}</strong> · ${dinero(x.pago.valor)} · <strong>${esc(x.tipoAplicado||"TASA DIAN")}</strong> · ${esc(x.notaBeneficio||"")} · interés liquidado ${dinero(x.interesLiquidado??x.interesGenerado)} · impuesto aplicado ${dinero(x.aplicado.impuesto)} · intereses aplicados ${dinero(x.aplicado.intereses)} · sanción aplicada ${dinero(x.aplicado.sancion)}${Number(x.excedente||x.aplicado?.excedente||0)>0?` · <strong class="texto-excedente">EXCEDENTE ${dinero(x.excedente??x.aplicado.excedente)}</strong>`:""}</div>`).join("");
  const act=r.sancionActualizacion||null;
  const resumenSancion=act&&Number(act.actualizacionAcumulada||0)>0
    ?`<div class="detalle-item"><strong>Actualización de sanción (Art. 867-1):</strong> base ${dinero(act.saldoOriginal||0)} · actualización acumulada ${dinero(act.actualizacionAcumulada||0)} · saldo final ${dinero(act.saldoFinal||0)}</div>`
    :"";
  const adv=[...new Set(r.advertencias||[])].join(" | ");
  $("detalleCalculo").innerHTML=detalle+resumenSancion+(adv?`<div class="detalle-alerta">⚠ ${esc(adv)}</div>`:"")||"Sin pagos procesados.";
  renderResultadoBeneficio(r);
}


function dvNIT(nit){
  const n=String(nit||"").replace(/\D/g,"");
  if(!n)return "";
  const pad=n.padStart(15,"0");
  const pesos=[71,67,59,53,47,43,41,37,29,23,19,17,13,7,3];
  const suma=[...pad].reduce((a,d,i)=>a+Number(d)*pesos[i],0);
  const r=suma%11;
  return r===0||r===1?String(11-r===10?0:11-r):String(11-r);
}

function descargarBlob(blob,nombre){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=nombre; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}

function xmlEsc(v){
  // XML 1.0 no admite determinados caracteres de control. Se eliminan para
  // evitar que un dato pegado en observaciones invalide el archivo XLSX.
  return String(v??"")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
function xlsxCol(n){let s="";while(n){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;}
function xlsxCell(v,col,row,style=0){
  const ref=xlsxCol(col)+row;
  if(typeof v==="number"&&Number.isFinite(v))return `<c r="${ref}" s="${style}" t="n"><v>${String(v)}</v></c>`;
  const text=xmlEsc(v);
  const preserve=/^\s|\s$/.test(String(v??""))?` xml:space="preserve"`:"";
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t${preserve}>${text}</t></is></c>`;
}
function xlsxSheet(rows,{moneyCols=[],percentCols=[],rowMoneyCols={},rowPercentCols={},titleRows=[0],headerRows=[0],columnWidths=[],mergeRanges=[],landscape=true,fitToWidth=1,fitToHeight=0}={}){
  const safeRows=Array.isArray(rows)?rows:[];
  const lastCol=Math.max(1,...safeRows.map(r=>Array.isArray(r)?r.length:0));
  const lastRow=Math.max(1,safeRows.length);
  const dimension=`A1:${xlsxCol(lastCol)}${lastRow}`;
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
      return xlsxCell(v,j+1,i+1,style);
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

function crc32(bytes){
  let table=crc32.table;if(!table){table=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}crc32.table=table;}
  let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;
}
function u16(v){return new Uint8Array([v&255,(v>>>8)&255]);}
function u32(v){return new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);}
function zipStore(files){
  const enc=new TextEncoder(), chunks=[], central=[];let offset=0;
  for(const f of files){
    const name=enc.encode(f.name),data=typeof f.data==="string"?enc.encode(f.data):f.data;
    const crc=crc32(data),local=new Uint8Array(30+name.length+data.length);let p=0;
    local.set([80,75,3,4],p);p+=4;local.set(u16(20),p);p+=2;local.set(u16(0),p);p+=2;local.set(u16(0),p);p+=2;
    local.set(u16(0),p);p+=2;local.set(u16(0),p);p+=2;local.set(u32(crc),p);p+=4;local.set(u32(data.length),p);p+=4;
    local.set(u32(data.length),p);p+=4;local.set(u16(name.length),p);p+=2;local.set(u16(0),p);p+=2;local.set(name,p);p+=name.length;local.set(data,p);
    chunks.push(local);central.push({name:f.name,data,crc,offset});offset+=local.length;
  }
  const cd=central.map(f=>{
    // ZIP central-directory header: exactly 46 bytes before the filename.
    // The previous exporter wrote one extra 16-bit field, which could make
    // the Uint8Array overflow and produce a corrupt/unopenable XLSX.
    const name=enc.encode(f.name),c=new Uint8Array(46+name.length);let p=0;
    c.set([80,75,1,2],p);p+=4;
    c.set(u16(20),p);p+=2;      // version made by
    c.set(u16(20),p);p+=2;      // version needed
    c.set(u16(0),p);p+=2;       // flags
    c.set(u16(0),p);p+=2;       // compression: stored
    c.set(u16(0),p);p+=2;       // mod time
    c.set(u16(0),p);p+=2;       // mod date
    c.set(u32(f.crc),p);p+=4;
    c.set(u32(f.data.length),p);p+=4;
    c.set(u32(f.data.length),p);p+=4;
    c.set(u16(name.length),p);p+=2;
    c.set(u16(0),p);p+=2;       // extra length
    c.set(u16(0),p);p+=2;       // comment length
    c.set(u16(0),p);p+=2;       // disk number
    c.set(u16(0),p);p+=2;       // internal attributes
    c.set(u32(0),p);p+=4;       // external attributes
    c.set(u32(f.offset),p);p+=4;
    c.set(name,p);
    return c;
  });
  const cdSize=cd.reduce((a,c)=>a+c.length,0),end=new Uint8Array(22);let p=0;
  end.set([80,75,5,6],p);p+=4;end.set(u16(0),p);p+=2;end.set(u16(0),p);p+=2;end.set(u16(files.length),p);p+=2;
  end.set(u16(files.length),p);p+=2;end.set(u32(cdSize),p);p+=4;end.set(u32(offset),p);p+=4;end.set(u16(0),p);
  // Construir un único buffer antes de crear el Blob evita que algunos
  // navegadores/intérpretes conviertan los Uint8Array en texto al empaquetar.
  const totalBytes=offset+cdSize+end.length,all=new Uint8Array(totalBytes);let q=0;
  for(const part of chunks){all.set(part,q);q+=part.length;}
  for(const part of cd){all.set(part,q);q+=part.length;}
  all.set(end,q);
  return new Blob([all.buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}

function construirDatosSoporte(){
  if(!ultimaLiquidacion)throw new Error("Primero debe calcular la liquidación.");
  const d=leerFormulario(),r=ultimaLiquidacion;
  return {d,r};
}

function fechaMasAnosReporte(iso,anios){
  const base=fechaISO(iso)||"";
  if(!base)return "";
  const [y,m,d]=base.slice(0,10).split("-").map(Number);
  if(!y||!m||!d)return "";
  const ultimo=new Date(Date.UTC(y+Number(anios||0),m,0)).getUTCDate();
  return `${y+Number(anios||0)}-${String(m).padStart(2,"0")}-${String(Math.min(d,ultimo)).padStart(2,"0")}`;
}
function fechaMasDiasReporte(iso,dias){
  const base=fechaISO(iso)||"";
  if(!base)return "";
  const d=new Date(`${base}T00:00:00Z`);
  if(Number.isNaN(d.getTime()))return "";
  d.setUTCDate(d.getUTCDate()+Number(dias||0));
  return d.toISOString().slice(0,10);
}
function detalleSuspensionInteresesOficial(x,d){
  const auto=fechaISO(d.fechaAutoAdmisorio)||"";
  const prov=fechaISO(d.fechaProvidenciaDefinitiva)||"";
  const pago=fechaISO(x.pago?.fecha)||"";
  if(!auto||!pago)return [];

  const finDos=fechaMasAnosReporte(auto,2);
  const inicioSusp=fechaMasDiasReporte(finDos,1);
  const finSusp=prov?fechaMasDiasReporte(prov,-1):"";
  const detalleCuotas=Array.isArray(x.interesesPorCuota)?x.interesesPorCuota:[];
  const fuente=detalleCuotas.length?detalleCuotas:[{vto:"GENERAL",capitalBase:x.deudaAntes?.impuesto||0,fechaVencimiento:x.pago?.fecha||"",tramos:Array.isArray(x.tramosInteres)?x.tramosInteres:[]}];

  const salida=[];
  for(const cuota of fuente){
    // El motor oficial ahora expone expresamente `tramos` en cada cuota.
    // También reconstruimos desde tramoInteres1/suspensión/tramoInteres2 para
    // mantener compatibilidad con resultados generados por versiones previas.
    let ts=Array.isArray(cuota.tramos)?cuota.tramos.slice():[];
    if(!ts.length){
      if(Array.isArray(cuota.tramoInteres1))ts.push(...cuota.tramoInteres1);
      if(cuota.tramoSuspension)ts.push(cuota.tramoSuspension);
      if(Array.isArray(cuota.tramoInteres2))ts.push(...cuota.tramoInteres2);
    }
    const susp=ts.find(t=>t.tipo==="SUSPENSION_INTERESES")||null;
    const normales=ts.filter(t=>t.tipo!=="SUSPENSION_INTERESES" && Number.isFinite(Number(t.valor??0)));
    const vto=cuota.fechaVencimiento||normales[0]?.desde||"";
    const vtoTxt=vto||cuota.vto||"GENERAL";

    if(susp){
      const primer=Array.isArray(cuota.tramoInteres1)&&cuota.tramoInteres1.length
        ?cuota.tramoInteres1
        :normales.filter(t=>String(t.desde||"")<inicioSusp);
      const segundo=Array.isArray(cuota.tramoInteres2)&&cuota.tramoInteres2.length
        ?cuota.tramoInteres2
        :normales.filter(t=>String(t.desde||"")>=String(prov||""));
      const interes1=Number(cuota.interes1||0)>0?Number(cuota.interes1):primer.reduce((a,t)=>a+Number(t.valor||0),0);
      const dias1=Number(cuota.diasInteres1||0)>0?Number(cuota.diasInteres1):primer.reduce((a,t)=>a+Number(t.dias||0),0);
      const interes2=Number(cuota.interes2||0)>0?Number(cuota.interes2):segundo.reduce((a,t)=>a+Number(t.valor||0),0);
      const dias2=Number(cuota.diasInteres2||0)>0?Number(cuota.diasInteres2):segundo.reduce((a,t)=>a+Number(t.dias||0),0);
      const tasa1=primer.length?Number(primer[0].tasa??0):0;
      const tasa2=segundo.length?Number(segundo[0].tasa??0):0;
      const diasSusp=Number(cuota.diasSuspension||susp.dias||0);
      salida.push({vto:vtoTxt,cuota:cuota.cuota||"",capitalBase:Number(cuota.capitalBase||0),auto,finDos,inicioSusp,finSusp,prov,pago,
        tramo:"PRIMER TRAMO DE INTERESES",desde:primer[0]?.desde||vto,hasta:finDos,dias:dias1,tasa:tasa1,interes:interes1,estado:"INTERESES CAUSADOS"});
      salida.push({vto:vtoTxt,cuota:cuota.cuota||"",capitalBase:Number(cuota.capitalBase||0),auto,finDos,inicioSusp,finSusp,prov,pago,
        tramo:"SUSPENSIÓN DE INTERESES",desde:inicioSusp,hasta:finSusp||fechaMasDiasReporte(prov,-1)||prov,dias:diasSusp,tasa:null,interes:0,estado:"SIN CAUSACIÓN DE INTERESES"});
      if(segundo.length){
        salida.push({vto:vtoTxt,cuota:cuota.cuota||"",capitalBase:Number(cuota.capitalBase||0),auto,finDos,inicioSusp,finSusp,prov,pago,
          tramo:"SEGUNDO TRAMO DE INTERESES",desde:segundo[0]?.desde||prov,hasta:segundo[segundo.length-1]?.hasta||pago,dias:dias2,tasa:tasa2,interes:interes2,estado:"INTERESES REANUDADOS"});
      }
    }else{
      const interes=Number(cuota.interes||0)>0?Number(cuota.interes):normales.reduce((a,t)=>a+Number(t.valor||0),0);
      const dias=Number(cuota.dias||0)>0?Number(cuota.dias):normales.reduce((a,t)=>a+Number(t.dias||0),0);
      const first=normales[0]||{};
      const last=normales[normales.length-1]||first;
      salida.push({vto:vtoTxt,cuota:cuota.cuota||"",capitalBase:Number(cuota.capitalBase||0),auto,finDos,inicioSusp,finSusp,prov,pago,
        tramo:"INTERESES — SIN SUSPENSIÓN",desde:first.desde||vto,hasta:last.hasta||pago,dias,tasa:first.tasa==null?null:Number(first.tasa),interes,estado:"INTERESES CAUSADOS"});
    }
  }
  return salida;
}
function bloqueSuspensionInteresesPdf(x,d,i){
  const detalles=detalleSuspensionInteresesOficial(x,d);
  if(!detalles.length)return "";
  const t0=detalles[0];
  const susp=detalles.find(t=>t.tramo==="SUSPENSIÓN DE INTERESES");
  const haySusp=!!susp;
  const diasSusp=haySusp?Number(susp.dias||0):0;
  const nota=haySusp
    ? `Auto admisorio: ${fechaVisible(t0.auto)} · cumplimiento de 2 años: ${fechaVisible(t0.finDos)} · suspensión desde: ${fechaVisible(t0.inicioSusp)} · días de suspensión: ${diasSusp} · ejecutoria y reanudación: ${fechaVisible(t0.prov)}.`
    : `No se configura suspensión en este pago. Auto admisorio: ${fechaVisible(t0.auto)} · cumplimiento de 2 años: ${fechaVisible(t0.finDos)} · providencia definitiva: ${fechaVisible(t0.prov)}.`;
  const resumen=`<div class="pdf-suspension-resumen">
    <div><b>AUTO ADMISORIO</b><span>${fechaVisible(t0.auto)}</span></div>
    <div><b>CUMPLE 2 AÑOS</b><span>${fechaVisible(t0.finDos)}</span></div>
    <div><b>INICIO SUSPENSIÓN</b><span>${haySusp?fechaVisible(t0.inicioSusp):"—"}</span></div>
    <div><b>FIN SUSPENSIÓN</b><span>${haySusp?fechaVisible(t0.finSusp):"—"}</span></div>
    <div><b>EJECUTORIA / REANUDACIÓN</b><span>${fechaVisible(t0.prov)}</span></div>
    <div><b>DÍAS SUSPENDIDOS</b><span>${haySusp?diasSusp:0}</span></div>
  </div>`;
  const rows=detalles.map(t=>`<tr>
    <td>${escPdf(t.tramo)}</td><td>${escPdf(fechaVisible(t.desde))}</td><td>${escPdf(fechaVisible(t.hasta))}</td>
    <td>${Number(t.dias||0)}</td><td>${t.tasa==null?"—":(Number(t.tasa)*100).toFixed(3)+"%"}</td><td>${dinero(t.interes||0)}</td><td>${escPdf(t.estado)}</td>
  </tr>`).join("");
  const total=detalles.reduce((a,t)=>a+Number(t.interes||0),0);
  return `<div class="pdf-suspension-intereses"><h3>DESGLOSE DE INTERESES — LIQUIDACIÓN OFICIAL — ART. 634 PARÁGRAFO 2 E.T. — PAGO ${Number(i)+1}</h3><div class="pdf-suspension-descripcion">${escPdf(nota)} Los intereses se causan hasta el cumplimiento de los dos años; desde el día siguiente se suspende su causación hasta la ejecutoria de la providencia definitiva y, cuando corresponde, se reanudan desde dicha ejecutoria hasta el pago.</div>${resumen}<table><thead><tr><th>FASE</th><th>DESDE</th><th>HASTA</th><th>DÍAS</th><th>TASA</th><th>VALOR INTERÉS</th><th>ESTADO</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="5">TOTAL INTERESES CAUSADOS DEL PAGO</th><th>${dinero(total)}</th><th></th></tr></tfoot></table></div>`;
}
function detalleSuspensionInteresesExcel(r,d){
  const filas=[];
  (r.detalle||[]).forEach((x,i)=>{
    const detalles=detalleSuspensionInteresesOficial(x,d);
    if(!detalles.length)return;
    const t0=detalles[0],susp=detalles.find(t=>t.tramo==="SUSPENSIÓN DE INTERESES");
    filas.push([i+1,"CONTROL — AUTO ADMISORIO",t0.auto||"","","","","","FECHA BASE","Fecha de auto admisorio"]);
    filas.push([i+1,"CONTROL — CUMPLE 2 AÑOS",t0.finDos||"","","","","","CORTE DE 2 AÑOS","Fecha de cumplimiento de los dos años"]);
    filas.push([i+1,"CONTROL — INICIO SUSPENSIÓN",susp?.desde||"","","", "", "", susp?"SUSPENSIÓN ACTIVADA":"NO APLICA", "El día siguiente al cumplimiento de los dos años"]);
    filas.push([i+1,"CONTROL — FIN SUSPENSIÓN",susp?.hasta||"","","", "", "", susp?"ÚLTIMO DÍA SIN INTERESES":"NO APLICA", "Día anterior a la ejecutoria"]);
    filas.push([i+1,"CONTROL — EJECUTORIA / REANUDACIÓN",t0.prov||"","","", "", "", "REANUDACIÓN", "Desde esta fecha se retoman los intereses"]);
    filas.push([i+1,"CONTROL — DÍAS SUSPENDIDOS","","",Number(susp?.dias||0),"","",susp?"DÍAS SIN CAUSACIÓN":"0","Total de días suspendidos"]);
    detalles.forEach(t=>{
      filas.push([i+1,t.tramo||"",t.desde||"",t.hasta||"",Number(t.dias||0),t.tasa==null?"":Number(t.tasa)*100,Number(t.interes||0),t.estado||"",t.vto||""]);
    });
    const total=detalles.reduce((a,t)=>a+Number(t.interes||0),0);
    filas.push([i+1,"TOTAL INTERESES DEL PAGO","","","","",total,"TOTAL",""]);
  });
  return filas;
}
function construirDetalleInteresesExport(r){
  const filas=[];
  (r.detalle||[]).forEach((x,i)=>{
    const detalle=Array.isArray(x.interesesPorCuota)?x.interesesPorCuota:[];
    if(detalle.length){
      detalle.forEach(t=>{
        filas.push([
          i+1,
          t.cuota??"",
          t.vto||"",
          Number(t.capitalBase||0),
          t.fechaVencimiento||"",
          t.fechaPago||x.pago?.fecha||"",
          Number(t.dias||0),
          t.tasa==null?"":Number(t.tasa)*100,
          Number(t.interes||0),
          t.metodologia||"",
          t.aplica===false?"NO EXIGIBLE":"INTERÉS CALCULADO"
        ]);
      });
      return;
    }
    // Compatibilidad con resultados anteriores que solo tenían tramos.
    const tramos=Array.isArray(x.tramosInteres)?x.tramosInteres:[];
    if(tramos.length){
      tramos.forEach(t=>{
        filas.push([
          i+1,
          "",
          t.vto||"",
          Number(t.base||0),
          t.desde||"",
          t.hasta||x.pago?.fecha||"",
          Number(t.dias||0),
          t.tasa==null?"":Number(t.tasa)*100,
          Number(t.valor||0),
          t.metodologia||"",
          t.aplica===false?"NO EXIGIBLE":"INTERÉS CALCULADO"
        ]);
      });
    }
  });
  return filas;
}

function filasActualizacionSancionExport(r){
  const filas=[];
  (r.detalle||[]).forEach((x,i)=>{
    const tramos=Array.isArray(x.actualizacionSancion?.tramos)?x.actualizacionSancion.tramos:[];
    tramos.forEach(t=>{
      filas.push([
        i+1,
        x.pago?.fecha||"",
        Number(t.anio||0),
        t.desde||"",
        Number(t.anioInflacion||Number(t.anio||0)-1),
        Number(t.saldoAntes||0),
        Number(t.ipcPorcentaje||0),
        Number(t.actualizacion||0),
        Number(t.saldoDespues||0)
      ]);
    });
  });
  return filas;
}

function bloqueActualizacionSancionPdf(x,i){
  const tramos=Array.isArray(x.actualizacionSancion?.tramos)?x.actualizacionSancion.tramos:[];
  if(!tramos.length)return "";
  const rows=tramos.map(t=>`<tr><td>${escPdf(t.anio)}</td><td>${escPdf(fechaVisible(t.desde))}</td><td>${Number(t.anioInflacion||Number(t.anio||0)-1)}</td><td>${dinero(t.saldoAntes||0)}</td><td>${Number(t.ipcPorcentaje||0).toFixed(3)}%</td><td>${dinero(t.actualizacion||0)}</td><td>${dinero(t.saldoDespues||0)}</td></tr>`).join("");
  const total=tramos.reduce((a,t)=>a+Number(t.actualizacion||0),0);
  return `<div class="pdf-actualizacion-sancion"><h3>ACTUALIZACIÓN DE SANCIÓN — PAGO ${Number(i)+1}</h3><div class="pdf-actualizacion-descripcion">La actualización se aplica el 1 de enero de cada vigencia que corresponda, utilizando el 100 % del IPC del año inmediatamente anterior. No se prorratea por días. La fecha mostrada corresponde a la fecha efectiva de aplicación y el año IPC identifica la inflación utilizada.</div><table><thead><tr><th>AÑO DE ACTUALIZACIÓN</th><th>FECHA DE APLICACIÓN</th><th>AÑO IPC</th><th>VALOR ANTERIOR</th><th>IPC</th><th>ACTUALIZACIÓN</th><th>VALOR DESPUÉS</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="5">TOTAL ACTUALIZACIÓN DE ESTE PAGO</th><th>${dinero(total)}</th><th></th></tr></tfoot></table></div>`;
}

function resumenFinalPdf(r){
  const tramos=[];
  (r.detalle||[]).forEach((x,i)=>{
    (x.actualizacionSancion?.tramos||[]).forEach(t=>tramos.push({pago:i+1,fechaPago:x.pago?.fecha||"",...t}));
  });
  const filas=tramos.length?tramos.map(t=>`<tr><td>${t.pago}</td><td>${escPdf(fechaVisible(t.fechaPago))}</td><td>${t.anio}</td><td>${escPdf(fechaVisible(t.desde))}</td><td>${Number(t.anioInflacion||Number(t.anio||0)-1)}</td><td>${dinero(t.saldoAntes||0)}</td><td>${dinero(t.actualizacion||0)}</td><td>${dinero(t.saldoDespues||0)}</td></tr>`).join(""):"<tr><td colspan='8'>No se realizaron actualizaciones de sanción.</td></tr>";
  const excedentes=(r.detalle||[]).map((x,i)=>({pago:i+1,fecha:x.pago?.fecha||"",valor:Number(x.excedente||x.aplicado?.excedente||0)}));
  const filasExcedentes=excedentes.length?excedentes.map(e=>`<tr><td>${e.pago}</td><td>${escPdf(fechaVisible(e.fecha))}</td><td>${dinero(e.valor)}</td></tr>`).join(""):"<tr><td colspan='3'>No se registraron pagos.</td></tr>";
  const excedenteTotal=excedentes.reduce((a,e)=>a+e.valor,0);
  return `<section class="pdf-hoja"><div class="pdf-pagina"><article class="pdf-liquidacion pdf-resumen-final"><div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">RESUMEN FINAL DE LA LIQUIDACIÓN</div><div class="pdf-generado">Generado: ${fechaVisible(hoyISO())}</div></div><div class="pdf-resumen-grid"><div><b>SALDO TOTAL FINAL</b><strong>${dinero(r.total||0)}</strong></div><div><b>EXCEDENTE TOTAL</b><strong>${dinero(excedenteTotal)}</strong></div><div><b>SANCIÓN FINAL</b><strong>${dinero(r.sancion||0)}</strong></div></div><div class="pdf-actualizacion-sancion"><h3>RESUMEN DE ACTUALIZACIONES DE SANCIÓN</h3><table><thead><tr><th>PAGO</th><th>FECHA PAGO</th><th>AÑO ACTUALIZACIÓN</th><th>FECHA APLICACIÓN</th><th>AÑO IPC</th><th>ANTES</th><th>ACTUALIZACIÓN</th><th>DESPUÉS</th></tr></thead><tbody>${filas}</tbody></table></div><div class="pdf-excedentes-finales"><h3>CONSOLIDACIÓN DE EXCEDENTES POR PAGO</h3><table><thead><tr><th>PAGO</th><th>FECHA DE PAGO</th><th>EXCEDENTE DEL PAGO</th></tr></thead><tbody>${filasExcedentes}</tbody><tfoot><tr><th colspan="2">EXCEDENTE TOTAL — SUMATORIA DE TODOS LOS PAGOS</th><th>${dinero(excedenteTotal)}</th></tr></tfoot></table></div><div class="pdf-nota">Nota: Liquidación sujeta a revisión por las partes interesadas.</div></article></div></section>`;
}

function exportarExcel(){
  try{
    const {d,r}=construirDatosSoporte();
    const nombreBase=`Liquidacion_DIAN_${d.nit||"SIN_NIT"}_${new Date().toISOString().slice(0,10)}`;
    // Excel se entrega como UN SOLO libro con UNA SOLA HOJA. Todas las secciones
    // quedan apiladas verticalmente para facilitar revisión, impresión y archivo.
    const rows=[];
    const rowMoneyCols={}; const rowPercentCols={};
    const titleRows=[]; const headerRows=[];
    const push=(row,{money=[],percent=[],title=false,header=false}={})=>{
      const i=rows.length; rows.push(row);
      if(money.length)rowMoneyCols[i]=money;
      if(percent.length)rowPercentCols[i]=percent;
      if(title)titleRows.push(i);
      if(header)headerRows.push(i);
    };
    push(["LIQUIDADOR DE OBLIGACIONES DIAN"],{title:true});
    push(["SOPORTE DE LIQUIDACIÓN — REAJUSTE 16.32.18"],{title:true});
    push([]);
    push(["NIT",d.nit||"","DV",dvNIT(d.nit),"RAZÓN SOCIAL",d.razonSocial||""]);
    push(["AÑO GRAVABLE",d.anio||"","CONCEPTO",d.concepto||"","PERÍODO",d.periodo||""]);
    push(["FECHA VENCIMIENTO PARA DECLARAR",d.fechaVencimientoDeclarar||""]);
    push(["SALDO TOTAL",r.total||0,"EXCEDENTE",r.excedente||0,"ÚLTIMO PAGO",r.ultimo?.pago?.fecha||"","TASA ÚLTIMO PAGO",r.ultimo?.tasaVisible??""],{money:[2,4],percent:[8]});
    push(["TIPOS DE TASA/BENEFICIO APLICADOS",(r.beneficiosAplicados||[]).join(" | ")||"TASA DIAN"]);
    push(["CRITERIO","La liquidación utiliza exactamente el tipo seleccionado en cada pago; no se valida elegibilidad jurídica."]);
    push([]);

    push(["VENCIMIENTOS DE LA OBLIGACIÓN"],{title:true});
    push(["Nº","PERÍODO","FECHA VENCIMIENTO","IMPUESTO DECLARADO","SALDO"],{header:true});
    r.vencimientos.forEach((v,i)=>push([i+1,v.periodo||i+1,v.fecha,v.impuesto,v.saldo],{money:[4,5]}));
    push([]);

    push(["PAGOS Y APLICACIÓN"],{title:true});
    push(["Nº","TDJ Nº","RECIBO Nº","FECHA PAGO","VALOR PAGO","TIPO","TASA","INTERÉS GENERADO","IMPUESTO APLICADO","INTERESES APLICADOS","SANCIÓN APLICADA","TOTAL APLICADO","EXCEDENTE"],{header:true});
    (r.detalle||[]).forEach((x,i)=>push([i+1,x.pago?.tdj||"",x.pago?.recibo||"",x.pago?.fecha||"",x.pago?.valor||0,x.tipoAplicado||"TASA DIAN",x.tasaVisible??"",x.interesGenerado||0,x.aplicado?.impuesto||0,x.aplicado?.intereses||0,x.aplicado?.sancion||0,x.aplicado?.total||0,x.excedente||0],{money:[5,8,9,10,11,12,13],percent:[7]}));
    push([]);

    push(["DETALLE DE INTERESES POR CUOTA Y POR PAGO"],{title:true});
    push(["PAGO","CUOTA","VENCIMIENTO","CAPITAL BASE","DESDE","HASTA","DÍAS DE MORA","TASA APLICADA","INTERÉS CALCULADO","METODOLOGÍA","SITUACIÓN"],{header:true});
    construirDetalleInteresesExport(r).forEach(row=>push(row,{money:[4,9],percent:[8]}));

    if(String(d.tipoLiquidacion||"").toUpperCase()==="OFICIAL"){
      push([]);
      push(["DESGLOSE DE INTERESES — LIQUIDACIÓN OFICIAL — ART. 634 PARÁGRAFO 2 E.T."],{title:true});
      push(["PAGO","FASE / CONTROL","DESDE","HASTA","DÍAS","TASA","VALOR INTERÉS","ESTADO","DETALLE"],{header:true});
      detalleSuspensionInteresesExcel(r,d).forEach(row=>push(row,{money:[8],percent:[7]}));
      push(["CRITERIO DE SUSPENSIÓN","Los intereses continúan desde el vencimiento hasta el cumplimiento de los dos años contados desde la admisión de la demanda; luego se suspenden hasta la ejecutoria de la providencia definitiva y se reanudan desde esa fecha hasta el pago." ]);
    }

    push([]);
    push(["ACTUALIZACIÓN DE SANCIÓN — ART. 867-1 E.T. — DETALLE POR PAGO"],{title:true});
    let huboActualizacionExcel=false;
    (r.detalle||[]).forEach((x,i)=>{
      const tramos=Array.isArray(x.actualizacionSancion?.tramos)?x.actualizacionSancion.tramos:[];
      if(!tramos.length)return;
      huboActualizacionExcel=true;
      push([`PAGO ${i+1}`,x.pago?.fecha||"",`ACTUALIZACIÓN DE SANCIÓN DEL PAGO ${i+1}`],{title:true});
      push(["AÑO DE ACTUALIZACIÓN","FECHA DE APLICACIÓN","AÑO IPC","VALOR ANTERIOR","IPC","ACTUALIZACIÓN","VALOR DESPUÉS"],{header:true});
      tramos.forEach(t=>push([Number(t.anio||0),t.desde||"",Number(t.anioInflacion||Number(t.anio||0)-1),Number(t.saldoAntes||0),Number(t.ipcPorcentaje||0),Number(t.actualizacion||0),Number(t.saldoDespues||0)],{money:[4,6,7],percent:[5]}));
      const totalAct=tramos.reduce((a,t)=>a+Number(t.actualizacion||0),0);
      push(["TOTAL ACTUALIZACIÓN DEL PAGO ${i+1}","","",0,"",totalAct,0],{money:[4,6,7]});
      push([]);
    });
    if(!huboActualizacionExcel)push(["NO SE REALIZARON ACTUALIZACIONES DE SANCIÓN."]);

    push([]);
    push(["RESUMEN FINAL"],{title:true});
    push(["SALDO TOTAL FINAL",r.total||0,"SANCIÓN FINAL",r.sancion||0],{money:[2,4]});
    push(["CONSOLIDACIÓN DE EXCEDENTES POR PAGO"],{title:true});
    push(["PAGO","FECHA DE PAGO","EXCEDENTE DEL PAGO"],{header:true});
    (r.detalle||[]).forEach((x,i)=>push([i+1,x.pago?.fecha||"",Number(x.excedente||x.aplicado?.excedente||0)],{money:[3]}));
    const excedenteTotalReporte=(r.detalle||[]).reduce((a,x)=>a+Number(x.excedente||x.aplicado?.excedente||0),0);
    push(["EXCEDENTE TOTAL — SUMATORIA DE TODOS LOS PAGOS","",excedenteTotalReporte],{money:[3]});
    push([]);
    push(["OBSERVACIÓN","Los intereses por cuota se calculan sobre capital; la sanción no interviene en este cálculo. La actualización de sanción se aplica el 1 de enero de cada vigencia que corresponda con el IPC anual del año anterior, sin prorrateo por días. Se muestra por pago y se consolida al final."]);
    const fechaGeneracion=new Date().toISOString();
    const files=[
      {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`},
      {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
      {name:"docProps/core.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Liquidación de Obligaciones DIAN</dc:title><dc:creator>Liquidador DIAN</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${fechaGeneracion}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${fechaGeneracion}</dcterms:modified></cp:coreProperties>`},
      {name:"docProps/app.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Liquidador DIAN</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Hojas</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Liquidación completa</vt:lpstr></vt:vector></TitlesOfParts></Properties>`},
      {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="30626"/><workbookPr defaultThemeVersion="164011"/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="18000" windowHeight="12000"/></bookViews><sheets><sheet name="Liquidación completa" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`},
      {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {name:"xl/styles.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="[$$-es-CO] #,##0"/><numFmt numFmtId="165" formatCode="0.000%"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="14"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="DCEAF4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="173F5F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="A8BBC9"/></left><right style="thin"><color rgb="A8BBC9"/></right><top style="thin"><color rgb="A8BBC9"/></top><bottom style="thin"><color rgb="A8BBC9"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="3" borderId="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`},
      {name:"xl/worksheets/sheet1.xml",data:xlsxSheet(rows,{titleRows,headerRows,rowMoneyCols,rowPercentCols,columnWidths:[10,18,30,18,18,12,14,20,28],landscape:true,fitToWidth:1,fitToHeight:0})}
    ];
    descargarBlob(zipStore(files),nombreBase+".xlsx");
    mostrarEstadoExportacion("Excel generado correctamente: un solo libro y una sola hoja, con resumen, vencimientos, pagos y detalle de intereses por cuota y por cada pago. La sanción no interviene en el cálculo del interés.");
  }catch(e){console.error(e);alert(e.message||"No fue posible generar el Excel.");}
}

function escPdf(v){return esc(v);}
function tablaInteresesPdf(x,r){
  if(r.vencimientos.length<=1)return "";
  const detalle=Array.isArray(x.interesesPorCuota)?x.interesesPorCuota:[];
  const filas=detalle.length?detalle:[];
  let rows="";
  if(filas.length){
    rows=filas.map(t=>`<tr><td>${escPdf(t.cuota??"")}</td><td>${dinero(t.capitalBase||0)}</td><td>${escPdf(fechaVisible(t.fechaVencimiento||""))}</td><td>${escPdf(fechaVisible(t.fechaPago||x.pago.fecha||""))}</td><td>${Number(t.dias||0)}</td><td>${t.tasa==null?"—":(Number(t.tasa)*100).toFixed(3)+"%"}</td><td>${dinero(t.interes||0)}</td></tr>`).join("");
  }else{
    rows=r.vencimientos.map(v=>`<tr><td>${escPdf(v.numero||"")}</td><td>${dinero(0)}</td><td>${escPdf(fechaVisible(v.fecha||""))}</td><td>${escPdf(fechaVisible(x.pago.fecha||""))}</td><td>0</td><td>${Number(x.tasaVisible||0).toFixed(3)}%</td><td>${dinero(0)}</td></tr>`).join("");
  }
  const total=filas.length
    ?filas.reduce((a,t)=>a+Number(t.interes||0),0)
    :Number(x.interesGenerado||0);
  return `<div class="pdf-intereses"><h3>CÁLCULO DE INTERESES POR CUOTA</h3><table><thead><tr><th>CUOTA</th><th>CAPITAL BASE</th><th>FECHA VENCIMIENTO</th><th>FECHA PAGO</th><th>DÍAS</th><th>TASA</th><th>INTERÉS</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="6">TOTAL INTERESES DEL PAGO</th><th>${dinero(total)}</th></tr></tfoot></table></div>`;
}

function bloquePdfPago(x,i,d,r){
  /*
   * REAJUSTE 16.32.5 — PDF / aplicación por vencimiento.
   * Un vencimiento que ya quedó totalmente cancelado en un pago anterior
   * no debe volver a aparecer en las aplicaciones posteriores.
   *
   * La regla se aplica únicamente a la representación del PDF: no modifica
   * la trazabilidad ni los saldos internos del motor.
   */
  const vencimientosCanceladosAntes=new Set();
  for(const previo of (r.detalle||[]).slice(0,i)){
    for(const a of (previo.aplicacionesVto||[])){
      const aplicadoPrevio=Number(a.aplicado||0)+Number(a.aplicadoIntereses||0)+Number(a.aplicadoSancion||0);
      const saldoPrevio=Number(a.saldo||0);
      if(aplicadoPrevio>0 && saldoPrevio<=0) vencimientosCanceladosAntes.add(a.id);
    }
  }

  const vtos=(x.aplicacionesVto||[])
    .filter(a=>!vencimientosCanceladosAntes.has(a.id))
    .filter(a=>Number(a.aplicado||0)>0 || Number(a.aplicadoIntereses||0)>0 || Number(a.aplicadoSancion||0)>0 || Number(a.saldo||0)>0)
    .map(a=>{const v=r.vencimientos.find(z=>z.id===a.id);return {id:a.id,fecha:v?.fecha||"",aplicado:a.aplicado||0,saldo:a.saldo||0};});
  const impuestoBase=x.deudaAntes?.impuesto||0;
  const vtoPrincipal=vtos[0]||{};
  const rows=vtos.length?vtos.map(v=>`<tr><td>${escPdf(v.id)}</td><td>${escPdf(fechaVisible(v.fecha))}</td><td>${dinero(v.aplicado)}</td><td>${dinero(v.saldo)}</td></tr>`).join(""):"<tr><td colspan='4'>Sin aplicación por vencimiento</td></tr>";
  return `<article class="pdf-liquidacion"><div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">LIQUIDADOR OBLIGACIONES<div>DETALLE DEL PAGO</div></div><div class="pdf-generado">Generado: ${fechaVisible(hoyISO())}</div></div>
  <div class="pdf-datos"><div class="pdf-dato"><b>AÑO</b><strong>${escPdf(d.anio)}</strong></div><div class="pdf-dato"><b>CONCEPTO</b><strong>${escPdf(d.concepto)}</strong></div><div class="pdf-dato"><b>PERÍODO</b><strong>${escPdf(d.periodo)}</strong></div><div class="pdf-dato"><b>NIT</b><strong>${escPdf(d.nit)}</strong></div><div class="pdf-dato"><b>D.V.</b><strong>${escPdf(dvNIT(d.nit))}</strong></div><div class="pdf-dato ancho-2"><b>RAZÓN SOCIAL</b><strong>${escPdf(d.razonSocial)}</strong></div><div class="pdf-dato"><b>TIPO DE LIQUIDACIÓN</b><strong>${escPdf(d.tipoLiquidacion||"")}</strong></div><div class="pdf-dato"><b>FECHA AUTO ADMISORIO</b><strong>${escPdf(fechaVisible(d.fechaAutoAdmisorio))}</strong></div><div class="pdf-dato"><b>FECHA PROVIDENCIA DEFINITIVA</b><strong>${escPdf(fechaVisible(d.fechaProvidenciaDefinitiva))}</strong></div><div class="pdf-dato ancho-2"><b>FECHA VENCIMIENTO PARA DECLARAR</b><strong>${escPdf(fechaVisible(d.fechaVencimientoDeclarar))}</strong></div><div class="pdf-dato"><b>TASA A APLICAR</b><strong class="pdf-tasa">${x.tasaVisible==null?"—":Number(x.tasaVisible).toFixed(3)+"%"}</strong></div></div>
  <div class="pdf-obligacion"><div class="pdf-fila"><div class="pdf-celda"><b>VALOR IMPUESTO / DEUDA</b><strong>${dinero(impuestoBase)}</strong></div><div class="pdf-celda"><b>FECHA VENCIMIENTO</b><strong>${escPdf(fechaVisible(vtoPrincipal.fecha||r.vencimientos[0]?.fecha||""))}</strong></div><div class="pdf-celda"><b>FECHA PREVISTA DE PAGO</b><strong>${escPdf(fechaVisible(x.pago.fecha))}</strong></div><div class="pdf-celda"><b>¿TIENE SANCIÓN?</b><strong>${escPdf(d.tieneSancion)}</strong></div></div><div class="pdf-fila"><div class="pdf-celda pdf-observaciones" style="grid-column:span 4"><b>OBSERVACIONES</b><strong>${escPdf(x.pago.observacion||`PAGO N°${i+1} — ${x.pago.tipo||"TASA DIAN"}`)}</strong></div></div></div>
  <div class="pdf-beneficio"><b>TIPO DE TASA/BENEFICIO:</b> ${escPdf(x.tipoAplicado||"TASA DIAN")} · ${escPdf(x.notaBeneficio||"TASA DIAN ordinaria")}</div>
  ${tablaInteresesPdf(x,r)}
  ${String(d.tipoLiquidacion||"").toUpperCase()==="OFICIAL"?bloqueSuspensionInteresesPdf(x,d,i):""}
  ${bloqueActualizacionSancionPdf(x,i)}
  <div class="pdf-pago"><div class="pdf-pago-titulo">VALOR PAGO &nbsp; → &nbsp; ${dinero(x.pago.valor)}</div><table class="pdf-tabla"><thead><tr><th>CONCEPTO</th><th>DEUDA</th><th>PROPORCIÓN / APLICADO</th><th>SALDOS</th></tr></thead><tbody><tr><td>Impuesto</td><td>${dinero(x.deudaAntes?.impuesto)}</td><td>${dinero(x.aplicado?.impuesto)}</td><td>${dinero(x.saldo?.impuesto)}</td></tr><tr><td>Intereses</td><td>${dinero(x.deudaAntes?.intereses)}</td><td>${dinero(x.aplicado?.intereses)}</td><td>${dinero(x.saldo?.intereses)}</td></tr><tr><td>Sanción</td><td>${dinero(x.deudaAntes?.sancion)}</td><td>${dinero(x.aplicado?.sancion)}</td><td>${dinero(x.saldo?.sancion)}</td></tr><tr class="total"><td>TOTALES</td><td>${dinero((x.deudaAntes?.impuesto||0)+(x.deudaAntes?.intereses||0)+(x.deudaAntes?.sancion||0))}</td><td>${dinero(x.aplicado?.total)}</td><td>${dinero(x.saldo?.total)}</td></tr></tbody></table>${Number(x.excedente||x.aplicado?.excedente||0)>0?`<div class="pdf-excedente"><b>EXCEDENTE:</b> ${dinero(x.excedente??x.aplicado.excedente)}</div>`:""}</div>
  <div class="pdf-aplicaciones"><h3>APLICACIÓN DEL PAGO POR VENCIMIENTO</h3><table><thead><tr><th>VENCIMIENTO</th><th>FECHA</th><th>IMPUESTO APLICADO</th><th>SALDO DEL VENCIMIENTO</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="pdf-nota">Nota: Liquidación sujeta a revisión por las partes interesadas.</div></article>`;
}
function estilosPdf(){
  return `
  @page{size:A4 portrait;margin:22mm}
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
  .pdf-tasa{font-size:11pt!important}
  .pdf-obligacion{margin:2mm;border:1px solid #8da6b7}
  .pdf-fila{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;border-bottom:1px solid #aebdc7}
  .pdf-fila:last-child{border-bottom:0}
  .pdf-celda{padding:1.5mm 1.5mm;border-right:1px solid #aebdc7}
  .pdf-celda:last-child{border-right:0}
  .pdf-celda b{display:block;font-size:8pt;color:#50697b;margin-bottom:.5mm}
  .pdf-celda strong{font-size:11pt}
  .pdf-observaciones{min-height:8mm}
  .pdf-beneficio{margin:1.5mm 2mm;padding:1.5mm;border:1px solid #9fb4c5;background:#eef5f9;font-size:9pt;color:#17324a;white-space:nowrap;overflow:hidden}
  .pdf-intereses{margin:1.5mm 2mm;border:1px solid #8da6b7;break-inside:avoid;page-break-inside:avoid}
  .pdf-intereses h3{margin:0;padding:1.5mm;background:#dceaf4;color:#17324d;font-size:11pt}
  .pdf-intereses table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-intereses th,.pdf-intereses td{border:1px solid #b4c4cf;padding:1.25mm;text-align:right;font-size:9pt;line-height:1.05;white-space:nowrap}
  .pdf-intereses th:first-child,.pdf-intereses td:first-child{text-align:center}
  .pdf-intereses thead th{background:#eef4f8;font-size:8.5pt}
  .pdf-intereses tfoot th{background:#e8f1f6;font-weight:700;font-size:9pt}
  .pdf-suspension-intereses{margin:1.5mm 2mm;border:1px solid #8da6b7;break-inside:avoid;page-break-inside:avoid}
  .pdf-suspension-intereses h3{font-size:9.5pt;margin:0;padding:1.25mm;background:#dceaf4;color:#17324d}
  .pdf-suspension-descripcion{padding:1.1mm 1.5mm;font-size:7.8pt;line-height:1.1;background:#f8fbfc;border-bottom:1px solid #b7c4cc}
  .pdf-suspension-resumen{display:grid;grid-template-columns:repeat(3,1fr);gap:1mm;padding:1.2mm;background:#fff}
  .pdf-suspension-resumen>div{border:1px solid #c4d1d9;padding:1mm;background:#f5f9fb;min-height:7mm}
  .pdf-suspension-resumen b{display:block;font-size:6.2pt;color:#17324d;margin-bottom:.5mm}
  .pdf-suspension-resumen span{display:block;font-size:8pt;font-weight:700;color:#1f3344}
  .pdf-suspension-intereses table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-suspension-intereses th,.pdf-suspension-intereses td{border:1px solid #b7c4cc;padding:1.05mm;font-size:7.5pt;line-height:1.05;text-align:right;white-space:nowrap}
  .pdf-suspension-intereses th:first-child,.pdf-suspension-intereses td:first-child{text-align:left}
  .pdf-suspension-intereses thead th{background:#eef4f8;font-size:7pt}
  .pdf-suspension-intereses tfoot th{background:#e8f1f6;font-weight:700}
  .pdf-pago{margin:1.5mm 2mm 0;border:1px solid #78a2bc}
  .pdf-pago-titulo{text-align:center;font-weight:700;font-size:11pt;padding:1.5mm;background:#e8f1f6;border-bottom:1px solid #78a2bc}
  .pdf-tabla{width:100%;border-collapse:collapse}
  .pdf-tabla th,.pdf-tabla td{border:1px solid #8da6b7;padding:1.25mm;text-align:right;font-size:9pt;line-height:1.05}
  .pdf-tabla th{font-size:8.5pt;background:#e9eff3}
  .pdf-tabla td:first-child,.pdf-tabla th:first-child{text-align:left}
  .pdf-tabla .total td{font-weight:700;background:#edf3f6}
  .pdf-aplicaciones{margin:1.5mm 2mm;border:1px solid #9db1bf}
  .pdf-aplicaciones h3{font-size:9.5pt;margin:0;padding:1.25mm;background:#edf3f6}
  .pdf-aplicaciones table{width:100%;border-collapse:collapse}
  .pdf-aplicaciones th,.pdf-aplicaciones td{border:1px solid #b7c4cc;padding:1.1mm;font-size:8.5pt;line-height:1.05}
  .pdf-nota{text-align:center;font-weight:700;padding:1mm;font-size:8pt}
  .pdf-excedente{margin:1.5mm 2mm;padding:1.25mm 1.5mm;border:1px solid #c58a1a;background:#fff6d8;color:#7a5200;font-size:9pt}
  .pdf-actualizacion-sancion{margin:1.5mm 2mm;border:1px solid #8da6b7;break-inside:avoid;page-break-inside:avoid}
  .pdf-actualizacion-sancion h3{font-size:9.5pt;margin:0;padding:1.25mm;background:#edf3f6}
  .pdf-actualizacion-sancion table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-actualizacion-sancion th,.pdf-actualizacion-sancion td{border:1px solid #b7c4cc;padding:1mm;font-size:7.5pt;line-height:1.02;text-align:right;white-space:nowrap}
  .pdf-actualizacion-sancion th:first-child,.pdf-actualizacion-sancion td:first-child{text-align:center}
  .pdf-actualizacion-sancion thead th{background:#eef4f8;font-size:7.2pt}
  .pdf-actualizacion-sancion tfoot th{background:#e8f1f6;font-weight:700}
  .pdf-actualizacion-descripcion{padding:1mm 1.5mm;font-size:7.5pt;line-height:1.05;background:#f8fbfc;border-bottom:1px solid #b7c4cc}
  .pdf-excedentes-finales{margin:2mm;border:1px solid #c58a1a;break-inside:avoid;page-break-inside:avoid}
  .pdf-excedentes-finales h3{font-size:9.5pt;margin:0;padding:1.25mm;background:#fff6d8;color:#7a5200}
  .pdf-excedentes-finales table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-excedentes-finales th,.pdf-excedentes-finales td{border:1px solid #c9a45a;padding:1mm;font-size:8pt;line-height:1.02;text-align:right;white-space:nowrap}
  .pdf-excedentes-finales th:first-child,.pdf-excedentes-finales td:first-child{text-align:center}
  .pdf-excedentes-finales thead th{background:#fff9e8}
  .pdf-excedentes-finales tfoot th{background:#fff0c2;font-weight:700}
  .pdf-resumen-final{overflow:hidden}
  .pdf-resumen-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin:3mm 2mm}
  .pdf-resumen-grid>div{border:1px solid #8da6b7;padding:3mm;text-align:center;background:#eef5f9}
  .pdf-resumen-grid b{display:block;font-size:8pt;margin-bottom:1mm}
  .pdf-resumen-grid strong{font-size:13pt}
  .pdf-excedente-final{margin:3mm 2mm;padding:3mm;border:1px solid #c58a1a;background:#fff6d8;color:#7a5200;font-size:12pt}
  .pdf-excedente-final span{font-size:9pt}
  .pdf-alerta{margin:2mm;padding:1.5mm;border:1px solid #d2a84a;background:#fff8df;font-size:10pt}
  @media print{
    html,body{width:210mm;background:#fff!important}
    .pdf-soporte{display:block!important;width:100%!important}
    .pdf-hoja{display:block!important;width:100%!important;height:246.2mm!important;min-height:246.2mm!important;page-break-after:always!important;break-after:page!important}
    .pdf-hoja:last-child{page-break-after:auto!important;break-after:auto!important}
    .pdf-pagina{display:block!important;width:100%!important;height:100%!important}
    .pdf-liquidacion{display:block!important;visibility:visible!important;width:100%!important;height:100%!important}
  }`;
}

function exportarPdf(){
  try{
    const {d,r}=construirDatosSoporte();
    const win=window.open("","_blank","width=1200,height=1000");
    if(!win)throw new Error("El navegador bloqueó la ventana del soporte PDF. Permita ventanas emergentes para este formulario.");
    const bloques=r.detalle||[];
    const paginas=[];
    // Una liquidación completa por hoja. Esto permite conservar en la misma página
    // el cálculo de intereses por cuota y la aplicación del pago por vencimiento.
    for(let i=0;i<bloques.length;i++){
      paginas.push(`<section class="pdf-hoja"><div class="pdf-pagina">${bloquePdfPago(bloques[i],i,d,r)}</div></section>`);
    }
    const resumenFinal=resumenFinalPdf(r);
    const advertencias=(r.advertencias||[]).length?`<section class="pdf-hoja pdf-hoja-advertencias"><div class="pdf-pagina"><div class='pdf-alerta'><b>Advertencias:</b> ${escPdf([...new Set(r.advertencias)].join(" | "))}</div></div></section>`:"";
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Soporte Liquidación DIAN</title><style>${estilosPdf()}</style></head><body><main class="pdf-soporte">${paginas.join("")||"<div class='pdf-alerta'>No hay pagos procesados.</div>"}${resumenFinal}${advertencias}</main></body></html>`);
    win.document.close();
    const imprimir=()=>setTimeout(()=>{try{win.focus();win.print();}catch(e){console.error(e);}},700);
    if(win.document.readyState==="complete")imprimir();else win.addEventListener("load",imprimir,{once:true});
    mostrarEstadoExportacion("Soporte PDF preparado: una liquidación por hoja, con cálculo de intereses por cuota y aplicación completa del pago por vencimiento.");
  }catch(e){console.error(e);alert(e.message||"No fue posible generar el PDF.");}
}

function mostrarEstadoExportacion(texto){const el=$("estadoExportacion");if(el){el.hidden=false;el.textContent=texto;}}

function construirAuditoria(){
  if(!auditoria)return null;
  const d=leerFormulario();
  const validacion=motor?.validarObligacion(d)||null;
  const norm=normativoHistorico?.evaluar(d)||null;
  return auditoria.construir({datos:d,validacion,normativo:norm,depuracion:null,determinacion:null,liquidacion:ultimaLiquidacion});
}
function renderAuditoria(){
  const box=$("resultadoAuditoria"),a=construirAuditoria();if(!a)return;
  ultimaAuditoria=a;
  const pasos=(a.pasos||[]).map(p=>`<div class="audit-step"><strong>${esc(p.id)} · ${esc(p.nombre)}</strong><span class="audit-badge-ok">${esc(p.estado||"")}</span>${p.advertencias?.length?`<small>⚠ ${esc(p.advertencias.join(" | "))}</small>`:""}</div>`).join("");
  box.innerHTML=`<div class="audit-cabecera"><div><span>Estado</span><strong>${esc(a.estado)}</strong></div><div><span>Identificador</span><strong>${esc(a.identificador)}</strong></div></div><div class="audit-pasos">${pasos}</div>`;
}

function normalizarTipoBeneficioVigencia(v){
  return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
}

function obtenerVentanasBeneficios(){
  return [
    {clave:"ART. 20 DECRETO 1474 DE 2025",desde:"2025-12-30",hasta:"2026-03-31",nombre:"ART. 20 DEL DECRETO 1474 DE 2025"},
    {clave:"ART. 21 DECRETO 1474 DE 2025",desde:"2025-12-30",hasta:"2026-04-30",nombre:"ART. 21 DEL DECRETO 1474 DE 2025"},
    {clave:"ART. 3 DECRETO 0240 DE 2026",desde:"2026-03-12",hasta:"2026-04-30",nombre:"ART. 3 DEL DECRETO 0240 DE 2026"},
    {clave:"ART. 4 DECRETO 0240 DE 2026",desde:"2026-03-12",hasta:"2026-04-30",nombre:"ART. 4 DEL DECRETO 0240 DE 2026"}
  ];
}

function validarVigenciaBeneficiosUI(d){
  const ventanas=obtenerVentanasBeneficios();
  const tipos=[...(d.pagos||[])].map(p=>normalizarTipoBeneficioVigencia(p.tipo));
  const seleccionados=ventanas.filter(v=>tipos.some(t=>t.includes(v.clave)));
  const errores=[];
  for(const v of seleccionados){
    const esArt20o3 = v.clave === "ART. 20 DECRETO 1474 DE 2025"
      || v.clave === "ART. 3 DECRETO 0240 DE 2026";
    const fs=fechaISO(d.fechaSancion)||"";
    if(!esArt20o3){
      if(!fs){
        errores.push(`Para seleccionar ${v.nombre} debe registrar la fecha de sanción/presentación.`);
      }else if(fs<v.desde||fs>v.hasta){
        errores.push(`La fecha de sanción/presentación (${fechaVisible(fs)}) está fuera de la vigencia de ${v.nombre}. Vigencia permitida: ${fechaVisible(v.desde)} a ${fechaVisible(v.hasta)}.`);
      }
    }
    (d.pagos||[]).forEach((p,i)=>{
      const t=normalizarTipoBeneficioVigencia(p.tipo);
      if(!t.includes(v.clave))return;
      const fp=fechaISO(p.fecha)||"";
      if(!fp){
        errores.push(`El pago ${i+1}, seleccionado con ${v.nombre}, debe tener fecha de pago.`);
      }else if(fp<v.desde||fp>v.hasta){
        errores.push(`El pago ${i+1} (${fechaVisible(fp)}) seleccionado con ${v.nombre} está fuera de la vigencia. Vigencia permitida: ${fechaVisible(v.desde)} a ${fechaVisible(v.hasta)}.`);
      }
    });
  }
  return errores;
}

function calcular(){
  try{
    const d=leerFormulario();
    if(!d.tipoLiquidacion)throw new Error("Seleccione el tipo de liquidación: PRIVADA u OFICIAL.");
    if(!["PRIVADA","OFICIAL"].includes(d.tipoLiquidacion))throw new Error("El tipo de liquidación debe ser PRIVADA u OFICIAL.");
    // Los datos generales de la obligación (NIT, año, concepto, período y razón social)
    // son informativos y no bloquean la liquidación. El único dato obligatorio
    // de esta sección es indicar si existe sanción. Para una liquidación
    // matemática debe existir al menos un vencimiento con fecha e impuesto.
    if(!d.tieneSancion)throw new Error("Debe indicar si la obligación tiene sanción.");
    if(!d.vencimientos.length)throw new Error("Debe registrar al menos un vencimiento con fecha e impuesto declarado.");
    const erroresVigencia=validarVigenciaBeneficiosUI(d);
    if(erroresVigencia.length){
      throw new Error("NO SE PUEDE CONTINUAR CON LA LIQUIDACIÓN:\n\n"+erroresVigencia.join("\n\n"));
    }
    const valid=motor.validarObligacion(d);
    if(valid.errores.length)throw new Error(valid.errores.join(" "));
    const r=motor.calcular(d);
    ultimaLiquidacion=r;
    pintarInforme(r);
    renderVencimientos();
    renderAuditoria();
    $("estadoSistema").textContent=`Liquidación procesada: ${r.detalle.length} pago(s)`;
  }catch(e){console.error(e);alert(e.message||"No fue posible calcular la liquidación.");}
}

function limpiar(){
  pagos=[];obligacionVencimientos=[];ultimaLiquidacion=null;ultimaAuditoria=null;
  // El botón LIMPIAR inicia una obligación completamente nueva.
  // Es importante reiniciar también el estado auxiliar de sanción y el
  // estado usado por las pestañas: HTMLFormElement.reset() o limpiar
  // valores no restablece por sí solo la propiedad disabled de los controles.
  // Esto evita que una obligación anterior deje bloqueados los campos de sanción.
  estadoSancionUI={tiene:"",valor:"",fecha:"",origen:"",beneficio:""};
  const sancion=$("tieneSancion");
  if(sancion){sancion.value="";delete sancion.dataset.tabValue;}
  document.querySelectorAll("input,select,textarea").forEach(el=>{
    if(el.id==="tieneSancion"){el.value="";delete el.dataset.tabValue;}
    else if(el.tagName==="SELECT")el.selectedIndex=0;
    else if(!el.readOnly)el.value="";
  });
  // Estado inicial: el funcionario puede elegir SI o NO. Al elegir SI,
  // habilitarSancion() libera inmediatamente los campos de captura.
  ["valorSancion","fechaSancion","beneficioSancion"].forEach(id=>{
    const el=$(id);
    if(el)el.disabled=true;
  });
  if($("sancionMinima"))$("sancionMinima").value="";
  renderMetadatosConcepto();renderVencimientos();renderPagos();habilitarSancion();renderCalendario();renderBeneficio();$("resultadoAuditoria").innerHTML="";$("detalleCalculo").innerHTML="";
  ["rDeudaImpuesto","rDeudaIntereses","rDeudaSancion","rPropImpuesto","rPropIntereses","rPropSancion","rSaldoImpuesto","rSaldoIntereses","rSaldoSancion","rDeudaTotal","rPropTotal","rSaldoTotal","rSaldoTotalFooter"].forEach(id=>$(id).textContent=dinero(0));
  $("rFechaPago").textContent="—";$("rTasa").textContent="—";
  if($("rExcedenteBox")){$("rExcedenteBox").hidden=true;$("rExcedente").textContent=dinero(0);}
}

function aplicarImportacion(obj){
  if(obj.nit)$("nit").value=String(obj.nit).replace(/\D/g,"");
  if(obj.razonSocial)$("razonSocial").value=upper(obj.razonSocial);
  if(obj.tipoLiquidacion&&$("tipoLiquidacion")){
    const tipoImportado=upper(obj.tipoLiquidacion);
    $("tipoLiquidacion").value=tipoImportado.includes("OFICIAL")?"OFICIAL":tipoImportado.includes("PRIVADA")?"PRIVADA":"";
  }
  actualizarCamposTipoLiquidacion();
  if(obj.fechaAutoAdmisorio&&$("fechaAutoAdmisorio")){const iso=fechaISO(obj.fechaAutoAdmisorio);$("fechaAutoAdmisorio").value=fechaVisible(iso);if($("fechaAutoAdmisorioPicker"))$("fechaAutoAdmisorioPicker").value=iso;}
  if(obj.fechaProvidenciaDefinitiva&&$("fechaProvidenciaDefinitiva")){const iso=fechaISO(obj.fechaProvidenciaDefinitiva);$("fechaProvidenciaDefinitiva").value=fechaVisible(iso);if($("fechaProvidenciaDefinitivaPicker"))$("fechaProvidenciaDefinitivaPicker").value=iso;}
  if(obj.anio)$("anio").value=obj.anio;
  if(obj.concepto)$("concepto").value=upper(obj.concepto);
  if(obj.periodo)$("periodo").value=obj.periodo;

  if(obj.tieneSancion)$("tieneSancion").value=upper(obj.tieneSancion)==="SI"?"SI":"NO";
  if(obj.valorSancion)$("valorSancion").value=dinero(obj.valorSancion);
  if(obj.fechaSancion){const iso=fechaISO(obj.fechaSancion);$("fechaSancion").value=fechaVisible(iso);if($("fechaSancionPicker"))$("fechaSancionPicker").value=iso;}
  if(obj.beneficioSancion)$("beneficioSancion").value=upper(obj.beneficioSancion);
  if(obj.beneficioTributario&&$("beneficioTributario"))$("beneficioTributario").value=upper(obj.beneficioTributario);
  if(obj.fechaActuacionBeneficio&&$("fechaActuacionBeneficio"))$("fechaActuacionBeneficio").value=fechaVisible(obj.fechaActuacionBeneficio);
  if(obj.fechaDeclaracionOriginal&&$("fechaDeclaracionOriginal"))$("fechaDeclaracionOriginal").value=fechaVisible(obj.fechaDeclaracionOriginal);
  if(obj.obligacionFormalCumplida&&$("obligacionFormalCumplida"))$("obligacionFormalCumplida").value=upper(obj.obligacionFormalCumplida);
  if(obj.aceptaGlosas&&$("aceptaGlosas"))$("aceptaGlosas").value=upper(obj.aceptaGlosas);
  if(obj.informaDian&&$("informaDian"))$("informaDian").value=upper(obj.informaDian);
  if(obj.resolucionReconsideracion&&$("resolucionReconsideracion"))$("resolucionReconsideracion").value=upper(obj.resolucionReconsideracion);
  if(obj.vencimientos?.length)obligacionVencimientos=obj.vencimientos.map((v,i)=>({...v,id:v.id||`VTO-${v.numero||i+1}`,numero:Number(v.numero||i+1),periodo:v.periodo??(i+1),fecha:fechaISO(v.fecha)||"",impuesto:Number(v.impuesto||0)}));
  if(obj.pagos?.length)pagos=[...pagos,...obj.pagos];
  renderMetadatosConcepto();renderVencimientos();renderPagos();habilitarSancion();renderCalendario();renderBeneficio();
  $("estadoSistema").textContent=`Importación aplicada: ${obj.pagos?.length||0} pago(s), ${obj.vencimientos?.length||0} vencimiento(s)`;
}

function aplicarImportacionObligacion(obj){
  if(obj.nit)$("nit").value=String(obj.nit).replace(/\D/g,"");
  if(obj.razonSocial)$("razonSocial").value=upper(obj.razonSocial);
  if(obj.cuotas?.length){
    const existentes=new Map(obligacionVencimientos.map(v=>[Number(v.numero),v]));
    for(const c of obj.cuotas){
      const n=Math.min(N,Math.max(1,Number(c.numero||1)));
      let x=existentes.get(n);
      if(!x){x={id:`VTO-${n}`,numero:n,periodo:n,fecha:"",impuesto:0};obligacionVencimientos.push(x);existentes.set(n,x);}
      if(c.fecha)x.fecha=fechaISO(c.fecha)||x.fecha;
      if(Number(c.impuesto)>0)x.impuesto=Number(c.impuesto);
      if(c.periodo!=null)x.periodo=String(c.periodo);
    }
    obligacionVencimientos.sort((a,b)=>Number(a.numero)-Number(b.numero));
  }
  renderVencimientos();renderCalendario();
  const r=$("resultadoImportacionObligacion");
  if(r){
    const partes=[];
    if(obj.nit)partes.push(`<strong>NIT:</strong> ${esc(obj.nit)}`);
    if(obj.razonSocial)partes.push(`<strong>Razón social:</strong> ${esc(obj.razonSocial)}`);
    partes.push(`<strong>Cuotas reconocidas:</strong> ${obj.cuotas?.length||0}`);
    if(obj.advertencias?.length)partes.push(`<span class="importacion-alerta">⚠ ${esc(obj.advertencias.join(" | "))}</span>`);
    r.innerHTML=partes.join(" · ");r.hidden=false;
  }
  $("estadoSistema").textContent=`Datos ubicados: ${obj.cuotas?.length||0} cuota(s)`;
}


function configurarBase(){
  ["razonSocial"].forEach(id=>$(id).addEventListener("input",e=>{const pos=e.target.selectionStart;e.target.value=e.target.value.toUpperCase();try{e.target.setSelectionRange(pos,pos)}catch{}}));
  $("nit").addEventListener("input",e=>{e.target.value=e.target.value.replace(/\D/g,"");renderCalendario();});
  $("anio").addEventListener("input",e=>{e.target.value=e.target.value.replace(/\D/g,"");habilitarSancion();actualizarSancionMinimaUI();renderCalendario();});
  $("concepto").addEventListener("change",()=>{renderMetadatosConcepto();renderVencimientos();renderCalendario();});
  $("periodo").addEventListener("change",renderCalendario);
  $("tipoLiquidacion").addEventListener("change",()=>{seleccionarMotorPorTipo();actualizarCamposTipoLiquidacion();actualizarSancionMinimaUI();});
  $("tieneSancion").addEventListener("change",()=>{estadoSancionUI.tiene=$("tieneSancion").value;habilitarSancion();});
  $("valorSancion").addEventListener("input",()=>{estadoSancionUI.valor=$("valorSancion").value;});
  $("valorSancion").addEventListener("blur",()=>{dineroCampo("valorSancion");capturarSancionUI();});
  $("fechaSancion").addEventListener("blur",()=>{fechaCampo("fechaSancion");capturarSancionUI();actualizarSancionMinimaUI();});
  $("beneficioSancion").addEventListener("change",()=>{capturarSancionUI();actualizarSancionMinimaUI();});
  sincronizarFechaDual("fechaSancion","fechaSancionPicker",()=>{});
  sincronizarFechaDual("fechaAutoAdmisorio","fechaAutoAdmisorioPicker",()=>{});
  sincronizarFechaDual("fechaProvidenciaDefinitiva","fechaProvidenciaDefinitivaPicker",()=>{});
  actualizarCamposTipoLiquidacion();
  $("btnCalcular").addEventListener("click",calcular);
  $("btnLimpiar").addEventListener("click",limpiar);
  $("btnAgregarPago").addEventListener("click",()=>agregarPago());
  $("btnCalcularVencimiento").addEventListener("click",renderCalendario);
  $("btnGenerarAuditoria").addEventListener("click",renderAuditoria);
  $("btnExportarExcel").addEventListener("click",exportarExcel);
  $("btnExportarPdf").addEventListener("click",exportarPdf);
  $("btnGuardarTasa").addEventListener("click",guardarTasaManual);
  $("btnGuardarIPC")?.addEventListener("click",guardarIPCManual);
  $("btnActualizarTasaDian").addEventListener("click",actualizarDesdeDIAN);
  $("btnIniciarAdmin")?.addEventListener("click",iniciarSesionAdmin);
  $("btnCerrarAdmin")?.addEventListener("click",cerrarSesionAdmin);
  $("btnProcesarPegado").addEventListener("click",()=>{try{aplicarImportacion(importarDatosInteligente($("pegarDatos").value));$("pegarDatos").value="";}catch(e){alert(e.message);}});
  $("btnImportar").addEventListener("click",()=>$("archivoImportacion").click());
  $("archivoImportacion").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{aplicarImportacion(importarDatosInteligente(await f.text()));}catch(err){alert(err.message);}e.target.value="";});

  $("btnProcesarDatosObligacion").addEventListener("click",()=>{
    try{
      const obj=importarDatosObligacionInteligente($("pegarDatosObligacion").value);
      aplicarImportacionObligacion(obj);
      $("pegarDatosObligacion").value="";
    }catch(e){alert(e.message||"No pude reconocer los datos de la obligación.");}
  });
}

if(typeof window!=="undefined"){
  // Mantener el estado de sesión cuando Supabase renueva/refresca la sesión.
  // No hay credenciales privadas en el navegador.
}

window.addEventListener("DOMContentLoaded",async()=>{
  try{
    configurarBase();
    await cargarDatos();
    renderMetadatosConcepto();renderVencimientos();renderPagos();habilitarSancion();renderCalendario();renderBeneficio();renderTasasPersonalizadas();renderIPC();mensajeActualizacionesPendientes();
  }catch(e){
    console.error(e);
    $("estadoSistema").textContent="Error cargando parámetros";
    $("estadoSistema").classList.add("error");
    alert("No se pudieron cargar los parámetros históricos. Verifique que el proyecto se esté ejecutando mediante un servidor local.");
  }
});
