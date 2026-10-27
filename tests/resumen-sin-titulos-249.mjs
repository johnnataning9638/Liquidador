import {revertirCambiosTDJ252} from './alcance-tdj-pdf-252.mjs';
import {revertirCambios253} from './alcance-sancion-corte-253.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const baseline='47bfdab7eda02cc8e2f3fc43f52cc9c2993492e6';
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const old=f=>execFileSync('git',['show',`${baseline}:${f}`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const source=read('js/tdj-pdf-cierre-16.33.188.js');
const extract=(name,next)=>source.slice(source.indexOf(`  function ${name}(`),source.indexOf(`  function ${next}(`));
const sandbox={clean:v=>String(v??'').trim(),money:v=>Number(String(v).replace(/[^0-9-]/g,''))};
vm.runInNewContext(extract('parseSupport','parseTitleSummary')+';this.parse=parseSupport;',sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.parse(undefined))),{article:null,grid:{}});
const run=(attrs,support,details=[])=>{
 const values={};
 const ctx={
  gridItem:(label,value)=>{values[label]=value;return '';},
  uniq:a=>[...new Set(a)],esc:String,moneyFmt:String,dateText:String,note:()=>'',
  sectionPage:(doc,title,body)=>({title,body}),
 };
 vm.runInNewContext(extract('resumenLiquidacion','resumenPagos')+';this.run=resumenLiquidacion;',ctx);
 const result=ctx.run({querySelector:()=>({getAttribute:key=>attrs[key]??null})},details,{grid:support});
 assert.equal(result.title,'RESUMEN FINAL DE LA LIQUIDACIÓN');
 assert.ok(result.body.includes('RESUMEN DE ACTUALIZACIONES DE SANCIÓN'));
 return values;
};
const detail={clave:'RENTA|2025|1',saldoTotal:8220000,sancionSaldo:0,excedentePago:0,intereses:470000,actualizaciones:[],reducciones:[],article:{querySelectorAll:()=>[]}};
let values=run({'data-saldo-obligaciones':'7801000','data-saldo-sancion':'668000'},{},[detail]);
assert.equal(values['SALDO TOTAL FINAL'],7801000);
assert.equal(values['SANCIÓN FINAL'],668000);
values=run({'data-saldo-obligaciones':'8750000','data-saldo-sancion':'750000'},{});
assert.equal(values['SALDO TOTAL FINAL'],8750000,'Sin pagos no informar deuda cero');
assert.equal(values['SANCIÓN FINAL'],750000);
assert.equal(values['INTERESES GENERADOS EN LOS PAGOS'],0);
values=run({'data-saldo-obligaciones':'0','data-saldo-sancion':'0'},{'SALDO OBLIGACIONES':999},[detail]);
assert.equal(values['SALDO TOTAL FINAL'],0,'Cero final válido tiene prioridad sobre histórico');
assert.equal(values['SANCIÓN FINAL'],0);
assert.equal(run({}, {'SALDO OBLIGACIONES':0},[detail])['SALDO TOTAL FINAL'],0);
assert.equal(run({}, {},[detail])['SALDO TOTAL FINAL'],8220000,'Compatibilidad con soportes anteriores');

// Auditoría exacta: el core solo incorpora soporte y metadatos del PDF.
const core='js/tdj-core-16.33.143.js';
let expected=old(core)
 .replace('// PÁGINA INICIAL: solo se incluye cuando existe al menos un título aplicado.','// Soporte de saldos para toda obligación ordinaria, también sin movimientos.')
 .replace('if((hayTitulosRegistrados || hayExcedentesPago) && !esRegimenSimplePDF)    paginas.push(','if(!esRegimenSimplePDF)    paginas.push(');
const oldLine=expected.split('\n').find(l=>l.includes('win.document.write(`<!doctype html><html><head>'));
const newLine=read(core).split('\n').find(l=>l.includes('win.document.write(`<!doctype html><html><head>'));
assert.equal(newLine,oldLine.replace('<main class="pdf-soporte">','<main class="pdf-soporte" data-saldo-obligaciones="${saldoPendientePDF}" data-saldo-sancion="${saldoSancionPDF}">'));
const metadata='    // Metadatos de presentación: conservar los saldos del resultado sin exigir\n    // la existencia de páginas de pago o de soporte de títulos.\n    const saldoSancionPDF=resultado.resumenObligaciones.reduce((sum,x)=>sum+Math.max(0,Number((x.estadoFinal||x.liquidacionBase)?.sancion||0)),0);\n';
expected=expected.replace(oldLine,metadata+newLine);
expected=expected.replace('<div class="pdf-pago-titulo">VALOR PAGO','<div class="pdf-pago-titulo" style="background:#d9f2e3">VALOR PAGO');
assert.equal(revertirCambiosTDJ252(read(core)),expected,'Sin cambios en cálculos, importación, UI ni Excel');
const manifest=JSON.parse(read('runtime-manifest.json'));
for(const file of Object.keys(manifest.protected)){
 if([core,'js/tdj-pdf-cierre-16.33.188.js','js/tdj-pdf-cierre-16.33.189.js'].includes(file))continue;
 let current=revertirCambios253(read(file),file);
 if(file==='js/app.js')current=current.replace('<div class="pdf-pago-titulo" style="background:#d9f2e3">VALOR PAGO','<div class="pdf-pago-titulo">VALOR PAGO').replace('map(t=>tasaPdfArt45(null,Number(t.tasa)*100))','map(t=>tasaPdfArt45(x,Number(t.tasa)*100))');
 assert.equal(current,old(file),file+': intacto frente a 248');
}
console.log('RESUMEN 249 OK: soporte ausente, saldos parciales, cero válido, sin pagos, compatibilidad e integridad exacta');
