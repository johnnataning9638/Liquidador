import {fechaISO} from './utilidades.js?v=16.33.122';

export function esConsultaBeneficio(p){
  const tipo=String(p?.tipo||'').trim().toUpperCase();
  return Boolean(fechaISO(p?.fecha))&&Number(p?.valor||0)===0&&Boolean(tipo)&&!['TASA DIAN','FECHA DE CORTE'].includes(tipo);
}
export function requiereProyeccionBeneficio(datos){
  return !datos?._sinProyecciones276&&(datos?.pagos||[]).some(esConsultaBeneficio);
}
export function calcularConProyeccionesBeneficio(motor,datos){
  const originales=(datos.pagos||[]).map((p,i)=>({...p,_ordenConsulta277:i}));
  const fechaCorte=motor.resolverFechaCorte(datos);
  const vigentes=originales.filter(p=>fechaISO(p.fecha)&&(!fechaCorte||fechaISO(p.fecha)<=fechaCorte));
  const reales=originales.filter(p=>!esConsultaBeneficio(p));
  const orden=(a,b)=>fechaISO(a.fecha).localeCompare(fechaISO(b.fecha))||a._ordenConsulta277-b._ordenConsulta277;
  const consultas=vigentes.filter(esConsultaBeneficio).sort(orden);
  const ultimoMovimiento=vigentes.filter(p=>Number(p.valor||0)>0||esConsultaBeneficio(p)).sort(orden).at(-1);
  let resultado=motor.calcular({...datos,_sinProyecciones276:true,fechaCorte,pagos:reales});
  const detallesConsulta=[];
  for(const p of consultas){
    const fecha=fechaISO(p.fecha),tipo=String(p.tipo).trim();
    const tratamiento=motor.tasaEspecial(tipo,fecha,{vencimientos:motor.normalizarVencimientos(datos),valorPago:0});
    if(tratamiento.nota==='TASA DIAN ordinaria')throw Error('El beneficio seleccionado no tiene una regla de cálculo disponible.');
    // Las consultas anteriores no reducen otra vez la sanción ni cambian pagos reales.
    const anteriores=reales.filter(q=>Number(q.valor||0)>0&&orden(q,p)<0);
    const consulta={...p,id:p.id||`CONSULTA-277-${p._ordenConsulta277}`,fecha,valor:0,tdj:'',esTDJ:false,esConsultaBeneficio276:true};
    const esFinal=p===ultimoMovimiento;
    const escenario=motor.calcular({...datos,_sinProyecciones276:true,fechaCorte:esFinal?fechaCorte:fecha,pagos:[...anteriores,consulta]});
    const detalle=escenario.detalle.find(x=>x.pago?.esConsultaBeneficio276);
    if(!detalle)throw Error('No fue posible determinar la liquidación con el beneficio seleccionado.');
    if((detalle.tramosInteres||[]).some(x=>x.valor===null||x.metodologia==='BENEFICIO_REQUIERE_IBC'))throw Error('Faltan tasas históricas para determinar el valor con el beneficio seleccionado.');
    if((escenario.advertencias||[]).some(x=>String(x).includes('No existe IPC cargado')))throw Error('Falta IPC histórico para actualizar la sanción de esta proyección.');
    detallesConsulta.push(detalle);
    if(esFinal)resultado=escenario;
  }
  const detalle=[...(resultado.detalle||[]).filter(x=>!x.pago?.esConsultaBeneficio276),...detallesConsulta].sort((a,b)=>orden(a.pago,b.pago));
  // El mismo resultado alimenta el cuadro principal, los indicadores y los soportes.
  return {...resultado,detalle,ultimo:resultado.ultimo?.esFechaCorte?resultado.ultimo:detalle.at(-1)||resultado.ultimo};
}
