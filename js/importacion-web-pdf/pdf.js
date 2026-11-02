import {normalizar,fechaISO,pesos,validarEntrada} from './modelo.js';
const texto=(items)=>items.slice().sort((a,b)=>a.x-b.x).map(i=>i.s).join(' ').trim();
const digitos=items=>texto(items).replace(/\D/g,'');
function etiqueta(pg,prefijo){return pg.items.find(i=>normalizar(i.s).startsWith(prefijo));}
function banda(pg,y,x1,x2,delta=4){return pg.items.filter(i=>Math.abs(i.y-y)<=delta&&i.x>=x1&&i.x<x2);}
function bajo(pg,label,x2,altura=25){if(!label)throw Error('Falta una cabecera del formulario 1116.');return pg.items.filter(i=>i.x>=label.x-1&&i.x<x2&&i.y<label.y-5&&i.y>label.y-altura&&i.h>=7);}
function identidad(pg){
 const nitLabel=etiqueta(pg,'18.'),dv=etiqueta(pg,'6.DV');if(!nitLabel||!dv)throw Error('No se identificaron las columnas de identificación del PDF.');
 const nit=digitos(bajo(pg,nitLabel,dv.x,22));
 const social=etiqueta(pg,'11. RAZON SOCIAL');const sociedad=social?texto(bajo(pg,social,pg.width-20,22)):'';
 const apellido=etiqueta(pg,'7. PRIMER APELLIDO');
 const persona=apellido?texto(pg.items.filter(i=>i.x>=apellido.x-1&&i.y<apellido.y-6&&i.y>apellido.y-22&&i.h>=7&&!/^\d+$/.test(i.s))):'';
 return {nit,razonSocial:sociedad||persona};
}
export function interpretarGenerador(paginas){
 if(!Array.isArray(paginas)||!paginas.length)throw Error('El PDF no contiene texto legible.');
 const primero=paginas.find(pg=>etiqueta(pg,'24.'));if(!primero||!paginas.some(pg=>pg.items.some(i=>normalizar(i.s).includes('GENERADOR DE CUOTAS'))))throw Error('El PDF no es un Generador de Cuotas DIAN reconocido (formulario 1116).');
 const id=identidad(primero),year=etiqueta(primero,'25.'),periodo=etiqueta(primero,'26.'),concepto=etiqueta(primero,'24.'),cod=primero.items.find(i=>normalizar(i.s)==='COD.');
 const noObl=etiqueta(primero,'29.'),formulario=primero.items.find(i=>/^1116\d{9,16}$/.test(i.s)&&i.y>primero.height*0.8)?.s||'';
 const out={...id,fuente:'PDF_1116',formulario,concepto:texto(bajo(primero,concepto,cod?.x||year.x)),anio:Number(digitos(bajo(primero,year,periodo.x))),periodo:digitos(bajo(primero,periodo,etiqueta(primero,'27.').x)),numeroObligacion:digitos(bajo(primero,noObl,primero.width)),cuotas:[],pagos:[]};
 const sanciones=[];
 for(const pg of paginas){
  const ident=identidad(pg);if(ident.nit!==id.nit)throw Error('El PDF contiene páginas de contribuyentes diferentes.');
  const c34=etiqueta(pg,'34.'),c35=etiqueta(pg,'35.'),c36=etiqueta(pg,'36.'),c37=etiqueta(pg,'37.'),c38=etiqueta(pg,'38.'),c39=etiqueta(pg,'39.'),c40=etiqueta(pg,'40.');
  if(!c34)continue;if(![c35,c36,c37,c38,c39,c40].every(Boolean))throw Error('Las columnas de cuotas del PDF no se pudieron identificar.');
  const source=etiqueta(pg,'30.');const doc=source?digitos(bajo(pg,source,etiqueta(pg,'31.').x)):'';
  if(out.documentoFuente&&doc&&out.documentoFuente!==doc)throw Error('El PDF contiene más de un documento generador; impórtelos por separado.');if(doc)out.documentoFuente=doc;
  const anclas=pg.items.filter(i=>/^\d{3}$/.test(i.s)&&i.x>=c34.x-10&&i.x<c35.x-3&&i.y<c35.y-6);
  for(const a of anclas){
   const descripcion=texto(banda(pg,a.y,c35.x-3,c36.x-3));const n=normalizar(descripcion);
   const numero=Number(digitos(banda(pg,a.y,c36.x-3,c37.x-4))),naturaleza=normalizar(texto(banda(pg,a.y,c37.x-4,c38.x-5)));
   const fecha=fechaISO(digitos(banda(pg,a.y,c38.x-5,c39.x-5)));const valor=pesos(texto(banda(pg,a.y,c39.x-5,c40.x-5)));
   if(naturaleza&&naturaleza!=='DEBITO')throw Error('El generador contiene créditos o movimientos que requieren revisión.');
   if(!naturaleza&&valor!==0)throw Error('Falta la naturaleza del movimiento en una fila del PDF.');
   if(n==='IMPUESTO')out.cuotas.push({numero,fecha,impuesto:valor});
   else if(n.startsWith('SANCION'))sanciones.push({valor,fecha,descripcion,codigo:a.s});
   else throw Error('Concepto de saldo no soportado en el generador: '+descripcion);
  }
 }
 if(sanciones.length>1)throw Error('El PDF contiene varias filas de sanción. Se requiere revisión para conservar su identidad y fechas.');
 if(sanciones.length)out.sancion=sanciones[0];
 return validarEntrada(out);
}
export async function leerPDF(file){
 if(!file||file.size>20*1024*1024)throw Error('Seleccione un PDF de hasta 20 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('El archivo adjunto no es un PDF válido.');
 const pdfjs=await import('../../vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('../../vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
 const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,disableFontFace:true,useSystemFonts:false,enableXfa:false,stopAtErrors:true});
 try{
  const doc=await task.promise;if(doc.numPages>100)throw Error('El PDF supera el límite de 100 páginas.');
  const paginas=[];for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),text=await page.getTextContent();paginas.push({width:page.view[2]-page.view[0],height:page.view[3]-page.view[1],items:text.items.filter(t=>t.str?.trim()).map(t=>({s:t.str.trim(),x:t.transform[4],y:t.transform[5],h:t.height}))});}
  return interpretarGenerador(paginas);
 }catch(e){if(e.name==='PasswordException')throw Error('El PDF está protegido con contraseña.');throw e;}
 finally{await task.destroy();}
}
