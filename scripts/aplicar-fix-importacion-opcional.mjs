import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

const ROOT=process.cwd();
const tdjPath=path.join(ROOT,"js","tdj.js");
let tdj=fs.readFileSync(tdjPath,"utf8");
const marker='async function exportarPdfTDJ(){';
const helper=`
function bloqueProyeccionFechaCorteTDJ(x){
  const o=x?.obligacion||{};
  const corte=fechaCorteTDJ(o);
  if(!corte)return "";
  const r=x?.liquidacionBase||x?.estadoFinal||{};
  const impuesto=Math.max(0,Number(r?.impuesto||0));
  const intereses=Math.max(0,Number(r?.intereses||0));
  const sancion=Math.max(0,Number(r?.sancion||0));
  const total=Math.max(0,Number(r?.total??(impuesto+intereses+sancion)));
  const pagosCorte=pagosRealesHastaCorteTDJ(o,corte);
  const totalPagos=pagosCorte.reduce((a,p)=>a+Math.max(0,Number(p.valor||0)),0);
  const tasaInfo=tasaVisibleObligacionTDJ(o?.tipoTasa||"TASA DIAN",corte);
  const xCorte={
    pago:{id:uid("CORTE"),fecha:corte,valor:0,recibo:"",tdj:"",observacion:"PROYECCIÓN A FECHA DE CORTE",esTDJ:false},
    deudaAntes:{impuesto,intereses,sancion},
    aplicado:{impuesto:0,intereses:0,sancion:0,total:0},
    saldo:{impuesto,intereses,sancion,total},
    interesesPorCuota:Array.isArray(r?.interesesPorCuota)?r.interesesPorCuota:[],
    interesLiquidado:intereses,
    tipoAplicado:o?.tipoTasa||"TASA DIAN",
    tasaVisible:tasaInfo?.tasa==null?null:Number(tasaInfo.tasa),
    notaBeneficio:tasaInfo?.nota||"TASA APLICABLE A LA FECHA DE CORTE."
  };
  const d=datosPDFTDJ(o,xCorte.pago);
  const rSoporte={detalle:[xCorte],vencimientos:o?.vencimientos||[],interesesPorCuota:Array.isArray(r?.interesesPorCuota)?r.interesesPorCuota:[],intereses,fechaCorte:corte};
  return \`<article class="pdf-liquidacion pdf-detalle-dian pdf-proyeccion-corte"><div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">LIQUIDACIÓN DE OBLIGACIÓN — PROYECCIÓN</div><div class="pdf-generado">Generado: \${fechaVisible(hoyISO())}</div></div><div class="pdf-datos"><div class="pdf-dato"><b>AÑO</b><strong>\${escPdf(d.anio)}</strong></div><div class="pdf-dato"><b>CONCEPTO</b><strong>\${escPdf(d.concepto)}</strong></div><div class="pdf-dato"><b>PERÍODO</b><strong>\${escPdf(d.periodo)}</strong></div><div class="pdf-dato"><b>NIT</b><strong>\${escPdf(d.nit)}</strong></div><div class="pdf-dato"><b>D.V.</b><strong>\${escPdf(calcularDvNITTDJ(d.nit))}</strong></div><div class="pdf-dato ancho-2"><b>RAZÓN SOCIAL</b><strong>\${escPdf(d.razonSocial)}</strong></div><div class="pdf-dato"><b>TIPO DE LIQUIDACIÓN</b><strong>\${escPdf(d.tipoLiquidacion||"PRIVADA")}</strong></div><div class="pdf-dato"><b>FECHA DE SANCIÓN</b><strong>\${escPdf(fechaVisible(d.fechaSancion))}</strong></div><div class="pdf-dato ancho-2"><b>FECHA VENCIMIENTO PARA DECLARAR</b><strong>\${escPdf(fechaVisible(d.fechaVencimientoDeclarar))}</strong></div></div><section class="pdf-bloque"><h2>PROYECCIÓN A FECHA DE CORTE</h2><table><tbody><tr><th>FECHA DE CORTE</th><td>\${escPdf(fechaVisible(corte))}</td><th>TIPO DE TASA / BENEFICIO</th><td>\${escPdf(xCorte.tipoAplicado)}</td></tr><tr><th>TASA APLICABLE</th><td>\${xCorte.tasaVisible==null?"—":Number(xCorte.tasaVisible).toFixed(3)+"%"}</td><th>PAGOS REGISTRADOS HASTA EL CORTE</th><td>\${dinero(totalPagos)}</td></tr></tbody></table></section><section class="pdf-bloque"><h2>SALDO PROYECTADO A LA FECHA DE CORTE</h2><table><thead><tr><th>CONCEPTO</th><th>VALOR PENDIENTE</th></tr></thead><tbody><tr><td>IMPUESTO</td><td>\${dinero(impuesto)}</td></tr><tr><td>INTERESES</td><td>\${dinero(intereses)}</td></tr><tr><td>SANCIÓN</td><td>\${dinero(sancion)}</td></tr></tbody><tfoot><tr><th>TOTAL PENDIENTE PROYECTADO</th><th>\${dinero(total)}</th></tr></tfoot></table></section>\${tablaInteresesPdfTDJ(xCorte,rSoporte)}<div class="pdf-beneficio"><b>ALCANCE:</b> ESTE DOCUMENTO ES UNA PROYECCIÓN DE LA OBLIGACIÓN A LA FECHA DE CORTE INDICADA. NO CORRESPONDE A UN PAGO REGISTRADO NI A UN TÍTULO DE DEPÓSITO JUDICIAL.</div><div class="pdf-nota">La liquidación adjunta no exime al contribuyente de su responsabilidad de verificar que los valores determinados correspondan con su obligación tributaria y de efectuar el pago respectivo, conforme a los artículos 1, 6, 574 y 591 del Estatuto Tributario – Título II, Deberes y Obligaciones Formales.</div></article>\`;
}

`;
if(!tdj.includes(marker))throw new Error("No se encontró exportarPdfTDJ().");
if(!tdj.includes("function bloqueProyeccionFechaCorteTDJ("))tdj=tdj.replace(marker,helper+marker);
const old="    const paginas=[];\n\n    // PÁGINA INICIAL: solo se incluye cuando existe al menos un título aplicado.";
const neo="    const paginas=[];\n\n    // PROYECCIÓN SIN MOVIMIENTO: una fecha de corte no es un pago ni un TDJ.\n    // El motor sí calcula la obligación, pero antes el exportador no generaba\n    // ninguna página y abría about:blank. Ahora se genera un soporte específico.\n    const obligacionesConProyeccion=resultado.resumenObligaciones.filter(x=>fechaCorteTDJ(x.obligacion));\n    obligacionesConProyeccion.forEach(x=>{\n      paginas.push(\`<section class=\"pdf-hoja\">\${bloqueProyeccionFechaCorteTDJ(x)}</section>\`);\n    });\n\n    // PÁGINA INICIAL: solo se incluye cuando existe al menos un título aplicado.";
if(!tdj.includes(old))throw new Error("No se encontró el bloque paginas[].");
tdj=tdj.replace(old,neo,1);
const old2='    const win=window.open("","_blank","width=1200,height=1000");';
const neo2='    if(!paginas.length)throw new Error("NO HAY CONTENIDO PARA GENERAR EL SOPORTE PDF. VERIFIQUE LA OBLIGACIÓN, LA FECHA DE CORTE O LOS MOVIMIENTOS REGISTRADOS.");\n'+old2;
if(!tdj.includes(old2))throw new Error("No se encontró window.open del PDF.");
tdj=tdj.replace(old2,neo2,1);
fs.writeFileSync(tdjPath,tdj);

