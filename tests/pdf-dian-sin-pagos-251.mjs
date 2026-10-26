import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const source=fs.readFileSync('js/app.js','utf8');
const fn=source.slice(source.indexOf('function bloquePdfSinPagos('),source.indexOf('\nfunction exportarPdf('));
const ctx=vm.createContext({escPdf:String,dinero:n=>`$ ${Number(n||0)}`,fechaVisible:String,dvNIT:()=>0,hoyISO:()=> '2026-10-26'});
vm.runInContext(source.match(/const tasaPdfArt45=.*;/)[0]+fn,ctx);
for(const tipoLiquidacion of ['PRIVADA','OFICIAL']){
 for(const tasas of [[0.2449,0.25],[],[null]]){
  const d={tipoLiquidacion,nit:'900000001',razonSocial:'PRUEBA',fechaCorte:'2026-10-26'};
  const r={impuesto:1000000,intereses:21000,sancion:0,total:1021000,fechaCorte:d.fechaCorte,vencimientos:[],interesesPorCuota:tasas.map((tasa,i)=>({tasa,base:1000000,interes:21000,dias:30,vto:i+1}))};
  const before=JSON.stringify({d,r});
  const html=ctx.bloquePdfSinPagos(d,r);
  assert.ok(html.includes('SIN PAGOS'));
  assert.ok(html.includes('$ 1021000'));
  if(tasas[0]!=null)assert.ok(html.includes('24.490% / 25.000%'));
  else assert.ok(html.includes('TASA DIAN'));
  assert.equal(JSON.stringify({d,r}),before,'La presentación no modifica resultados');
 }
}
console.log('PDF DIAN 251 OK: privada/oficial sin pagos; tasas múltiples, nulas y ausentes; resultados intactos');

const previous=execFileSync('git',['show','0ded9461dcaa7aeb1805bd66c4d10609c9476dcb:js/app.js'],{encoding:'utf8'});
assert.equal(source,previous.replace('map(t=>tasaPdfArt45(x,Number(t.tasa)*100))','map(t=>tasaPdfArt45(null,Number(t.tasa)*100))'),'Una única corrección de presentación frente a 250');
for(const f of ['js/motor-liquidacion.js','js/motor-liquidacion-base.js','js/motor-liquidacion-oficial.js','js/tdj-core-16.33.143.js'])assert.equal(fs.readFileSync(f,'utf8'),execFileSync('git',['show','0ded9461dcaa7aeb1805bd66c4d10609c9476dcb:'+f],{encoding:'utf8'}),f+' intacto');
