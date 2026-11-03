// Contrato exclusivo de importación. No calcula intereses, sanciones ni beneficios.
export const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
export function fechaISO(v){
 let s=String(v??'').trim(),m=s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
 if(m)s=`${m[3]}-${m[2]}-${m[1]}`;
 if(/^\d{8}$/.test(s))s=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Fecha ausente o inválida en la fuente.');
 const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Fecha no válida en la fuente.');return s;
}
export function pesos(v){
 if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<0)throw Error('Valor monetario no válido.');return v;}
 const s=String(v??'').replace(/\bCOP\b|\$|\s/g,'');
 if(!/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(s))throw Error('Importe ausente, negativo o ambiguo en la fuente.');
 const n=Number(s.replace(/[.,]/g,''));if(!Number.isSafeInteger(n))throw Error('Importe fuera de rango.');return n;
}
export function conceptoDIAN(v){
 const s=normalizar(v);
 if(s==='RENTA CREE'||s.includes('EQUIDAD CREE'))return 'RENTA CREE';
 if(s.includes('RETENCION')&&s.includes('CREE'))return 'RETENCIÓN CREE';
 if(s==='RETENCION'||s==='RETEFUENTE'||s.includes('RETENCION EN LA FUENTE'))return 'RETENCIÓN';
 if(s==='RENTA'||s.includes('RENTA Y COMPLEMENT'))return 'RENTA';
 if(s==='IVA'||s==='VENTAS'||s.includes('IMPUESTO SOBRE LAS VENTAS'))return 'VENTAS';
 if(s==='CONSUMO'||s.includes('IMPUESTO NACIONAL AL CONSUMO'))return 'CONSUMO';
 for(const k of ['PATRIMONIO','RIQUEZA','GMF','SIMPLE','SANCION'])if(s===k||s.includes('IMPUESTO AL '+k))return k==='SANCION'?'SANCION':k;
 throw Error('El tipo de impuesto no tiene una equivalencia definida: '+String(v).slice(0,120));
}
export function validarEntrada(data){
 if(!data||data.fuente!=='PDF_1116')throw Error('Origen de importación no válido: se requiere un PDF del Generador de Cuotas.');
 const nit=String(data.nit??'').replace(/\s/g,'');if(!/^\d{6,12}$/.test(nit))throw Error('No se identificó un NIT válido.');
 const anio=Number(data.anio),periodo=String(data.periodo??'');
 if(!Number.isInteger(anio)||anio<1900||anio>2100||!/^\d{1,2}$/.test(periodo)||Number(periodo)<1||Number(periodo)>12)throw Error('Año o período no identificado en la fuente.');
 const razonSocial=String(data.razonSocial??'').trim();if(!razonSocial||razonSocial.length>250)throw Error('Nombre o razón social no identificado.');
 if((data.cuotas?.length||0)>200||(data.pagos?.length||0)>5000)throw Error('La fuente supera el límite de registros permitido.');
 const out={fuente:data.fuente,nit,razonSocial,concepto:conceptoDIAN(data.concepto),anio,periodo:String(Number(periodo)),
  numeroObligacion:String(data.numeroObligacion??'').replace(/\D/g,''),documentoFuente:String(data.documentoFuente??'').replace(/\D/g,''),formulario:String(data.formulario??'').replace(/\D/g,''),
  cuotas:[],pagos:[],sancion:null};
 const vistos=new Set();
 for(const c of data.cuotas||[]){const numero=Number(c.numero);if(!Number.isInteger(numero)||numero<1||numero>200||vistos.has(numero))throw Error('Número de cuota inválido o repetido en el PDF.');vistos.add(numero);out.cuotas.push({numero,fecha:fechaISO(c.fecha),impuesto:pesos(c.impuesto),origenFecha:'PDF_1116'});}
 out.cuotas.sort((a,b)=>a.numero-b.numero);
 if(data.pagos?.length)throw Error('El Generador de Cuotas no importa recibos de pago. Use el importador habitual de Pagos.');
 if(data.sancion)out.sancion={valor:pesos(data.sancion.valor),fecha:fechaISO(data.sancion.fecha),descripcion:String(data.sancion.descripcion||'SANCIÓN').slice(0,150),codigo:String(data.sancion.codigo||'300').slice(0,12)};
 if(data.fuente==='PDF_1116'&&!out.cuotas.length&&!out.sancion)throw Error('El generador no contiene cuotas o sanción identificables.');
 return out;
}
function valorActual(v){return Number(v)||0;}
export function prepararImportacion(actual,entrada){
 const src=validarEntrada(entrada),a=structuredClone(actual||{});
 const tieneDatos=(a.vencimientos||[]).some(v=>valorActual(v.impuesto)>0)||(a.pagos||[]).some(p=>valorActual(p.valor)>0)||valorActual(a.valorSancion)>0;
 if(a.nit&&String(a.nit)!==src.nit)throw Error('El contribuyente de la fuente no coincide con el liquidador. Limpie o seleccione el destino correcto.');
 for(const k of ['concepto','anio','periodo'])if(a[k]&&tieneDatos&&normalizar(a[k])!==normalizar(src[k]))throw Error('El impuesto, año o período de la fuente no coincide con la obligación destino.');
 if(a.numeroObligacion&&src.numeroObligacion&&a.numeroObligacion!==src.numeroObligacion)throw Error('Los datos del PDF corresponden a una obligación diferente.');
 const next={...a,nit:src.nit,razonSocial:src.razonSocial,concepto:src.concepto,anio:src.anio,periodo:src.periodo,
  numeroObligacion:src.numeroObligacion||a.numeroObligacion||'',vencimientos:a.vencimientos||[],pagos:a.pagos||[]};
 if(src.fuente==='PDF_1116'){
  if(src.cuotas.length)next.vencimientos=src.cuotas.map(c=>({...c}));
  else if(src.sancion)next.vencimientos=next.vencimientos.filter(v=>valorActual(v.impuesto)>0);
  if(src.sancion){next.tieneSancion='SI';next.valorSancion=src.sancion.valor;next.fechaSancion=src.sancion.fecha;next.sancionFuente={...src.sancion,documentoFuente:src.documentoFuente,formulario:src.formulario,origenFecha:'VENCIMIENTO_FILA_SANCION_1116'};}
  else if(!next.tieneSancion)next.tieneSancion='NO';
 }
 if(!next.tieneSancion)next.tieneSancion='NO';
 return {datos:next,resumen:{fuente:src.fuente,cuotas:src.cuotas.length,sancion:Boolean(src.sancion),pagosNuevos:0,pagosOmitidos:0},fuente:src};
}
export function elegirDestino(contexto,fuente,preferido=''){
 const lista=contexto.obligaciones||[];if(preferido){const o=lista.find(x=>x.id===preferido);if(!o)throw Error('La obligación destino ya no existe.');return o;}
 if(lista.length===1)return lista[0];
 throw Error('Seleccione explícitamente la obligación destino antes de importar el PDF.');
}