const htmlPath=path.join(ROOT,"titulos.html");
let html=fs.readFileSync(htmlPath,"utf8");
html=html.replace('<!-- TDJ UI DEPLOY 16.33.122 -->','<!-- TDJ UI DEPLOY 16.33.123 -->',1);
html=html.replace('<footer>Liquidador — módulo de Liquidación de Títulos / TDJ · v16.33.122</footer>','<footer>Liquidador — módulo de Liquidación de Títulos / TDJ · v16.33.123</footer>',1);
html=html.replace('<script type="module" src="js/tdj.js?v=16.33.122"></script>','<script type="module" src="js/tdj.js?v=16.33.123"></script>',1);
fs.writeFileSync(htmlPath,html);
fs.mkdirSync(path.join(ROOT,"RELEASES"),{recursive:true});
fs.writeFileSync(path.join(ROOT,"RELEASES","16.33.123.md"),`# v16.33.123 — PDF DE PROYECCIÓN TDJ\n\n- Corrige la generación del PDF cuando la liquidación TDJ se ejecuta únicamente con una fecha de corte, sin pago real ni TDJ con valor.\n- Genera una página específica de PROYECCIÓN A FECHA DE CORTE con impuesto, intereses, sanción y total pendiente.\n- Conserva la lógica matemática de liquidación, pagos, títulos, endoso y distribución TDJ.\n- Evita que el escenario de proyección abra un about:blank sin contenido.\n- Cambio limitado al flujo de exportación PDF del módulo TDJ.\n`);

const original=execFileSync("git",["show","HEAD^:scripts/aplicar-fix-importacion-opcional.mjs"],{encoding:"utf8"});
fs.writeFileSync(path.join(ROOT,"scripts","aplicar-fix-importacion-opcional.mjs"),original);
console.log("PATCH PDF PROYECCIÓN TDJ 16.33.123 APLICADO");
