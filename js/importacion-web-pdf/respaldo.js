import {fechaISO, pesos} from './modelo.js';

const ancho=96, alto=112;
const tamBloque=ancho*alto/8, cabecera=16, capacidad=tamBloque-cabecera;
const firma=0x4c515231; // LQR1
const maxBloques=100;
const campos=[
  'concepto','anio','periodo','tipoLiquidacion','perfilContribuyente','periodicidadObligacion',
  'tieneSancion','beneficioTributario','tipoTasa','numeroObligacion'
];
const fechas=[
  'fechaSancion','fechaAutoAdmisorio','fechaProvidenciaDefinitiva','fechaActuacionBeneficio',
  'fechaDeclaracionOriginal','fechaPresentacionDeclaracion1419'
];
const opciones=['obligacionFormalCumplida','aceptaGlosas','informaDian','resolucionReconsideracion'];
const texto=(valor,max=300)=>String(valor??'').slice(0,max).trim();
const fecha=v=>v?fechaISO(v):'';
const lista=(v,max=5000)=>{
  if(!Array.isArray(v)||v.length>max)throw Error('Lista inválida en el respaldo del PDF.');
  return v;
};
const movimiento=m=>({
  recibo:texto(m.recibo,80),tdj:texto(m.tdj,80),fecha:fecha(m.fecha),
  valor:pesos(m.valor||0),tipo:texto(m.tipo),observacion:texto(m.observacion)
});
function obligacion(o){
  return {
    ...Object.fromEntries(campos.map(k=>[k,texto(o[k])])),
    ...Object.fromEntries(fechas.map(k=>[k,fecha(o[k])])),
    ...Object.fromEntries(opciones.map(k=>[k,o[k]===true||o[k]==='SI'])),
    valorSancion:pesos(o.valorSancion||0),
    vencimientos:lista(o.vencimientos||[]).map((v,i)=>({
      numero:i+1,periodo:texto(v.periodo??i+1,80),fecha:fecha(v.fecha),impuesto:pesos(v.impuesto||0)
    })),
    pagos:lista(o.pagos||[]).map(movimiento).filter(p=>p.fecha||p.valor||p.recibo||p.tdj)
  };
}

export function crearRespaldo(origen,identidad,obligaciones,titulos){
  return {
    fuente:'PDF_LIQUIDADOR_V1',origen,nit:texto(identidad.nit,20),razonSocial:texto(identidad.razonSocial),
    obligaciones:lista(obligaciones).map(obligacion),
    titulos:lista(titulos).map(t=>({
      ...movimiento(t),tiposObligacion:lista(t.tiposObligacion||[]).map(tipo=>texto(tipo))
    })).filter(t=>t.fecha||t.valor||t.tdj)
  };
}

