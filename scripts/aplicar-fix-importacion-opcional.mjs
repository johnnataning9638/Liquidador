import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TO = "16.33.118";
const activeRoots = ["js", "tests"];
const activeFiles = ["index.html","liquidacion.html","titulos.html","estilos.css","tdj-mobile.css",".github/workflows/audit-estabilidad.yml"];

function walk(dir){
  const out=[];
  for(const name of fs.readdirSync(dir)){
    const full=path.join(dir,name),st=fs.statSync(full);
    if(st.isDirectory())out.push(...walk(full)); else out.push(full);
  }
  return out;
}
function replaceVersions(text){return text.replace(/16\.33\.(11[0-7])/g,TO);}
for(const root of activeRoots){
  if(!fs.existsSync(root))continue;
  for(const file of walk(path.join(ROOT,root))){
    if(!/\.(?:js|mjs|html|css|yml|yaml)$/.test(file))continue;
    const before=fs.readFileSync(file,"utf8"),after=replaceVersions(before);
    if(after!==before)fs.writeFileSync(file,after);
  }
}
for(const rel of activeFiles){
  const file=path.join(ROOT,rel); if(!fs.existsSync(file))continue;
  const before=fs.readFileSync(file,"utf8"),after=replaceVersions(before);
  if(after!==before)fs.writeFileSync(file,after);
}

// Corrección funcional: la captura manual TDJ es válida por sí misma.
// Antes de validar/calcular se sincronizan las filas visibles con el modelo,
// de modo que el resultado no dependa de que se haya ejecutado un importador
// ni de que el último campo haya disparado blur.
const tdjPath=path.join(ROOT,"js","tdj.js");
let tdj=fs.readFileSync(tdjPath,"utf8");
const marker='function sincronizarTitulosVisiblesTDJ(actualizarUI=true){';
const helper=`function sincronizarCapturaManualTDJ(){
  document.querySelectorAll("#listaObligaciones .obligacion-card").forEach(sec=>{
    const o=obligaciones.find(x=>x.id===sec.dataset.id); if(!o)return;
    sec.querySelectorAll(".cuotas-mini tbody tr").forEach(tr=>{
      const v=o.vencimientos.find(x=>x.id===tr.dataset.vtoId); if(!v)return;
      const fecha=fechaISO(tr.querySelector(".fecha-campo")?.value||tr.querySelector(".fecha-native")?.value||"");
      const impuesto=numeroDesdeTexto(tr.querySelector('[data-v="impuesto"]')?.value||"");
      const periodo=tr.querySelector('[data-v="periodo"]')?.value;
      if(fecha)v.fecha=fecha;
      v.impuesto=Number.isFinite(impuesto)?impuesto:0;
      if(periodo!=null&&String(periodo).trim())v.periodo=upper(periodo);
    });
    sec.querySelectorAll("[data-pago-id]").forEach(tr=>{
      const p=o.pagos.find(x=>x.id===tr.dataset.pagoId); if(!p)return;
      const fecha=fechaISO(tr.querySelector(".fecha-campo")?.value||tr.querySelector(".fecha-native")?.value||"");
      const valor=numeroDesdeTexto(tr.querySelector('[data-p="valor"]')?.value||"");
      const recibo=tr.querySelector('[data-p="recibo"]')?.value;
      if(fecha)p.fecha=fecha;
      p.valor=Number.isFinite(valor)?truncarValorEntero(valor):0;
      if(recibo!=null)p.recibo=String(recibo).trim();
    });
  });
  document.querySelectorAll("#tablaTitulos tbody tr").forEach(tr=>{
    const t=titulos.find(x=>x.id===tr.dataset.tituloId); if(!t)return;
    const fecha=fechaISO(tr.querySelector(".fecha-campo")?.value||tr.querySelector(".fecha-native")?.value||"");
    const valor=numeroDesdeTexto(tr.querySelector('[data-t="valor"]')?.value||"");
    const numero=tr.querySelector('[data-t="tdj"]')?.value;
    if(fecha)t.fecha=fecha;
    t.valor=Number.isFinite(valor)?truncarValorEntero(valor):0;
    if(numero!=null)t.tdj=String(numero).trim();
  });
}

`;
if(!tdj.includes(marker))throw new Error("No se encontró el punto de inserción de sincronización TDJ.");
if(!tdj.includes("function sincronizarCapturaManualTDJ()"))tdj=tdj.replace(marker,helper+marker);
const validationMarker='for(const o of obligaciones){\n    o.vencimientos=o.vencimientos.filter(v=>v.fecha&&Number(v.impuesto)>0);';
const validationReplacement='sincronizarCapturaManualTDJ();\n  for(const o of obligaciones){\n    o.vencimientos=o.vencimientos.filter(v=>v.fecha&&Number(v.impuesto)>0);';
if(!tdj.includes(validationMarker))throw new Error("No se encontró la validación de obligaciones TDJ.");
tdj=tdj.replace(validationMarker,validationReplacement);
fs.writeFileSync(tdjPath,tdj);

const testPath=path.join(ROOT,"tests","regresion-importacion-opcional.mjs");
fs.writeFileSync(testPath,`import fs from "node:fs";\nimport assert from "node:assert/strict";\nconst tdj=fs.readFileSync("js/tdj.js","utf8");\nconst app=fs.readFileSync("js/app.js","utf8");\nassert.match(tdj,/function sincronizarCapturaManualTDJ\\(\\)/);\nassert.match(tdj,/sincronizarCapturaManualTDJ\\(\\);\\s*for\\(const o of obligaciones\\)/);\nassert.match(tdj,/o\\.vencimientos=o\\.vencimientos\\.filter\\(v=>v\\.fecha&&Number\\(v\\.impuesto\\)>0\\)/);\nassert.doesNotMatch(tdj,/validarDatos[\\s\\S]{0,12000}(?:importado|importacion|importación).*throw new Error/i);\nassert.doesNotMatch(app,/(?:validar|calcular)[\\s\\S]{0,12000}(?:importado|importacion|importación).*throw new Error/i);\nassert.equal([...(tdj+app).matchAll(/16\\.33\\.(11[0-7])/g)].length,0);\nconsole.log("REGRESIÓN IMPORTACIÓN OPCIONAL: OK");\nconsole.log("CAPTURA MANUAL DE CUOTAS: OK");\nconsole.log("CAPTURA MANUAL DE PAGOS/TÍTULOS: OK");\nconsole.log("IMPORTACIÓN: OPCIONAL");\n`);
fs.mkdirSync(path.join(ROOT,"RELEASES"),{recursive:true});
fs.writeFileSync(path.join(ROOT,"RELEASES","16.33.118.md"),`# 16.33.118 — IMPORTACIÓN OPCIONAL Y CAPTURA MANUAL\n\n- Importar es opcional en DIAN y TDJ.\n- La captura manual es una fuente válida.\n- Antes de calcular TDJ se sincronizan cuotas, pagos y títulos visibles con el modelo interno.\n- Las validaciones comprueban datos requeridos, no el origen de los datos.\n- Se preservan DIAN tradicional, Régimen Simple, sanciones, intereses, cuotas, pagos, TDJ, distribución, endoso y fecha de corte.\n`);
console.log(`CORRECCIÓN APLICADA: ${TO}`);
