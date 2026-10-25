import {chromium} from './browser-runtime.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const version=process.env.EXPECTED_APP_VERSION||JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url),'utf8')).version;
// Se conserva la expectativa crítica histórica, incluso si producción falla.
// La observación de la 231 se documenta por separado y no se acepta como oráculo.
const {expected}=JSON.parse(fs.readFileSync(new URL('./fixtures/tdj-prioridad-base-231.json',import.meta.url),'utf8'));
const U=`https://liquidador-de-obligaciones-tributarias.onrender.com/titulos.html?v=${version}`;
const n=v=>Number(String(v||'').replace(/[^0-9-]/g,''))||0; const ok=(x,m)=>{if(!x)throw new Error('LIVE TDJ 177: '+m)};
const b=await chromium.launch({headless:true}); const p=await b.newPage({acceptDownloads:true,viewport:{width:1600,height:1000}});
const date=async(l,v)=>{await l.fill(v);await l.dispatchEvent('change')}; const money=async(l,v)=>{await l.fill(String(v));await l.dispatchEvent('input');await l.dispatchEvent('change');await l.blur()};
try{
 let live=false,last=''; for(let i=0;i<8;i++){try{const r=await p.goto(U,{waitUntil:'domcontentloaded',timeout:20000});last='HTTP '+r?.status();if((await p.content()).includes(`· v${version}`)){live=true;break}}catch(e){last=e.message}await p.waitForTimeout(1500)} ok(live,'Render no entrega '+version+': '+last);
 await p.waitForSelector('#listaObligaciones .obligacion-card',{timeout:20000});
 const o=p.locator('#listaObligaciones .obligacion-card').first(); await p.locator('#nitGlobal').fill('901473152'); await o.locator('[data-k="concepto"]').selectOption({label:'VENTAS'}); await o.locator('[data-k="anio"]').fill('2025'); await o.locator('[data-k="anio"]').dispatchEvent('change'); await o.locator('[data-k="periodo"]').selectOption('3'); await o.locator('[data-k="tieneSancion"]').selectOption('SI'); await money(o.locator('[data-k="valorSancion"]'),524000); await date(o.locator('.fecha-dual .fecha-native').first(),'2026-06-16'); await o.locator('[data-k="beneficioSancion"]').selectOption({label:'SIN BENEFICIO'}); await date(o.locator('.cuotas-mini tbody tr').first().locator('.fecha-native'),'2026-01-14'); await money(o.locator('.cuotas-mini tbody tr').first().locator('[data-v="impuesto"]'),40771000);
 await p.locator('[data-tab="pagos"]').click(); for(let i=0;i<3;i++)await p.locator('[data-action="agregar-pago"]').click(); const ps=p.locator('.pagos-mini tbody tr'); const ds=['2026-06-16','2026-07-14','2026-10-01'],vs=[15027000,5986000,8193000]; for(let i=0;i<3;i++){await date(ps.nth(i).locator('.fecha-native'),ds[i]);await money(ps.nth(i).locator('[data-p="valor"]'),vs[i])} await ps.nth(2).locator('[data-p="tipo"]').selectOption({label:'ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO'});
 await p.locator('[data-tab="titulos"]').click(); for(let i=0;i<4;i++)await p.locator('#btnAgregarTitulo').click(); const ts=p.locator('#tablaTitulos tbody tr'),ids=['469030003386678','46903000338669','469030003386680','469030003387674'],tv=[500000,500000,20000000,10000000]; for(let i=0;i<4;i++){await ts.nth(i).locator('[data-t="tdj"]').fill(ids[i]);await ts.nth(i).locator('[data-t="valor"]').fill(String(tv[i]));await ts.nth(i).locator('[data-t="valor"]').dispatchEvent('input');await ts.nth(i).locator('[data-t="valor"]').blur();await date(ts.nth(i).locator('.fecha-native'),'2026-07-24')}
 await p.locator('.btn-calcular-tdj').last().click(); await p.waitForFunction(()=>document.querySelector('#resEndoso')?.textContent?.trim()!=='',{timeout:20000});
 const s={total:n(await p.locator('#resTotalTitulos').innerText()),applied:n(await p.locator('#resAplicado').innerText()),saldo:n(await p.locator('#resSaldo').innerText()),endoso:n(await p.locator('#resEndoso').innerText())};console.log('CIERRE CRÍTICO',JSON.stringify(s)); ok(s.total===expected.total,'total '+s.total);ok(s.applied===expected.applied,'aplicado '+s.applied);ok(s.saldo===expected.saldo,'saldo '+s.saldo);ok(s.endoso===expected.endoso,'endoso '+s.endoso);ok(s.applied+s.endoso===s.total,'conservación del valor de los títulos');
 const rows=p.locator('#tablaAplicacion tbody tr'),tr={};
 for(let i=0;i<await rows.count();i++){
   const c=await rows.nth(i).locator('td').allTextContents(),id=c[0].trim(),index=ids.indexOf(id);
   ok(index>=0,'título trazable '+id);
   const applied=(tr[id]?.applied||0)+(c.length===10?n(c[7]):0);
   tr[id]={applied,saldo:tv[index]-applied};
 }
 ok(tr[ids[0]]?.applied===500000,'TDJ1');ok(tr[ids[1]]?.applied===500000,'TDJ2');ok(tr[ids[2]]?.applied===expected.thirdApplied&&tr[ids[2]]?.saldo===expected.thirdRemainder,'TDJ3');ok(tr[ids[3]]?.applied===expected.fourthApplied&&tr[ids[3]]?.saldo===expected.fourthRemainder,'TDJ4 sigue consumiéndose');
 const formatted=value=>new Intl.NumberFormat('es-CO').format(value);
 const et=(await p.locator('#tablaEndoso tbody tr').allTextContents()).join('\n');ok(et.includes(ids[2])&&et.includes(formatted(expected.thirdRemainder)),'endoso TDJ3');ok(et.includes(ids[3])&&et.includes(formatted(expected.fourthRemainder)),'endoso TDJ4');
 // El exportador vigente abre una vista imprimible, en lugar de descargar PDF.
 const pd=await (async()=>{
   await p.context().addInitScript(()=>{window.print=()=>{};});
   const w=p.waitForEvent('popup'); await p.locator('.tdj-pdf').last().click(); const preview=await w;
   await preview.waitForLoadState(); const f=path.join(os.tmpdir(),'tdj177.pdf');
   await preview.pdf({path:f,format:'A4',printBackground:true}); await preview.close();
   return process.env.PYTHON_FOR_PDF ? execFileSync(process.env.PYTHON_FOR_PDF,['-X','utf8','-c','import sys; from pypdf import PdfReader; print("\\n".join(p.extract_text() for p in PdfReader(sys.argv[1]).pages))',f],{encoding:'utf8'}) : execFileSync('pdftotext',[f,'-'],{encoding:'utf8'});
 })();ok(pd.includes(formatted(expected.fourthRemainder)),'PDF TDJ4');ok(pd.includes(formatted(expected.endoso)),'PDF endoso total');
 const xd=await (async()=>{
   await p.evaluate(()=>{const create=URL.createObjectURL;URL.createObjectURL=function(blob){window.__criticalXlsx=blob;return create.call(this,blob);};});
   await p.locator('.tdj-excel').last().click(); await p.waitForFunction(()=>Boolean(window.__criticalXlsx));
   return p.evaluate(async()=>{const {leerXlsxPrimeraHoja}=await import('./js/importador-excel.js');return JSON.stringify(await leerXlsxPrimeraHoja(window.__criticalXlsx));});
 })();ok(xd.includes('469030003386680')&&xd.includes('20000000'),'Excel TDJ3 original');ok(xd.includes('469030003387674')&&xd.includes('10000000'),'Excel TDJ4 original');ok(xd.includes(String(expected.endoso)),'Excel endoso');
 console.log('LIVE TDJ 177 OK'); console.log(JSON.stringify({summary:s,trace:tr},null,2));
 await p.locator('.btn-calcular-tdj').last().click();
 ok(n(await p.locator('#resAplicado').innerText())===expected.applied,'recalcular conserva la aplicación');
 ok(n(await p.locator('#resEndoso').innerText())===expected.endoso,'recalcular conserva el endoso');
 ok(n(await p.locator('#tablaTitulos [data-t="valor"]').nth(3).inputValue())===expected.fourthRemainder,'la captura conserva el título nominal');
}finally{await b.close()}
