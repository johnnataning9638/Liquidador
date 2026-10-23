// Ruta optativa para documentos de UNA obligación DIAN ordinaria de dos cuotas.
// No modifica el motor compartido ni intenta deducir identidad de observaciones.
const text=v=>String(v??'').trim().toUpperCase();
const number=v=>Math.max(0,Number(v||0));
const components=['impuesto','intereses','sancion'];
const total=x=>components.reduce((s,k)=>s+number(x[k]),0);
const key=p=>`${text(p.recibo)}|${p.fecha}`;
const activePayments=o=>(o.pagos||[]).filter(p=>number(p.valor)>0);
const error=message=>{throw new Error(`RECIBO COMPARTIDO: ${message}`);};

function validarGrupo(os,motor){
 const first=os[0],identity=o=>[text(o.concepto),Number(o.anio),text(o.periodo)].join('|');
 const docs=new Set(),ids=new Set();
 for(const o of os){
  if(!o.id||ids.has(o.id))error('identificador de captura ausente o duplicado.');ids.add(o.id);
  if(!text(o.documentoFuente)||docs.has(text(o.documentoFuente)))error('registre documentos fuente distintos.');docs.add(text(o.documentoFuente));
  if(o.vencimientos?.length!==2)error('esta ruta requiere exactamente dos cuotas por documento.');
  if(!text(o.concepto)||!Number(o.anio)||!text(o.periodo)||identity(o)!==identity(first))error('los documentos deben tener el mismo impuesto, año y período.');
  const rule=motor.reglaObligacion(o.concepto);
  if(/SIMPLE/.test(text(o.concepto)+' '+text(rule?.familia)))error('el régimen SIMPLE conserva su ruta actual.');
  if(text(o.tipoLiquidacion)!=='PRIVADA')error('solo se admiten liquidaciones privadas.');
  if(text(o.__corteRecibo)!==text(first.__corteRecibo))error('los documentos deben usar la misma fecha de corte.');
  if(text(o.tipoTasa)!=='TASA DIAN'||!['','NINGUNO'].includes(text(o.beneficioTributario))||text(o.beneficioSancion)==='CON BENEFICIO')error('los beneficios conservan su ruta actual.');
  if(JSON.stringify(o.vencimientos.map(v=>v.fecha).sort())!==JSON.stringify(first.vencimientos.map(v=>v.fecha).sort()))error('los documentos deben compartir las fechas de sus dos cuotas.');
  const payments=activePayments(o),seen=new Set(),paymentIds=new Set();
  for(const p of payments){
   if(p.esTDJ||text(p.tdj))error('los TDJ conservan su ruta actual.');
   if(text(p.tipo)!=='TASA DIAN')error('los pagos con beneficio conservan su ruta actual.');
   if(!p.id||!text(p.recibo)||!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)||!Number.isSafeInteger(p.valor))error('cada pago requiere identificador, recibo, fecha y valor entero.');
   if(paymentIds.has(p.id))error('hay identificadores de pago duplicados.');paymentIds.add(p.id);
   if(seen.has(key(p)))error('hay dos fracciones del mismo recibo y fecha en un documento.');seen.add(key(p));
   if(o.vencimientos.some(v=>v.fecha>=p.fecha))error('las dos cuotas deben estar vencidas al aplicar el recibo.');
  }
 }
}

function calcularDocumento(motor,datos,planes){
 // Cada reproducción usa una instancia nueva; nunca parchea el singleton TDJ.
 const instance=new motor.constructor(motor);
 const original=instance.aplicarProporcionalidad;
 instance.aplicarProporcionalidad=function(valor,deuda){
  const ctx=this._tdjSancionContext;
  const pago=ctx?.proporcionalidadPagos?.[ctx.proporcionalidadIndex||0];
  const plan=planes.get(pago?.id);
  const saldoPrevio=ctx?.sancionSaldoInicial;
  const legacy=original.call(this,valor,deuda);
  if(!plan)return legacy;
  if(plan.total>valor||components.some(k=>number(plan[k])>number(k==='sancion'?Math.max(deuda[k]||0,saldoPrevio||0):deuda[k])))error('la imputación supera el pago o el saldo disponible.');
  if(ctx)ctx.sancionSaldoInicial=Math.max(0,number(saldoPrevio)-plan.sancion);
  return {...plan};
 };
 const r=instance.calcular(datos);
 for(const d of r.detalle||[]){
  const plan=planes.get(d.pago?.id);if(!plan)continue;
  if(components.some(k=>d.aplicado[k]!==plan[k]))error('el motor no conservó los componentes del recibo.');
  d.imputacionConjunta=plan.traza;
  // La sanción del documento pertenece a su primera cuota en esta ruta.
  if(plan.sancion>0){
   for(const a of d.aplicacionesVto||[])a.aplicadoSancion=0;
   const first=datos.vencimientos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha))[0];
   let a=d.aplicacionesVto.find(x=>x.id===first.id);
   if(!a){a={id:first.id,aplicado:0,aplicadoIntereses:0,saldo:r.vencimientos.find(v=>v.id===first.id)?.saldo||0};d.aplicacionesVto.push(a);}
   a.aplicadoSancion=plan.sancion;
   d.aplicacionesVto=d.aplicacionesVto.filter(x=>number(x.aplicado)+number(x.aplicadoIntereses)+number(x.aplicadoSancion)>0);
  }
 }
 return r;
}

