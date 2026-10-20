import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TIPO_1419} from '../js/decreto-1419.js';
import {tipoEfectivoTituloDian,ajustarBeneficioTituloDian,filtrarReglasFechaTitulo1419} from '../js/tdj-fechas-dian-206.js';
const casos=[['2025-01-01',true],['2026-08-09',true],['2026-08-10',false],['2026-09-16',false],['2026-09-17',true],['2026-11-19',true],['2026-11-20',false]];
let count=0;
for(const tipo of [TIPO_1419.ART9,TIPO_1419.ART10_OMISO,TIPO_1419.ART10_CORRECCION]){
  for(const [fecha,admitida]of casos){
    const p={tdj:'123456789',fecha,tipo};
    assert.equal(tipoEfectivoTituloDian(p),admitida?tipo:'TASA DIAN');
    assert.equal(ajustarBeneficioTituloDian(p),!admitida);
    assert.equal(p.tipo,admitida?tipo:'TASA DIAN');count++;
    const normal={tdj:'',fecha,tipo};
    assert.equal(tipoEfectivoTituloDian(normal),tipo);
    assert.equal(ajustarBeneficioTituloDian(normal),false);
  }
}
const e=['El artículo 9 admite títulos constituidos antes del 10/08/2026; el título debe tener fecha anterior a ese día.','Para el artículo 10, el título debe constituirse durante la vigencia del beneficio: 17/09/2026 a 19/11/2026.','La obligación no tiene vencimiento en mora al 10/08/2026.'];
assert.deepEqual(filtrarReglasFechaTitulo1419(e,true),[e[2]]);
assert.equal(filtrarReglasFechaTitulo1419(e,false).length,3);
const app=fs.readFileSync('js/app.js','utf8');
assert.match(app,/import \{esTituloDian,ajustarBeneficioTituloDian,tipoEfectivoTituloDian,filtrarReglasFechaTitulo1419\}/);
assert.match(app,/sincronizarPagosDesdeDOM\(\)/);
assert.match(app,/if\(ajustarBeneficioTituloDian\(p\)\)/);
assert.match(app,/motor\.tasaEspecial\(tipoEfectivoTituloDian\(p\),p\.fecha\)/);
assert.match(app,/filtrarReglasFechaTitulo1419\(validarSeleccion1419\(/);
const html=fs.readFileSync('liquidacion.html','utf8');
assert.match(html, /js\/app\.js\?v=16\.33\.(?:2(?:0[7-9]|[1-9][0-9])|[3-9][0-9]{2})/, 'La página DIAN debe cargar una versión 207 o superior');
console.log('PASS DIAN 206',count,'combinaciones de límites, pagos normales intactos, motor/Excel/UI sincronizados.');
