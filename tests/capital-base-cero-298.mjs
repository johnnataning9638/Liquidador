import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const [file, name, next] of [
  ['js/app.js', 'tablaInteresesPdf', 'valorNominalPagoPdf'],
  ['js/tdj-core-16.33.143.js', 'tablaInteresesPdfTDJ', 'bloqueSuspensionInteresesPdfTDJ'],
]) {
  const source = fs.readFileSync(file, 'utf8');
  const code = source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${next}(`));
  const render = vm.runInNewContext(`${code}\n${name}`, {
    fechaISO: x=>x, fechaVisible: x=>x, escPdf: String,
    dinero: x=>String(x), tasaPdfArt45: (_, x)=>String(x),
  });
  for (const n of [1,2,3,4,5,6]) {
    const vencimientos = Array.from({length:n}, (_,i)=>({id:`v${i}`, numero:i+1, saldo:0, impuesto:8506000, fecha:'2026-05-19'}));
    const detalle = vencimientos.map((v,i)=>({vto:v.id, cuota:i+1, capitalBase: i===n-1?2862002:0, dias:i===n-1?14:0, tasa:i===n-1?0.045:0, interes:i===n-1?5000:0}));
    const result = {vencimientos};
    const html = render({pago:{valor:819517,fecha:'2026-07-30'}, interesesPorCuota:detalle}, result);
    for(let i=0;i<n;i++) assert.ok(html.includes(`<tr><td>${i+1}</td><td>${detalle[i].capitalBase}</td>`),`${name}: cuota ${i+1} de ${n}`);
    assert.ok(html.includes('<th>5000</th>'));
    const paid = detalle.map(t=>({...t,capitalBase:0,dias:0,tasa:0,interes:0}));
    const closed = render({pago:{valor:1000,fecha:'2026-08-01'}, interesesPorCuota:paid}, result);
    for(let i=0;i<n;i++) assert.ok(closed.includes(`<tr><td>${i+1}</td><td>0</td>`));
    assert.ok(closed.includes('<th>0</th>'));
  }
  console.log(`${name}: capital base y totales correctos para 1–6 cuotas`);
}
