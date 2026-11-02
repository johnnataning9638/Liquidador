import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {revertirPanelTasas271} from './alcance-panel-tasas-271.mjs';
const read=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n');
assert.ok(fs.existsSync('js/catalogo-beneficios.js'),'Debe existir el catálogo compartido DIAN/TDJ');
const {crearCatalogo,filtrarCatalogo}=await import('../js/catalogo-beneficios.js');
const data=JSON.parse(read('datos/beneficios.json'));
const registroOriginal=JSON.stringify(data);
const rows=crearCatalogo(data,[], '2026-11-02');
assert.equal(rows.length,15,'12 tratamientos seleccionables y 3 automáticos');
assert.deepEqual(rows.map(r=>r.id),[
 'D1419_ART9','D1419_ART10_OMISAS','D1419_ART10_CORRECCIONES',
 'D0240_ART3','D0240_ART4','D1474_ART20','D1474_ART21',
 'LEY2277_ART91','LEY2277_ART93','LEY2155_ART45','LEY2155_ART48',
 'D688_ART1','DECRETO688_ART1_IBC50','LEY2010_ART120_AUTO','LEY2010_ART120_PAR3'
],'Orden global del más reciente al más antiguo, sin separar automatismos');
assert.equal(rows.filter(r=>r.activacion==='Automático').length,3);
assert.equal(rows.filter(r=>r.grupo==='actuales').length,3);
assert.equal(new Set(rows.map(r=>r.id)).size,15,'Sin filas duplicadas');
assert.equal(filtrarCatalogo(rows,'corriente','automaticos').length,3);
assert.ok(filtrarCatalogo(rows,'correccion','todos').length>=3,'Búsqueda sin tildes');
assert.equal(filtrarCatalogo(rows,'','historicos').length,12);
const auto=rows.find(r=>r.id==='LEY2010_ART120_AUTO');
assert.ok(auto.norma.includes('par. 2'));
assert.ok(auto.beneficio.includes('2 puntos'));
const futuro={id:'BENEFICIO_FUTURO',nombre:'Nuevo beneficio de prueba',vigenciaDesde:'2027-01-01',fechaPagoHasta:'2027-12-31',efectoInteresFactor:0.25,fuente:'Norma de prueba'};
const extended=crearCatalogo([...data,futuro],[], '2027-02-01');
assert.equal(extended.length,16,'Un registro nuevo aparece sin editar la tabla');
assert.equal(extended[0].id,'BENEFICIO_FUTURO','Un beneficio futuro se ubica automáticamente por fecha');
assert.deepEqual(filtrarCatalogo(rows,'','automaticos').map(r=>r.id),['LEY2155_ART48','D688_ART1','LEY2010_ART120_AUTO'],'Los filtros mantienen el orden cronológico');
assert.deepEqual(crearCatalogo([
 {id:'A',nombre:'A',vigenciaDesde:'2030-01-01'},
 {id:'B',nombre:'B',vigenciaDesde:'2030-06-15'},
 {id:'C',nombre:'C',vigenciaDesde:'2030-06-15'},
 {id:'D',nombre:'D'}
]).map(r=>r.id),['B','C','A','D'],'Orden por fecha completa; empates estables; sin fecha al final');
assert.equal(JSON.stringify(data),registroOriginal,'Ordenar la consulta no modifica el registro de beneficios');
assert.ok(extended.find(r=>r.id===futuro.id).beneficio.includes('25%'));
const fallback=crearCatalogo(data,['NUEVA OPCIÓN SIN FICHA','TASA DIAN'], '2026-11-02');
assert.equal(fallback.length,16,'Nueva opción del selector también queda visible');
assert.match(fallback.at(-1).condiciones.join(' '),/pendiente/i);
assert.equal(crearCatalogo(data,['ART. 48 LEY 2155'], '2026-11-02').length,15,'Alias histórico no duplica el automático');
assert.ok(filtrarCatalogo(rows,'','omisos').length>0);
assert.ok(rows.every(r=>r.fuente&&r.condiciones.length&&r.norma&&r.beneficio),'Fichas completas');
// La consulta puede enriquecer metadatos, nunca cambiar las reglas existentes.
const base='b2032278f1617cf9b6f1fcc445abefc764b13829';
const before=JSON.parse(execFileSync('git',['show',base+':datos/beneficios.json'],{encoding:'utf8'}));
assert.deepEqual(data.map(({consulta,...regla})=>regla),before,'Registro de cálculo intacto');
const manifest=JSON.parse(read('runtime-manifest.json'));
for(const file of Object.keys(manifest.protected))assert.equal(revertirPanelTasas271(read(file),file),execFileSync('git',['show',base+':'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+' intacto salvo panel TIM 271 delimitado');
for(const file of ['liquidacion.html','titulos.html']){
 const html=read(file);
 assert.match(html,/id="btnBeneficios"/);
 assert.ok(html.includes('js/catalogo-beneficios.js?v='+JSON.parse(read('version.json')).version));
}
console.log('CATÁLOGO 269 OK: 15 fichas, filtros, incorporación futura, alias y cálculos intactos');
