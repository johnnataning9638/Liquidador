import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/tdj-pdf-252');
const live=process.env.TEST_BASE_URL;
const base=live||'http://127.0.0.1:23400';
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

 const fixture=path.resolve(fileURLToPath(new URL('./fixtures/sancion-proporcional-248.xlsx',import.meta.url)));
 const numeric=v=>Number(String(v||'').replace(/[^0-9-]/g,''));
 const choose=async(button,file)=>{
  const ready=page.waitForEvent('dialog');const [chooser]=await Promise.all([page.waitForEvent('filechooser'),button.click()]);
  await chooser.setFiles(file);await ready;await page.waitForTimeout(100);
 };
 const captureExcel=async(button,label)=>{
  await page.evaluate(()=>{window.__xlsx248=null;const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.__xlsx248=blob;return original.call(URL,blob);};});
  await button.click();await page.waitForFunction(()=>Boolean(window.__xlsx248));
  const rows=await page.evaluate(async()=>{const {leerXlsxPrimeraHoja}=await import('./js/importador-excel.js');return leerXlsxPrimeraHoja(window.__xlsx248);});
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__xlsx248.arrayBuffer())));
  const file=path.join(output,label+'.xlsx');await fs.writeFile(file,new Uint8Array(bytes));return {file,rows};
 };
 await ctx.addInitScript(()=>{window.print=()=>{};});
 let sourceFile=process.env.FIXTURE_FILE;
 if(!sourceFile){
  await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
  await choose(page.locator('.btn-importar-excel:visible').first(),fixture);
  while(await page.locator('[data-clear]').count()>1)await page.locator('[data-clear]').last().click();
  await page.locator('#tieneSancion').selectOption('NO');
  await page.locator('#concepto').selectOption('VENTAS');
  await page.locator('.fecha-vto').fill('17/07/2026');await page.locator('.fecha-vto').press('Tab');
  await page.locator('[data-v="impuesto"]').fill('1000000');await page.locator('[data-v="impuesto"]').press('Tab');
  await page.locator('[data-tab="pagos"]').click();
  await page.locator('[data-k="recibo"]').fill('');
  await page.locator('[data-k="valor"]').fill('0');await page.locator('[data-k="valor"]').press('Tab');
  await page.locator('.fecha-pago').fill('20/10/2026');await page.locator('.fecha-pago').press('Tab');
  await page.locator('.btn-calcular-normal:visible').first().click();
  sourceFile=(await captureExcel(page.locator('#btnExportarExcel'),'origen-sintetico')).file;
 }
 const modes=process.env.EXPECT_MISSING==='1'?['importado']:['importado','sin-corte'];
 for(const mode of modes){
  await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});
  await page.waitForSelector('.obligacion-card');
  await choose(page.locator('.tdj-import-excel:visible').first(),sourceFile);
  await page.locator('[data-tab="pagos"]').click();
  const fechas=await page.locator('.pagos-mini .fecha-campo').evaluateAll(els=>els.map(x=>x.value));
  if(process.env.EXPECT_MISSING!=='1')assert.equal(fechas[0],process.env.FIXTURE_FILE?'26/10/2026':'20/10/2026','Conservar el corte importado');
  if(mode==='sin-corte')await page.locator('[data-pdel]').first().click();
  await page.locator('[data-tab="titulos"]').click();
  await page.locator('.btn-calcular-tdj:visible').first().click();
  const ui=await page.locator('#tablaResultadoObligaciones tbody').textContent();
  const total=numeric(await page.locator('#tablaResultadoObligaciones tbody tr td').last().textContent());
  const [preview]=await Promise.all([page.waitForEvent('popup'),page.locator('.tdj-pdf:visible').first().click()]);
  await preview.waitForSelector('main.pdf-soporte');
  await preview.waitForSelector('#tdj-pdf-cierre-189-style',{state:'attached'});
  const data=await preview.evaluate(()=>({titles:[...document.querySelectorAll('.pdf-titulo')].map(x=>x.textContent),projections:document.querySelectorAll('.pdf-proyeccion-corte, .pdf-sancion-dian').length,text:document.querySelector('main').textContent}));
  if(process.env.EXPECT_MISSING==='1')assert.equal(data.projections,0);
  else{
   assert.equal(data.projections,1,'Una liquidación antes del resumen');
   assert.ok(data.titles[0].includes('LIQUIDADOR OBLIGACIONES')||data.titles[0]==='LIQUIDACIÓN DE OBLIGACIÓN — PROYECCIÓN','Encabezado de liquidación');
   const pdfTotal=numeric(await preview.locator('.pdf-sancion-dian .pdf-pago .total td:last-child, .pdf-proyeccion-corte .pdf-bloque tfoot').first().textContent());
   assert.equal(pdfTotal,total,'Liquidación PDF coincide con resultado UI');
   assert.ok(data.text.includes('CÁLCULO DE INTERESES'),'Detalle de intereses conservado');
   assert.ok(!data.text.includes('0.266%'),'Sin tasa dividida dos veces por cien');
   if(mode==='importado')assert.equal(total,process.env.FIXTURE_FILE?130273000:1069000,'Resultado independiente esperado');
   const excel=await captureExcel(page.locator('.tdj-excel:visible').first(),mode);
   const i=excel.rows.findIndex(r=>r[0]==='TOTAL TÍTULOS'&&r.includes('SALDO OBLIGACIONES'));
   assert.equal(Number(excel.rows[i+1][2]),total,'Excel coincide con PDF y UI');
   assert.equal(await page.locator('#tablaAplicacion tbody tr').count(),0,'Sin aplicaciones ficticias');
  }
  await fs.writeFile(path.join(output,mode+'.json'),JSON.stringify({ui,...data,errors,alerts},null,2));
  await preview.pdf({path:path.join(output,mode+'.pdf'),format:'A4',printBackground:true});
  console.log(JSON.stringify({mode,total,projections:data.projections,errors}));
  assert.deepEqual(errors,[]);await preview.close();
 }
}finally{await browser.close();}