export function prepararRespaldo(datos,esTDJ){
  if(datos?.fuente!=='PDF_LIQUIDADOR_V1'||!['DIAN','TDJ'].includes(datos.origen)){
    throw Error('Formato de respaldo del Liquidador no reconocido.');
  }
  const d=crearRespaldo(datos.origen,datos,datos.obligaciones,datos.titulos);
  if(!d.obligaciones.length||!/^[0-9]*$/.test(d.nit))throw Error('Identificación u obligaciones inválidas en el respaldo.');
  const titulos=new Map();
  for(const t of d.titulos){
    const clave=t.tdj||Symbol();
    const previo=titulos.get(clave);
    if(previo&&(previo.fecha!==t.fecha||previo.valor!==t.valor)){
      throw Error('El mismo título figura con valores originales o fechas diferentes. Revise el PDF.');
    }
    if(!previo)titulos.set(clave,t);
  }
  const recibos=new Map();
  const movimientos=d.obligaciones.map(()=>[]);
  const orden=new Map();
  for(const [indice,o] of d.obligaciones.entries()){
    for(const [posicion,pago] of o.pagos.entries()){
      orden.set(pago,posicion);
      if(pago.tdj)continue;
      if(!pago.recibo){movimientos[indice].push(pago);continue;}
      const clave=JSON.stringify([pago.recibo,pago.fecha]);
      if(!recibos.has(clave))recibos.set(clave,{original:null,fracciones:new Map()});
      const grupo=recibos.get(clave);
      if(/^FRACCI[ÓO]N\b/i.test(pago.observacion)){
        grupo.fracciones.set(JSON.stringify([indice,pago.observacion,pago.valor]),{indice,pago});
      }else{
        if(grupo.original&&grupo.original.pago.valor!==pago.valor){
          throw Error('Un recibo figura con valores originales diferentes. Revise el PDF.');
        }
        grupo.original??={indice,pago};
      }
    }
  }
  for(const {original,fracciones} of recibos.values()){
    const partes=[...fracciones.values()];
    if(!partes.length){
      movimientos[original.indice].push(original.pago);
      continue;
    }
    const total=pesos(partes.reduce((n,{pago})=>n+pago.valor,0));
    if(original&&original.pago.valor!==total){
      throw Error('Las fracciones de un recibo no coinciden con su valor original. Revise el PDF.');
    }
    if(esTDJ){
      for(const {indice,pago} of partes)movimientos[indice].push(pago);
    }else{
      const primera=partes.find(p=>p.indice===0);
      if(primera||original?.indice===0){
        const base=original?.pago??primera.pago;
        const pago={...base,valor:total};
        orden.set(pago,orden.get(primera?.pago??base));
        movimientos[0].push(pago);
      }
    }
  }
  const obligaciones=(esTDJ?d.obligaciones:d.obligaciones.slice(0,1))
    .map((o,indice)=>({...o,pagos:movimientos[indice].sort((a,b)=>orden.get(a)-orden.get(b))}));
  return {...d,obligaciones,titulos:[...titulos.values()],omitidas:d.obligaciones.length-obligaciones.length};
}

function suma(bytes){
  let hash=2166136261;
  for(const byte of bytes)hash=Math.imul(hash^byte,16777619);
  return hash>>>0;
}

export function codificarBloques(datos){
  const bytes=new TextEncoder().encode(JSON.stringify(datos));
  const total=Math.ceil(bytes.length/capacidad);
  if(total>maxBloques)throw Error('La liquidación supera la capacidad del respaldo PDF.');
  return Array.from({length:total},(_,indice)=>{
    const contenido=bytes.subarray(indice*capacidad,(indice+1)*capacidad);
    const bloque=new Uint8Array(tamBloque);
    const vista=new DataView(bloque.buffer);
    vista.setUint32(0,firma);
    vista.setUint16(4,indice);
    vista.setUint16(6,total);
    vista.setUint16(8,contenido.length);
    vista.setUint32(12,suma(contenido));
    bloque.set(contenido,cabecera);
    return bloque;
  });
}

