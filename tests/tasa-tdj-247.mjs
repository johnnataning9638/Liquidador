import fs from 'node:fs';
import vm from 'node:vm';
import {filaTimVisualTDJ,referenciaTimTDJ} from '../js/tdj-tasa-vista-207.js';
import assert from 'node:assert/strict';
const source=fs.readFileSync('js/tdj-visual-beneficios.js','utf8');
const start=source.indexOf('  function tasaPorFechaLocal('),end=source.indexOf('\n  function mostrarTasa(',start);
const tasas=JSON.parse(fs.readFileSync('datos/tasas-moratorias.json','utf8'));
const ctx=vm.createContext({filaTimVisualTDJ,tasasMoratorias:tasas,upper:s=>String(s).trim().toUpperCase(),fechaISOVisual:s=>s});
vm.runInContext(source.slice(start,end),ctx);
assert.equal(vm.runInContext("tasaPorFechaLocal('2026-03-31','TASA DIAN')",ctx),0.2352,'El 31 de marzo muestra la tasa disponible del mismo mes');

for(const date of ['2026-03-30','2026-03-31']){
 for(const [tipo,expected] of [['TASA DIAN',0.2352],['ART. 91 LEY 2277',0.1176],['ART. 93 LEY 2277 - OMISAS',0.0941],['ART. 45 LEY 2155',0.034],['ART. 48 LEY 2155',0.1701],['ART. 120 LEY 2010 2018 PARAG 3- IBC+2',0.1901]])
  assert.equal(vm.runInContext(`tasaPorFechaLocal('${date}','${tipo}')`,ctx),expected,`${date} ${tipo}`);
}
assert.ok(Math.abs(vm.runInContext("tasaPorFechaLocal('2026-04-04','TASA DIAN')",ctx)-0.2476)<1e-12);
assert.equal(vm.runInContext("tasaPorFechaLocal('2026-11-01','TASA DIAN')",ctx),null,'No inventar tasa de otro mes');
assert.equal(filaTimVisualTDJ('2026-02-01',tasas.filter(x=>x.desde>'2026-02-01')),null,'Sin usar tasas futuras');
assert.equal(filaTimVisualTDJ('',tasas),null);
assert.deepEqual(referenciaTimTDJ('2026-11-01',tasas),{tasa:0.2659,periodo:'2026-10'});
console.log('TASA TDJ 247 OK: 30/31 marzo, abril, tasas derivadas y meses sin datos');
