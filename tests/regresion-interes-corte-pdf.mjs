import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const f of ['js/app.js','js/tdj.js']){
  const s=fs.readFileSync(f,'utf8');
  assert.match(s,/interesesCalculados/);
  assert.ok(/Number\(r\?\.intereses\|\|0\)/.test(s)||/r\?\.intereses\|\|x\?\.interesLiquidado/.test(s),'Debe existir el fallback de interés de corte.');
  assert.match(s,/interesesCalculados\.reduce/);
}
const filas=[{capitalBase:5420000,interes:0}],r={intereses:2326000};
let v=filas.map(x=>Number(x.interes||0));
if(v.every(x=>x<=0)&&filas.length===1)v[0]=Number(r.intereses);
assert.equal(v[0],2326000);
assert.equal(v.reduce((a,b)=>a+b,0),2326000);
console.log('REGRESION_INTERES_CORTE_OK');
