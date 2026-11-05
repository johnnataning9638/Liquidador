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

const prefijoReferencia='liq-respaldo-v1-';

// Chromium conserva los destinos de enlaces internos en «Guardar como PDF».
// Un enlace vacío fuera del flujo no cambia el contenido ni la paginación.
export function referenciasRespaldo(datos){
  return codificarBloques(datos).map(bloque=>{
    const base64=btoa(String.fromCharCode(...bloque)).replaceAll('+','-').replaceAll('/','_');
    const destino=prefijoReferencia+base64;
    return `<a id="${destino}" href="#${destino}" aria-hidden="true" tabindex="-1" style="position:absolute;top:0;left:0;width:1px;height:1px;display:block"></a>`;
  }).join('');
}

async function leerReferencias(doc){
  const destinos=await doc.getDestinations();
  const nombres=destinos instanceof Map?[...destinos.keys()]:Object.keys(destinos||{});
  const claves=nombres.map(nombre=>nombre.replace(/^\//,''))
    .filter(nombre=>nombre.startsWith(prefijoReferencia));
  if(!claves.length)return null;
  if(claves.length>maxBloques)throw Error('El PDF contiene demasiados bloques de recuperación.');
  const bloques=claves.map(clave=>{
    const base64=clave.slice(prefijoReferencia.length);
    if(base64.length!==Math.ceil(tamBloque/3)*4||!/^[A-Za-z0-9_-]+$/.test(base64)){
      throw Error('El bloque de recuperación está incompleto o dañado.');
    }
    return Uint8Array.from(atob(base64.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
  });
  return unirBloques(bloques);
}

const firmaCompacta=0x4c514131; // LQA1
const marco=3;
const colorMarco='#190034';

async function convertirRespaldo(bytes,flujo,limite){
  const lector=new Blob([bytes]).stream().pipeThrough(flujo).getReader();
  const partes=[];
  let largo=0;
  try{
    for(;;){
      const {done,value}=await lector.read();
      if(done)break;
      largo+=value.length;
      if(largo>limite){await lector.cancel();return null;}
      partes.push(value);
    }
  }finally{lector.releaseLock();}
  return new Uint8Array(await new Blob(partes).arrayBuffer());
}

export async function codigoRespaldoCompacto(datos){
  const entrada=new TextEncoder().encode(JSON.stringify(datos));
  const comprimido=await convertirRespaldo(entrada,new CompressionStream('deflate'),capacidad);
  if(!comprimido)return '';
  const bloque=new Uint8Array(tamBloque);
  const vista=new DataView(bloque.buffer);
  vista.setUint32(0,firmaCompacta);
  vista.setUint16(8,comprimido.length);
  vista.setUint32(12,suma(comprimido));
  bloque.set(comprimido,cabecera);
  // El relleno visual queda fuera de los datos y de su comprobación de integridad.
  let relleno=suma(comprimido);
  for(let i=cabecera+comprimido.length;i<bloque.length;i++){
    relleno=(Math.imul(relleno,1664525)+1013904223)>>>0;
    bloque[i]=relleno>>>24;
  }
  const canvas=document.createElement('canvas');
  const pixel=5;
  canvas.width=(ancho+2*marco)*pixel;
  canvas.height=(alto+2*marco)*pixel;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=colorMarco;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#fff';
  ctx.fillRect(marco*pixel,marco*pixel,ancho*pixel,alto*pixel);
  ctx.fillStyle='#000';
  for(let bit=0;bit<ancho*alto;bit++){
    if(bloque[bit>>3]&(128>>(bit%8)))ctx.fillRect((bit%ancho+marco)*pixel,(Math.floor(bit/ancho)+marco)*pixel,pixel,pixel);
  }
  // El cierre TDJ puede agregar sus resúmenes después de cargar la vista.
  // Mantener el código después del contenido de la última sección real.
  return `<img id="liq-codigo-a" alt="" style="display:none;width:12mm;height:auto;margin:3mm 0 0 auto;break-inside:avoid;image-rendering:pixelated" src="${canvas.toDataURL()}"><script>
  (()=>{const codigo=document.getElementById('liq-codigo-a');
  const main=document.querySelector('main.pdf-soporte');
  if(!codigo||!main)return;
  const ubicar=()=>{const ultima=main.querySelector(':scope > section:last-of-type');
    const pagina=ultima?.querySelector(':scope > .pdf-pagina')||ultima;
    if(pagina&&pagina.lastElementChild!==codigo)pagina.append(codigo);
    if(pagina)codigo.style.display='block';
  };
  new MutationObserver(ubicar).observe(main,{childList:true,subtree:true});
  ubicar();})();
  </script>`;
}

export async function respaldoPDFExportable(crear){
  const datos=crear();
  const referencias=referenciasRespaldo(datos);
  try{return referencias+await codigoRespaldoCompacto(datos);}
  catch(error){
    console.warn('No se pudo generar el código compacto del PDF',error);
    return referencias;
  }
}

async function dibujarFranja(page,escala,recorte){
  const canvas=document.createElement('canvas');
  const viewport=page.getViewport({scale:escala});
  const {x,y,width,height}=recorte(viewport);
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  await page.render({canvasContext:ctx,viewport,transform:[1,0,0,1,-x,-y]}).promise;
  return {data:ctx.getImageData(0,0,width,height).data,width,height,x,y};
}

function localizarMarco({data,width,height}){
  let izquierda=width,derecha=-1,arriba=height,abajo=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4;
    if(data[p]>=18&&data[p]<=42&&data[p+1]<13&&data[p+2]>=42&&data[p+2]<=73){
      izquierda=Math.min(izquierda,x);derecha=Math.max(derecha,x);
      arriba=Math.min(arriba,y);abajo=Math.max(abajo,y);
    }
  }
  return {izquierda,derecha,arriba,abajo};
}

async function imagenCompacta(page){
  const {OPS}=await import('../../vendor/pdfjs/pdf.mjs');
  const {fnArray,argsArray}=await page.getOperatorList();
  for(let i=0;i<fnArray.length;i++){
    if(fnArray[i]!==OPS.paintImageXObject)continue;
    const [id,width,height]=argsArray[i];
    if(width!==510||height!==590)continue;
    const objetos=id.startsWith('g_')?page.commonObjs:page.objs;
    const img=await new Promise(resolve=>objetos.get(id,resolve));
    if(!img)continue;
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    if(img.bitmap)ctx.drawImage(img.bitmap,0,0);
    else if(img.data?.length===width*height*4){
      ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data),width,height),0,0);
    }else if(img.data?.length===width*height*3){
      const rgba=ctx.createImageData(width,height);
      for(let j=0,k=0;j<img.data.length;j+=3,k+=4){
        rgba.data[k]=img.data[j];rgba.data[k+1]=img.data[j+1];rgba.data[k+2]=img.data[j+2];rgba.data[k+3]=255;
      }
      ctx.putImageData(rgba,0,0);
    }else continue;
    const datos={data:ctx.getImageData(0,0,width,height).data,width,height};
    const respaldo=await interpretarCompacto(datos);
    if(respaldo)return respaldo;
  }
  return null;
}

