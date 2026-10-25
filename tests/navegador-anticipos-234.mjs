import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/anticipos-234');
const live=process.env.TEST_BASE_URL;
const base=live||'http://127.0.0.1:23400';
const external=process.argv[2];
let expected=external?JSON.parse(await fs.readFile(process.argv[3],'utf8')):Array.from({length:6},(_,i)=>({fecha:`2024-${String(i+1).padStart(2,'0')}-15`,impuesto:(i+1)*123000,periodo:String(i+1)}));
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
const errors=[],alerts=[];
try{
 const ctx=await browser.newContext({viewport:{width:1400,height:1000}});
 ctx.setDefaultTimeout(12000);ctx.setDefaultNavigationTimeout(15000);
 await ctx.route('**/*',async route=>{
  if(live)return route.continue();
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(url.pathname).slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({status:200,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
 const choose=async(button,file)=>{
  const ready=page.waitForEvent('dialog');
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),button.click()]);
  await chooser.setFiles(file);await ready;
  // La recuperación de pagos programa el cambio de pestaña a los 50 ms.
  // Esperar ese cierre de la interfaz antes de seleccionar la siguiente pestaña.
  await page.waitForTimeout(100);
 };
 const readCuotas=async(selector)=>page.locator(selector).evaluateAll(rows=>rows.map(row=>({
  fecha:row.querySelector('.fecha-native')?.value,
  impuesto:Number((row.querySelector('[data-v="impuesto"]')?.value||'').replace(/[^0-9-]/g,'')),
  periodo:row.querySelector('[data-v="periodo"]')?.value
 })));
 await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});
 await page.waitForSelector('.obligacion-card');
 let source=external;
 if(!source){
  await page.locator('#nitGlobal').fill('900000123');await page.locator('#razonGlobal').fill('PRUEBA FICTICIA 234');
  await page.locator('.obligacion-card [data-k="concepto"]').selectOption('VENTAS');
  await page.locator('.obligacion-card [data-k="anio"]').fill('2024');await page.locator('.obligacion-card [data-k="anio"]').dispatchEvent('change');
  await page.locator('.obligacion-card [data-k="periodo"]').selectOption('1');
  await page.locator('#destinoImportacionObligacion').selectOption({index:1});
  await page.locator('#importarObligacionTexto').fill('Fecha\tImpuesto\n'+expected.map(v=>v.fecha.split('-').reverse().join('/')+'\t'+v.impuesto).join('\n'));
  await page.locator('#btnImportarObligacionTDJ').click();
  assert.equal(await page.locator('.cuotas-mini tbody tr').count(),6);
  await page.locator('[data-tab="pagos"]').click();
  await page.locator('#destinoImportacionPagos').selectOption({index:1});
  await page.locator('#importarPagosTexto').fill('Recibo\tFecha\tValor\n4999999999999\t15/01/2024\t10000');
  await page.locator('#btnImportarPagosTDJ').click();
  await page.evaluate(()=>{const create=URL.createObjectURL;URL.createObjectURL=blob=>{window.__xlsx234=blob;return create.call(URL,blob);};});
  await page.locator('.tdj-excel:visible').first().click();await page.waitForFunction(()=>Boolean(window.__xlsx234));
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__xlsx234.arrayBuffer())));
  source=path.join(output,'seis-anticipos-sin-titulos.xlsx');await fs.writeFile(source,new Uint8Array(bytes));
 }
 await choose(page.locator('.tdj-import-excel:visible').first(),source);
 await page.waitForFunction(()=>document.querySelectorAll('.cuotas-mini tbody tr').length===6);
 assert.deepEqual(await readCuotas('.cuotas-mini tbody tr'),expected,'TDJ debe recuperar las seis fechas e impuestos');
 console.log('TDJ: seis anticipos recuperados');
 await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
 await choose(page.locator('.btn-importar-excel:visible').first(),source);
 await page.waitForFunction(()=>document.querySelectorAll('#tablaVencimientos tbody tr').length===6,{},{timeout:5000}).catch(()=>{});
 const actual=await readCuotas('#tablaVencimientos tbody tr');
 await fs.writeFile(path.join(output,'importacion-234.json'),JSON.stringify({modo:live?'produccion':'local',archivoOriginal:Boolean(external),esperados:expected,importados:actual,alertas:alerts,errores:errors},null,2));
 assert.deepEqual(actual,expected,'DIAN debe recuperar exactamente los seis anticipos del mismo Excel');
 console.log('DIAN: seis anticipos recuperados');
 assert.deepEqual(errors,[]);
 assert.equal(alerts.some(x=>/No fue posible|Se cancela/.test(x)),false,alerts.join('\n'));
 await page.locator('[data-tab="datos"]').click();
 await page.locator('[data-pane="datos"] .btn-calcular-normal').click();
 await page.waitForFunction(()=>Number(document.querySelector('#rDeudaImpuesto')?.textContent.replace(/[^0-9]/g,''))>0);
 // Exportar y reimportar la reconstrucción DIAN con las mismas seis cuotas.
 // El archivo original permanece intacto; los artefactos quedan en output.
 await page.evaluate(()=>{const create=URL.createObjectURL;URL.createObjectURL=blob=>{window.__dian234=blob;return create.call(URL,blob);};});
 await page.locator('[data-tab="resultados"]').click();
 await page.locator('#btnExportarExcel').click();await page.waitForFunction(()=>Boolean(window.__dian234));
 console.log('DIAN: Excel exportado');
 const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__dian234.arrayBuffer())));
 const roundtrip=path.join(output,'roundtrip-dian.xlsx');await fs.writeFile(roundtrip,new Uint8Array(bytes));
 await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
 await choose(page.locator('.btn-importar-excel:visible').first(),roundtrip);
 await page.waitForFunction(()=>document.querySelectorAll('#tablaVencimientos tbody tr').length===6);
 assert.deepEqual(await readCuotas('#tablaVencimientos tbody tr'),expected,'DIAN → Excel → DIAN debe conservar las seis cuotas');
 await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});
 await page.waitForSelector('.obligacion-card');
 await choose(page.locator('.tdj-import-excel:visible').first(),roundtrip);
 await page.waitForFunction(()=>document.querySelectorAll('.cuotas-mini tbody tr').length===6);
 assert.deepEqual(await readCuotas('.cuotas-mini tbody tr'),expected,'DIAN → Excel → TDJ debe conservar las seis cuotas');
 await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
 await choose(page.locator('.btn-importar-excel:visible').first(),source);
 await page.waitForFunction(()=>document.querySelectorAll('#tablaVencimientos tbody tr').length===6);
 await page.locator('[data-tab="datos"]').click();
 await page.screenshot({path:path.join(output,'anticipos-dian.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('ANTICIPOS 234 OK: seis fechas e impuestos en TDJ y DIAN; exportar/reimportar DIAN y cruce TDJ sin pérdidas');
}finally{await browser.close();}
