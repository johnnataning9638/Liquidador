// Consulta independiente: no importa motores ni modifica pagos, tasas o selecciones.
const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const fechaVisible=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):v||'';
const hoyColombia=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota'}).format(new Date());
function efectoRegistrado(b){
 const partes=[];
 if(b.efectoInteresAnual!=null)partes.push(`Interés: ${Number((b.efectoInteresAnual*100).toFixed(3)).toLocaleString('es-CO')}% anual.`);
 else if(b.efectoInteresFactorIBC!=null)partes.push(`Interés al ${Math.round(b.efectoInteresFactorIBC*100)}% del IBC.`);
 else if(b.efectoTasaFactor!=null||b.efectoInteresFactor!=null)partes.push(`Interés al ${Math.round((b.efectoTasaFactor??b.efectoInteresFactor)*100)}%.`);
 if(b.efectoSancionFactor!=null)partes.push(`Sanción al ${Math.round(b.efectoSancionFactor*100)}%.`);
 return partes.join(' ')||b.formula||'Consultar condiciones del beneficio registrado.';
}
export function crearCatalogo(registro,opciones=[],hoy=hoyColombia()){
 const filas=[],conocidos=new Set(['tasa dian','seleccione...','']);
 for(const b of registro){
  conocidos.add(normalizar(b.nombre));
  const ficha=b.consulta||{};
  const inicioReferencia=(ficha.variantes||[]).map(v=>v.desde).filter(f=>/^\d{4}-\d{2}-\d{2}$/.test(f||'')).sort()[0]||'';
  for(const alias of ficha.aliases||[])conocidos.add(normalizar(alias));
  for(const [i,detalle] of (ficha.variantes||[ficha]).entries()){
   const desde=detalle.desde??b.vigenciaDesde??'',hasta=detalle.hasta??b.fechaPagoHasta??b.fechaSuspension??'';
   const activacion=detalle.activacion||(b.seleccion?.startsWith('AUTOMATICA')?'Automático':'Seleccionable');
   const vigente=Boolean(desde&&hasta&&desde<=hoy&&hoy<=hasta&&!b.estado?.startsWith('HISTORICO'));
   const periodo=detalle.periodo||(desde||hasta?`${fechaVisible(desde)||'Inicio por documentar'} – ${fechaVisible(hasta)||'Sin fecha final registrada'}`:'Período pendiente de documentar');
   filas.push({id:detalle.id||b.id+(i?'-'+i:''),norma:detalle.norma||b.nombre,
    beneficio:detalle.beneficio||efectoRegistrado(b),aplica:detalle.aplica||['Según norma'],activacion,
    desde,hasta,periodo,fechaOrden:desde||inicioReferencia,condiciones:detalle.condiciones||b.condiciones||['Condiciones pendientes de documentar.'],
    fuente:detalle.fuente||b.fuente||'Fuente pendiente de documentar',url:detalle.url||b.fuente_url||'',
    grupo:vigente?'actuales':activacion==='Automático'?'automaticos':'historicos',vigente});
  }
 }
 // Red de protección: toda opción nueva de pago también aparece aunque falte su ficha.
 for(const opcion of new Set(opciones)){
  if(conocidos.has(normalizar(opcion)))continue;
  filas.push({id:'opcion-'+normalizar(opcion),norma:opcion,beneficio:'Consultar condiciones del tratamiento.',
   aplica:['Según norma'],activacion:'Seleccionable',periodo:'Período pendiente de documentar',desde:'',hasta:'',
   condiciones:['Ficha informativa pendiente de completar en el registro de beneficios.'],
   fuente:'Opción disponible en el liquidador',url:'',grupo:'historicos',vigente:false});
 }
 return filas.sort((a,b)=>(b.fechaOrden||'').localeCompare(a.fechaOrden||''));
}
export function filtrarCatalogo(filas,busqueda='',filtro='todos'){
 const q=normalizar(busqueda);
 return filas.filter(r=>(!q||normalizar([r.norma,r.beneficio,r.periodo,r.activacion,...r.aplica,...r.condiciones].join(' ')).includes(q))&&
  (filtro==='todos'||(filtro==='automaticos'?r.activacion==='Automático':filtro==='historicos'?!r.vigente:r.aplica.some(a=>normalizar(a).includes(filtro==='correccion'?'correccion':filtro==='omisos'?'omiso':'mora')))));
}
function elemento(tag,clase,texto){
 const el=document.createElement(tag);if(clase)el.className=clase;if(texto!=null)el.textContent=texto;return el;
}
function enlaceSeguro(valor){
 try{const u=new URL(valor);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function instalarCatalogo(){
 const boton=document.getElementById('btnBeneficios');if(!boton||document.getElementById('catalogoBeneficios'))return;
 const dialog=elemento('dialog','beneficios-dialog');dialog.id='catalogoBeneficios';
 dialog.setAttribute('aria-labelledby','beneficiosTitulo');dialog.setAttribute('aria-describedby','beneficiosDescripcion');
 const cabecera=elemento('div','beneficios-cabecera'),titulos=elemento('div');
 const titulo=elemento('h2',null,'Beneficios incluidos en el liquidador');titulo.id='beneficiosTitulo';
 const descripcion=elemento('p',null,'Consulta común para DIAN y TDJ · Del más reciente al más antiguo');descripcion.id='beneficiosDescripcion';
 titulos.append(titulo,descripcion);
 const cerrar=elemento('button','beneficios-cerrar','×');cerrar.type='button';cerrar.setAttribute('aria-label','Cerrar consulta de beneficios');
 cabecera.append(titulos,cerrar);
 const aviso=elemento('p','beneficios-aviso','Incluye los tratamientos incorporados en esta herramienta. Consulta el período y las condiciones de cada caso.');
 const controles=elemento('div','beneficios-controles');
 const etiqueta=elemento('label','beneficios-buscador','Buscar por norma, beneficio o período');
 const buscar=elemento('input');buscar.type='search';buscar.placeholder='Buscar por norma, beneficio o período…';buscar.id='buscarBeneficios';etiqueta.append(buscar);
 const filtros=elemento('div','beneficios-filtros');filtros.setAttribute('role','group');filtros.setAttribute('aria-label','Filtrar beneficios');
 let filtro='todos',filas=[],registro=[],cargado=false,solicitud=0;
 const estado=elemento('p','beneficios-estado');estado.setAttribute('role','status');estado.setAttribute('aria-live','polite');
 const reintentar=elemento('button','beneficios-reintentar','Reintentar carga');reintentar.type='button';reintentar.hidden=true;
 const scroll=elemento('div','beneficios-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Tabla de beneficios; desplazamiento horizontal y vertical');
 const tabla=elemento('table','beneficios-tabla'),caption=elemento('caption','beneficios-solo-lector','Beneficios incorporados y sus condiciones de aplicación');
 const thead=elemento('thead'),head=elemento('tr');
 for(const t of ['Norma y artículo','Beneficio incorporado','Aplica / Activación','Período y condiciones']){const th=elemento('th',null,t);th.scope='col';if(t==='Período y condiciones'){th.setAttribute('aria-sort','descending');th.title='Orden por fecha de inicio: más reciente primero';}head.append(th);}
 thead.append(head);const tbody=elemento('tbody');tabla.append(caption,thead,tbody);scroll.append(tabla);
 const pie=elemento('div','beneficios-pie');
 pie.append(elemento('p',null,'IBC: interés bancario corriente · TIM: tasa de interés moratoria.'),elemento('p',null,'La activación matemática no sustituye la verificación de requisitos legales.'));
 controles.append(etiqueta,filtros,estado,reintentar);dialog.append(cabecera,aviso,controles,scroll,pie);document.body.append(dialog);
 const opcionesActuales=()=>[...document.querySelectorAll('select[data-k="tipo"] option,select[data-p="tipo"] option,.tdj-beneficio-select option')].map(o=>o.value).filter(Boolean);
 function pintar(){
  filas=crearCatalogo(registro,opcionesActuales());const visibles=filtrarCatalogo(filas,buscar.value,filtro);tbody.replaceChildren();
  if(!cargado)return;
  estado.textContent=`${visibles.length} de ${filas.length} tratamientos · Consulta al ${fechaVisible(hoyColombia())}`;
  for(const r of visibles){
    const tr=elemento('tr');tr.dataset.beneficioId=r.id;
    const norma=elemento('td'),nombreNorma=elemento('span','beneficios-norma',r.norma);norma.append(nombreNorma);
    const detalles=elemento('details','beneficios-detalles'),summary=elemento('summary',null,'Ver condiciones');detalles.append(summary);
    const ul=elemento('ul');for(const c of r.condiciones)ul.append(elemento('li',null,c));detalles.append(ul,elemento('p',null,r.fuente));
    const url=enlaceSeguro(r.url);if(url){const a=elemento('a',null,'Consultar fuente oficial ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';detalles.append(a);}
    norma.append(detalles);
    const aplica=elemento('td');aplica.append(elemento('span',null,r.aplica.join(' y ')),elemento('span','beneficios-modo'+(r.activacion==='Automático'?' beneficios-auto':''),r.activacion));
    const periodo=elemento('td');periodo.append(elemento('span',null,r.periodo));
    if(r.condiciones[0])periodo.append(elemento('p','beneficios-condicion',r.condiciones[0]));
    tr.append(norma,elemento('td',null,r.beneficio),aplica,periodo);tbody.append(tr);
  }
  if(!visibles.length){const tr=elemento('tr'),td=elemento('td','beneficios-vacio','No hay beneficios que coincidan con la búsqueda.');td.colSpan=4;tr.append(td);tbody.append(tr);}
 }
 for(const [clave,texto] of [['todos','Todos'],['mora','Mora'],['omisos','Omisos'],['correccion','Corrección'],['automaticos','Automáticos'],['historicos','Históricos']]){
  const b=elemento('button',null,texto);b.type='button';b.dataset.filtro=clave;b.setAttribute('aria-pressed',String(clave===filtro));
  b.addEventListener('click',()=>{filtro=clave;for(const x of filtros.children)x.setAttribute('aria-pressed',String(x===b));pintar();scroll.scrollTop=0;});filtros.append(b);
 }
 async function cargar(){
  const actual=++solicitud;estado.textContent='Cargando catálogo de beneficios…';reintentar.hidden=true;controles.setAttribute('aria-busy','true');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
   const respuesta=await fetch(new URL('../datos/beneficios.json',import.meta.url),{cache:'no-store',signal:controller.signal});
   if(!respuesta.ok)throw Error('HTTP '+respuesta.status);
   const datos=await respuesta.json();if(!Array.isArray(datos)||datos.some(b=>!b||!b.id||!b.nombre))throw Error('Registro inválido');
   if(actual!==solicitud)return;registro=datos;cargado=true;pintar();
  }catch{
   if(actual!==solicitud)return;
   estado.textContent=cargado?'No se pudo actualizar el catálogo. Se conserva la última consulta cargada; reintenta para obtener la versión actual.':'No se pudo cargar el catálogo de beneficios. Revisa la conexión y vuelve a intentarlo.';
   reintentar.hidden=false;
  }finally{clearTimeout(timeout);if(actual===solicitud)controles.removeAttribute('aria-busy');}
 }
 buscar.addEventListener('input',pintar);reintentar.addEventListener('click',cargar);
 cerrar.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{boton.setAttribute('aria-expanded','false');document.body.classList.remove('beneficios-abiertos');boton.focus({preventScroll:true});});
 boton.addEventListener('click',()=>{
  buscar.value='';filtro='todos';
  for(const b of filtros.children)b.setAttribute('aria-pressed',String(b.dataset.filtro==='todos'));
  pintar();scroll.scrollTop=0;scroll.scrollLeft=0;
  dialog.showModal();document.body.classList.add('beneficios-abiertos');boton.setAttribute('aria-expanded','true');buscar.focus({preventScroll:true});cargar();
 });
}
if(typeof document!=='undefined')instalarCatalogo();