async function leerCompacto(page){
  const imagen=await imagenCompacta(page);
  if(imagen)return imagen;
  const original=page.getViewport({scale:1});
  const escala=Math.min(4,3000/Math.max(original.width,original.height));
  const franja=await dibujarFranja(page,escala,viewport=>{
    const x=Math.floor(viewport.width*.65);
    return {x,y:0,width:Math.ceil(viewport.width)-x,height:Math.ceil(viewport.height)};
  });
  const zona=localizarMarco(franja);
  const anchoZona=zona.derecha-zona.izquierda+1,altoZona=zona.abajo-zona.arriba+1;
  if(anchoZona<10||altoZona<10||anchoZona/escala>40||altoZona/escala>46||
     Math.abs(anchoZona/altoZona-(ancho+2*marco)/(alto+2*marco))>.09)return null;
  const aumento=16/escala;
  const recorte=await dibujarFranja(page,16,()=>({
    x:Math.floor((franja.x+zona.izquierda)*aumento)-12,
    y:Math.floor(zona.arriba*aumento)-12,
    width:Math.ceil(anchoZona*aumento)+24,
    height:Math.ceil(altoZona*aumento)+24
  }));
  return interpretarCompacto(recorte);
}

async function interpretarCompacto(imagen){
  const {data,width}=imagen;
  const {izquierda,derecha,arriba,abajo}=localizarMarco(imagen);
  const dx=(derecha-izquierda+1)/(ancho+2*marco),dy=(abajo-arriba+1)/(alto+2*marco);
  if(dx<2||dy<2||Math.abs(dx/dy-1)>.08)return null;
  const bloque=new Uint8Array(tamBloque);
  for(let y=0;y<alto;y++)for(let x=0;x<ancho;x++){
    const p=(Math.floor(arriba+(y+marco+.5)*dy)*width+Math.floor(izquierda+(x+marco+.5)*dx))*4;
    const bit=y*ancho+x;
    if(data[p]+data[p+1]+data[p+2]<384)bloque[bit>>3]|=128>>(bit%8);
  }
  const vista=new DataView(bloque.buffer);
  if(vista.getUint32(0)!==firmaCompacta)return null;
  const largo=vista.getUint16(8);
  const comprimido=bloque.subarray(cabecera,cabecera+largo);
  if(!largo||largo>capacidad||vista.getUint32(12)!==suma(comprimido)){
    throw Error('El código de recuperación del PDF está dañado.');
  }
  const bytes=await convertirRespaldo(comprimido,new DecompressionStream('deflate'),capacidad*maxBloques);
  if(!bytes)throw Error('El código de recuperación supera el tamaño permitido.');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
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
  const respaldo=await leerReferencias(doc);
  if(respaldo)return respaldo;
  // Compatibilidad con los PDF que ya se exportaron con la matriz visible.
  // PDF.js usa este método al dibujar imágenes, incluso en navegadores
  // que ya pueden extraer el texto del formulario 1116 sin él.
  for(const {prototype} of [Map,WeakMap]){
    if(typeof prototype.getOrInsertComputed==='function')continue;
    Object.defineProperty(prototype,'getOrInsertComputed',{
      configurable:true,writable:true,
      value:function(clave,crear){
        if(this.has(clave))return this.get(clave);
        const valor=crear(clave);
        this.set(clave,valor);
        return valor;
      }
    });
  }
  const compacto=await leerCompacto(await doc.getPage(doc.numPages));
  if(compacto)return compacto;
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