export function unirBloques(bloques){
  const partes=[];
  for(const bloque of bloques){
    const vista=new DataView(bloque.buffer,bloque.byteOffset,bloque.byteLength);
    const indice=vista.getUint16(4),total=vista.getUint16(6),largo=vista.getUint16(8);
    const contenido=bloque.subarray(cabecera,cabecera+largo);
    if(vista.getUint32(0)!==firma||total!==bloques.length||indice>=total||partes[indice]||
      !largo||largo>capacidad||vista.getUint32(12)!==suma(contenido)){
      throw Error('El bloque de recuperación está incompleto o dañado.');
    }
    partes[indice]=contenido;
  }
  const bytes=new Uint8Array(partes.reduce((total,p)=>total+p.length,0));
  let posicion=0;
  for(const parte of partes){bytes.set(parte,posicion);posicion+=parte.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

// La matriz se imprime como imagen. También sobrevive cuando la impresora
// convierte toda la tipografía del soporte en trazos vectoriales.
export function paginasRespaldoSeguro(crear){
  try{return paginasRespaldo(crear());}
  catch(error){
    console.error('No se pudo incorporar el respaldo PDF',error);
    return '<section class="pdf-hoja"><p>El soporte se generó sin datos de recuperación. Use la exportación de Excel para conservar los datos editables.</p></section>';
  }
}

export function paginasRespaldo(datos){
  const bloques=codificarBloques(datos);
  return bloques.map((bloque,i)=>{
    const canvas=document.createElement('canvas');
    canvas.width=(ancho+2)*5;
    canvas.height=(alto+2)*5;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#ff00ff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fff';
    ctx.fillRect(5,5,ancho*5,alto*5);
    ctx.fillStyle='#000';
    for(let bit=0;bit<ancho*alto;bit++){
      if(bloque[bit>>3]&(128>>(bit%8)))ctx.fillRect((bit%ancho+1)*5,(Math.floor(bit/ancho)+1)*5,5,5);
    }
    return `<section class="pdf-hoja" style="text-align:center;color:#142d47"><h2>Recuperación de datos del Liquidador</h2><p>Bloque ${i+1} de ${bloques.length}. Conserve todas las páginas para volver a importar este PDF.</p><img alt="Bloque de recuperación" style="width:130mm;max-width:100%;height:auto" src="${canvas.toDataURL()}"></section>`;
  }).join('');
}

async function leerBloque(page){
  const canvas=document.createElement('canvas');
  const original=page.getViewport({scale:1});
  const viewport=page.getViewport({scale:Math.min(2,1600/Math.max(original.width,original.height))});
  canvas.width=Math.ceil(viewport.width);
  canvas.height=Math.ceil(viewport.height);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  await page.render({canvasContext:ctx,viewport}).promise;
  const {width,height}=canvas;
  const {data}=ctx.getImageData(0,0,width,height);
  let izquierda=width,derecha=0,arriba=height,abajo=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4;
    if(data[p]>200&&data[p+1]<80&&data[p+2]>200){
      izquierda=Math.min(izquierda,x);derecha=Math.max(derecha,x);
      arriba=Math.min(arriba,y);abajo=Math.max(abajo,y);
    }
  }
  const dx=(derecha-izquierda+1)/(ancho+2),dy=(abajo-arriba+1)/(alto+2);
  if(dx<2||dy<2||Math.abs(dx/dy-1)>.08)return null;
  const bloque=new Uint8Array(tamBloque);
  for(let y=0;y<alto;y++)for(let x=0;x<ancho;x++){
    const p=(Math.round(arriba+(y+1.5)*dy)*width+Math.round(izquierda+(x+1.5)*dx))*4;
    const bit=y*ancho+x;
    if(data[p]+data[p+1]+data[p+2]<384)bloque[bit>>3]|=128>>(bit%8);
  }
  return new DataView(bloque.buffer).getUint32(0)===firma?bloque:null;
}

export async function leerRespaldoPDF(doc){
  // PDF.js usa este método al dibujar imágenes, incluso en navegadores
  // que ya pueden extraer el texto del formulario 1116 sin él.
  if(typeof Map.prototype.getOrInsertComputed!=='function'){
    Object.defineProperty(Map.prototype,'getOrInsertComputed',{
      configurable:true,writable:true,
      value:function(clave,crear){
        if(this.has(clave))return this.get(clave);
        const valor=crear(clave);
        this.set(clave,valor);
        return valor;
      }
    });
  }
  const bloques=[];
  for(let n=doc.numPages;n>0&&bloques.length<maxBloques;n--){
    const bloque=await leerBloque(await doc.getPage(n));
    // El cierre TDJ puede mover los resúmenes después de las páginas de respaldo.
    if(!bloque){
      if(bloques.length)break;
      continue;
    }
    bloques.push(bloque);
    if(bloques.length===new DataView(bloque.buffer).getUint16(6))return unirBloques(bloques);
  }
  if(bloques.length)throw Error('Faltan páginas del bloque de recuperación del PDF.');
  return null;
}