export function calcularRecibosCompartidos(obligaciones,{motor,datosMotor}){
 const groups=new Map(),resultados=new Map();
 for(const o of obligaciones){
  const id=text(o.obligacionDIAN);if(!id)continue;
  if(!groups.has(id))groups.set(id,[]);groups.get(id).push(o);
 }
 for(const [obligacionDIAN,os] of groups){
  if(os.length<2)continue;
  validarGrupo(os,motor);
  const ordered=os.slice().sort((a,b)=>number(a.numero)-number(b.numero)||text(a.documentoFuente).localeCompare(text(b.documentoFuente)));
  const events=new Map(),plans=new Map(os.map(o=>[o.id,new Map()]));
  for(const o of ordered)for(const p of activePayments(o)){
   if(!events.has(key(p)))events.set(key(p),[]);events.get(key(p)).push({o,p});
  }
  let applied=false;
  const history=new Map(os.map(o=>[o.id,[]]));
  for(const entries of [...events.values()].sort((a,b)=>a[0].p.fecha.localeCompare(b[0].p.fecha))){
   if(entries.length>1){
    applied=true;
    const snapshots=entries.map(({o,p})=>{
     const data=datosMotor(o,[...history.get(o.id),p],p.fecha);
     const r=calcularDocumento(motor,data,plans.get(o.id));
     const d=r.detalle.find(d=>d.pago.id===p.id);
     if(!d||d.tramosInteres?.some(t=>t.advertencia))error('faltan tasas o detalle de la deuda antes del pago.');
     return {o,p,d};
    });
    // Los documentos cubiertos íntegramente se cancelan antes de repartir el resto.
    // Conserva la secuencia reconocimiento -> pago -> aplicación del excedente.
    const pending=snapshots.filter(x=>x.p.valor<total(x.d.deudaAntes));
    for(const x of snapshots.filter(x=>!pending.includes(x))){
     if(x.p.valor!==total(x.d.deudaAntes))error('una fracción totalmente cubierta contiene un excedente; registre su traslado explícito.');
    }
    if(pending.length){
     const debt=Object.fromEntries(components.map(k=>[k,pending.reduce((s,x)=>s+number(x.d.deudaAntes[k]),0)]));
     const value=pending.reduce((s,x)=>s+x.p.valor,0);
     // La instancia sin contexto usa la misma fórmula de redondeo vigente.
     const proportion=new motor.constructor(motor).aplicarProporcionalidad(value,debt);
     const budget=Object.fromEntries(components.map(k=>[k,proportion[k]]));
     const allocated=new Map(pending.map(x=>[x.o.id,{impuesto:0,intereses:0,sancion:0}]));
     // Primero la cuota más antigua de cada documento; luego la segunda cuota.
     const slots=pending.flatMap((x,order)=>(x.d.interesesPorCuota||[]).map((v,i)=>({x,v,order,i})))
      .sort((a,b)=>a.v.fechaVencimiento.localeCompare(b.v.fechaVencimiento)||a.order-b.order||a.i-b.i);
     for(const {x,v,i} of slots){
      const capacity={impuesto:number(v.capitalBase),intereses:number(v.interes),sancion:i===0?number(x.d.deudaAntes.sancion):0};
      const dest=allocated.get(x.o.id);
      for(const k of components){const amount=Math.min(budget[k],capacity[k]);dest[k]+=amount;budget[k]-=amount;}
     }
     if(components.some(k=>budget[k]!==0))error('no fue posible asignar todos los componentes a sus cuotas.');
     for(const x of pending){
      const a=allocated.get(x.o.id),sum=total(a);
      if(sum!==x.p.valor)error(`la fracción del recibo ${x.p.recibo} en el documento ${x.o.documentoFuente} debe ser $${sum}; se capturó $${x.p.valor}.`);
      plans.get(x.o.id).set(x.p.id,{...a,total:sum,excedente:0,porcentaje:proportion.porcentaje,tipoProporcion:'RECIBO COMPARTIDO - DOS CUOTAS',traza:{obligacionDIAN,recibo:x.p.recibo,fecha:x.p.fecha,pagoGlobal:value,deudaGlobal:debt,porcentaje:proportion.porcentaje,aplicadoGlobal:Object.fromEntries(components.map(k=>[k,proportion[k]]))}});
     }
    }
   }
   for(const {o,p} of entries)history.get(o.id).push(p);
  }
  if(applied)for(const o of os)resultados.set(o.id,calcularDocumento(motor,datosMotor(o),plans.get(o.id)));
 }
 return resultados;
}
