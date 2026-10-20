import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fechaElegible1419TDJ, tasaEfectiva1419TDJ, tipoTasaTDJ, filasTasasTDJ, recuperarTasasTDJ, esBeneficio1419TDJ} from '../js/tdj-tasas-203.js';
import {TIPO_1419} from '../js/decreto-1419.js';

const tipos=[TIPO_1419.ART9,TIPO_1419.ART10_OMISO,TIPO_1419.ART10_CORRECCION];
const casos=[
 ['2020-01-02',true],['2026-08-08',true],['2026-08-09',true],
 ['2026-08-10',false],['2026-09-16',false],['2026-09-17',true],
 ['2026-11-19',true],['2026-11-20',false],['2027-01-01',false],
 ['',false],['2026-02-30',false],['2026-09-17T10:00:00',false]
];
let comprobaciones=0;
for(const [fecha,permitida] of casos){
  assert.equal(fechaElegible1419TDJ(fecha),permitida,fecha);comprobaciones++;
  for(const tipo of tipos){
    assert.equal(esBeneficio1419TDJ(tipo),true,tipo);
    assert.equal(tasaEfectiva1419TDJ(tipo,fecha),permitida?tipo:'TASA DIAN',tipo+' '+fecha);comprobaciones++;
  }
}
const obligaciones=[{id:'O1',numero:1,tipoTasa:'TASA DIAN'},{id:'O2',numero:2,tipoTasa:'TASA DIAN'}];
const titulos=[
 {id:'T1',numero:1,tdj:'111',fecha:'2026-08-09',tasasPorObligacion:{O1:TIPO_1419.ART9,O2:TIPO_1419.ART10_CORRECCION}},
 {id:'T2',numero:2,tdj:'222',fecha:'2026-08-10',tasasPorObligacion:{O1:TIPO_1419.ART9,O2:TIPO_1419.ART10_OMISO}},
 {id:'T3',numero:3,tdj:'333',fecha:'2026-09-17',tasasPorObligacion:{O1:TIPO_1419.ART9,O2:TIPO_1419.ART10_OMISO}},
 {id:'T4',numero:4,tdj:'444',fecha:'2026-11-20',tasasPorObligacion:{O1:TIPO_1419.ART9,O2:TIPO_1419.ART10_OMISO}}
];
assert.equal(tipoTasaTDJ(titulos[0],obligaciones[1]),TIPO_1419.ART10_CORRECCION);
assert.equal(tipoTasaTDJ(titulos[1],obligaciones[0]),'TASA DIAN');
assert.equal(tipoTasaTDJ(titulos[2],obligaciones[1]),TIPO_1419.ART10_OMISO);
assert.equal(tipoTasaTDJ(titulos[3],obligaciones[0]),'TASA DIAN');
const filas=filasTasasTDJ(titulos,obligaciones,tipo=>tipo==='TASA DIAN'?0.25:0.045);
assert.equal(filas.length,8);
assert.deepEqual(filas.filter(x=>x[1]===2).map(x=>x[5]),['TASA DIAN','TASA DIAN']);
assert.deepEqual(filas.filter(x=>x[1]===3).map(x=>x[5]),[TIPO_1419.ART9,TIPO_1419.ART10_OMISO]);
const reconstruidos=titulos.map(t=>({id:t.id,numero:t.numero,tdj:t.tdj,fecha:t.fecha}));
recuperarTasasTDJ(filas,reconstruidos,obligaciones);
for(let i=0;i<titulos.length;i++)for(const o of obligaciones)assert.equal(tipoTasaTDJ(reconstruidos[i],o),tipoTasaTDJ(titulos[i],o));
assert.equal(tasaEfectiva1419TDJ('ART. 45 LEY 2155','2026-08-15'),'ART. 45 LEY 2155');
assert.equal(tasaEfectiva1419TDJ('TASA DIAN','2026-09-17'),'TASA DIAN');
const core=fs.readFileSync('js/tdj-core-16.33.143.js','utf8');
const visual=fs.readFileSync('js/tdj-visual-beneficios.js','utf8');
assert.match(core,/fechaElegible1419TDJ\(pago\?\.fecha\)/);
assert.match(visual,/esBeneficio1419TDJ\(tipo\)&&!fechaElegible1419TDJ\(fecha\)/);
assert.match(visual,/actualizarMapaGlobal\(titleId,index,tipo\)/);
console.log('PASS TDJ 205: '+comprobaciones+' límites artículo 9 y 10, selección visual, motor y matriz XLSX.');
