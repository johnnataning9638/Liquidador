import {fechaISO,fechaVisible,dinero} from './utilidades.js?v=16.33.122';

export function esConsultaBeneficio(p){
  const tipo=String(p?.tipo||'').trim().toUpperCase();
  return Boolean(fechaISO(p?.fecha))&&Number(p?.valor||0)===0&&Boolean(tipo)&&!['TASA DIAN','FECHA DE CORTE'].includes(tipo);
}
export function requiereProyeccionBeneficio(datos){
  return !datos?._sinProyecciones276&&(datos?.pagos||[]).some(esConsultaBeneficio);
}
export function calcularConProyeccionesBeneficio(motor,datos){
  const originales=datos.pagos||[],fechaCorte=motor.resolverFechaCorte(datos);
  // El resultado contable se procesa únicamente con movimientos efectivos.
  // Cada consulta se calcula por separado con los pagos anteriores a su fecha.
  const resultado=motor.calcular({...datos,_sinProyecciones276:true,fechaCorte,pagos:originales.filter(p=>!esConsultaBeneficio(p))});
  const consultas=originales.map((p,i)=>({p,i})).filter(({p})=>esConsultaBeneficio(p)&&(!fechaCorte||fechaISO(p.fecha)<=fechaCorte));
  const proyeccionesBeneficio=consultas.map(({p,i})=>{
    const fecha=fechaISO(p.fecha),tipo=String(p.tipo).trim();
    const base={fila:i+1,fecha,tipo,valor:0,aplicado:{impuesto:0,intereses:0,sancion:0,total:0},excedente:0,esProyeccion:true};
    const anteriores=originales.filter((q,j)=>Number(q?.valor||0)>0&&(fechaISO(q.fecha)<fecha||(fechaISO(q.fecha)===fecha&&j<i)));
    const consulta={...p,id:`CONSULTA-276-${i}`,fecha,valor:0,tdj:'',esTDJ:false,esConsultaBeneficio276:true};
    try{
      const tratamiento=motor.tasaEspecial(tipo,fecha,{vencimientos:motor.normalizarVencimientos(datos),valorPago:0});
      if(tratamiento.nota==='TASA DIAN ordinaria')throw Error('El beneficio seleccionado no tiene una regla de cálculo disponible. No se sustituye por TASA DIAN.');
      const escenario=motor.calcular({...datos,_sinProyecciones276:true,fechaCorte:fecha,pagos:[...anteriores,consulta]});
      const detalle=escenario.detalle.find(x=>x.pago?.esConsultaBeneficio276);
      if(!detalle)throw Error('No fue posible determinar la proyección con el beneficio seleccionado.');
      if((detalle.tramosInteres||[]).some(x=>x.valor===null||x.metodologia==='BENEFICIO_REQUIERE_IBC'))throw Error('Faltan tasas históricas para determinar el valor con el beneficio seleccionado.');
      if((escenario.advertencias||[]).some(x=>String(x).includes('No existe IPC cargado')))throw Error('Falta IPC histórico para actualizar la sanción de esta proyección.');
      const deuda=detalle.deudaAntes;
      const impuesto=Number(deuda.impuesto||0),intereses=Number(deuda.intereses||0),sancion=Number(deuda.sancion||0);
      return {...base,disponible:true,impuesto,intereses,sancion,total:impuesto+intereses+sancion,tasaVisible:detalle.tasaVisible,nota:detalle.notaBeneficio||'',actualizacionSancion:detalle.actualizacionSancion,interesesPorCuota:detalle.interesesPorCuota||[],advertencias:escenario.advertencias||[]};
    }catch(e){return {...base,disponible:false,impuesto:null,intereses:null,sancion:null,total:null,advertencias:[e.message||'No fue posible calcular esta proyección.']};}
  });
  return {...resultado,proyeccionesBeneficio};
}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
export function htmlProyeccionesBeneficio(proyecciones=[],titulo='Cuánto pagar con el beneficio'){
  if(!proyecciones.length)return '';
  return `<section class="proyeccion-beneficio-276" style="margin:12px 0;padding:12px;border:1px solid #a8c8db;background:#f3f8fc;break-inside:avoid"><h3>${esc(titulo)}</h3><p>Consulta sin abono: muestra cuánto tendría que pagar en la fecha indicada. Valor aplicado: $ 0. El saldo contable se conserva.</p>${proyecciones.map(q=>`<div style="margin:8px 0"><strong>${esc(fechaVisible(q.fecha))} — ${esc(q.tipo)}</strong>${q.disponible?`<table style="width:100%;border-collapse:collapse"><thead><tr><th>IMPUESTO</th><th>INTERESES</th><th>SANCIÓN</th><th>TOTAL A PAGAR CON BENEFICIO</th><th>APLICADO</th></tr></thead><tbody><tr>${[q.impuesto,q.intereses,q.sancion,q.total,0].map(v=>`<td style="padding:5px;text-align:right">${dinero(v)}</td>`).join('')}</tr></tbody></table>`:`<p>No disponible: ${esc((q.advertencias||[]).join(' | '))}</p>`}</div>`).join('')}</section>`;
}
export function pintarProyeccionesBeneficio(destino,proyecciones=[],titulo){
  const host=document.getElementById(destino);if(host)host.innerHTML=htmlProyeccionesBeneficio(proyecciones,titulo);
}
export function filasProyeccionesBeneficio(proyecciones=[]){
  if(!proyecciones.length)return [];
  return [[],['CUÁNTO PAGAR CON EL BENEFICIO — CONSULTA SIN ABONO'],['FECHA','BENEFICIO','IMPUESTO','INTERESES','SANCIÓN','TOTAL A PAGAR CON BENEFICIO','APLICADO','ESTADO'],...proyecciones.map(q=>[q.fecha,q.tipo,q.impuesto,q.intereses,q.sancion,q.total,0,q.disponible?'CONSULTA SIN ABONO':(q.advertencias||[]).join(' | ')])];
}
