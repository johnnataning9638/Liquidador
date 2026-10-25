import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {filaTimVisualTDJ} from '../js/tdj-tasa-vista-207.js';

const core=fs.readFileSync('js/tdj-core-16.33.143.js','utf8');
const vista=fs.readFileSync('js/tdj-visual-beneficios.js','utf8');
const jsEntrada=fs.readFileSync('js/tdj.js','utf8');
const html=fs.readFileSync('titulos.html','utf8');
const local=JSON.parse(fs.readFileSync('datos/tasas-moratorias.json','utf8'));
const fecha='2026-10-19';
assert.equal(local.find(r=>r.desde<=fecha && fecha<=r.hasta)?.tasas['TASA DIAN'],0.2659,'Respaldo local de octubre validado con SFC y Supabase');
const localSinOctubre=local.filter(r=>!(r.desde<=fecha && fecha<=r.hasta));
assert.equal(localSinOctubre.some(r=>r.desde<=fecha && fecha<=r.hasta),false,'Fixture independiente: simular respaldo anterior sin octubre');
const tasasSupabaseSimuladas=[
 ...localSinOctubre,{desde:'2026-10-01',hasta:'2026-10-31',tasas:{'TASA DIAN':0.2659},fuente:'SUPABASE'}
];
// Reproducir funciones reales de vista sin navegador; NO copiar sus formulas a la prueba.
const fechas=vista.slice(vista.indexOf('  function fechaISOVisual('),vista.indexOf('  function obtenerObligaciones('));
const fnTasa=vista.slice(vista.indexOf('  function tasaPorFechaLocal('),vista.indexOf('  function mostrarTasa('));
assert.ok(fechas.includes('function fechaISOVisual')&&fnTasa.includes('function tasaPorFechaLocal'));
const contexto={filaTimVisualTDJ,tasasMoratorias:tasasSupabaseSimuladas};
const prueba=`const upper=v=>String(v??"").trim().toUpperCase();${fechas}\n${fnTasa}\n[
 tasaPorFechaLocal('19/10/2026','TASA DIAN'),
 tasaPorFechaLocal('19/10/2026','ART. 45 LEY 2155'),
 tasaPorFechaLocal('19/10/2026','ART. 48 LEY 2155'),
 tasaPorFechaLocal('19/10/2026','ART. 91 LEY 2277'),
 tasaPorFechaLocal('29/07/2026','TASA DIAN')
]`;
const [dian,art45,art48,art91,julio]=vm.runInNewContext(prueba,contexto);
assert.equal(dian,0.2659);
assert.ok(art45>0&&art48>0&&art91>0,'Los beneficios derivados recuperan su tasa de octubre');
assert.ok(Math.abs(julio-0.2679)<1e-10,'Excel o TDJ de julio conserva tasa anterior');
assert.match(core,/window\.__tdjTasasEfectivas210=tasas\.map\(/);
assert.match(core,/new CustomEvent\("tdj-tasas-actualizadas"/);
assert.match(vista,/window\.addEventListener\("tdj-tasas-actualizadas",actualizarTasasMotor\)/);
assert.match(vista,/tasasMoratorias=tabla;/);
assert.doesNotMatch(vista,/fetch\("datos\/tasas-moratorias\.json"/);
assert.match(vista,/actualizarTasasMotor\(\);/);
assert.match(core,/anexarTitulosUnicosTDJ\(encontrados,"Importación TDJ"\)/,'El pegado incorpora títulos sin duplicar los existentes');
assert.match(vista,/\|\|"TASA DIAN"/,'Título sin selección explícita inicia TASA DIAN');
const {version}=JSON.parse(fs.readFileSync('version.json','utf8'));
assert.ok(jsEntrada.includes(`tdj-core-16.33.143.js?v=${version}`));
assert.ok(html.includes(`js/tdj.js?v=${version}`));
console.log('PASS TDJ 210: visual motor/Supabase unificados, octubre 26.590%, Ley 2155 y 2277, Excel julio intacto, texto inicia DIAN.');
