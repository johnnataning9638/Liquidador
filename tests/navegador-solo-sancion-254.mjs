import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/solo-sancion-254');
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
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());console.log('DIALOG',d.message());await d.accept();});



 const money=v=>Number(String(v||'').replace(/[^0-9-]/g,''));
 const set=async(sel,v)=>{await page.locator(sel).fill(v);await page.locator(sel).press('Tab');};
 const pdf=async(button,label,total)=>{
  const [p]=await Promise.all([page.waitForEvent('popup'),button.click()]);await p.waitForSelector('main');
  const text=await p.locator('main').textContent();assert.ok(text.includes('01/01/2023')||label.includes('reciente'));
  const cells=await p.locator('td,th,strong').allTextContents();assert.ok(cells.some(c=>money(c)===total),'PDF refleja sanción actualizada');
  await p.pdf({path:path.join(output,label+'.pdf'),format:'A4',printBackground:true});await p.close();
 };
 const excel=async(button,label)=>{
  await page.evaluate(()=>{window.__blob254=null;const old=URL.createObjectURL;URL.createObjectURL=b=>{window.__blob254=b;return old.call(URL,b);};});await button.click();await page.waitForFunction(()=>window.__blob254);
  const b=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__blob254.arrayBuffer())));const f=path.join(output,label+'.xlsx');await fs.writeFile(f,new Uint8Array(b));return f;
 };
 const choose=async(b,f)=>{const done=page.waitForEvent('dialog');const [c]=await Promise.all([page.waitForEvent('filechooser'),b.click()]);await c.setFiles(f);await done;await page.waitForTimeout(200);};
 await ctx.addInitScript(()=>{window.print=()=>{};});
 const results=[];
 // Primero TDJ: reproducción exacta de formulario nuevo, ninguna cuota tocada.
 for(const module of ['tdj','dian','dian-oficial'])for(const reciente of [false,true]){
  const tdj=module==='tdj';await page.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});
  if(tdj){
   await page.waitForSelector('.obligacion-card');await set('#nitGlobal','900000001');await set('#razonGlobal','PRUEBA SOLO SANCION');
   await page.locator('[data-k="concepto"]').selectOption('RENTA');await set('[data-k="anio"]','2022');await page.locator('[data-k="periodo"]').selectOption('1');
   await page.locator('[data-k="tieneSancion"]').selectOption('SI');await set('[data-k="valorSancion"]','2500000');
   await set('.obligacion-card .compact-grid .fecha-campo',reciente?'01/01/2026':'01/01/2023');
   assert.equal(await page.locator('.cuotas-mini .fecha-campo').inputValue(),'','Cuota sin fecha desde formulario nuevo');
   await page.locator('[data-tab="pagos"]').click();if(!await page.locator('.pagos-mini tbody tr').count())await page.locator('[data-action="agregar-pago"]').click();
   await set('.pagos-mini .fecha-campo','21/01/2026');await set('[data-p="valor"]','');
   await page.locator('[data-tab="titulos"]').click();await page.locator('.btn-calcular-tdj:visible').first().click();
  }else{
   await set('#nit','900000001');await set('#razonSocial','PRUEBA SOLO SANCION');await page.locator('#concepto').selectOption('RENTA');await set('#anio','2022');await page.locator('#periodo').selectOption('1');
   await page.locator('#tieneSancion').selectOption('SI');await page.locator('#tipoLiquidacion').selectOption(module==='dian-oficial'?'OFICIAL':'PRIVADA');await set('#valorSancion','2500000');await set('#fechaSancion',reciente?'01/01/2026':'01/01/2023');
   assert.equal(await page.locator('.fecha-vto').first().inputValue(),'','No introducir fecha de vencimiento');
   await page.locator('[data-tab="pagos"]').click();if(!await page.locator('#tablaPagos tbody tr').count())await page.locator('#btnAgregarPago').click();await set('.fecha-pago','21/01/2026');await set('[data-k="valor"]','0');
   await page.locator('.btn-calcular-normal:visible').first().click();
  }
  const totalSelector=tdj?'#tablaResultadoObligaciones tbody tr td:last-child':'#rSaldoTotalFooter';
  await page.waitForSelector(tdj?'#tablaResultadoObligaciones tbody tr':'#rSaldoTotalFooter');
  const total=money(await page.locator(totalSelector).textContent());assert.ok(total>=2500000,'Sanción existente, sin cuota ficticia');if(reciente)assert.equal(total,2500000);else assert.ok(total>2500000,'Actualiza desde fecha de sanción de 2023');
  assert.equal(money(await page.locator(tdj?'#resSaldoImpuesto':'#rSaldoImpuesto').textContent()),0);
  if(!tdj)assert.equal(money(await page.locator('#rSaldoIntereses').textContent()),0);
  const label=module+(reciente?'-reciente':'-captura');
  await page.screenshot({path:path.join(output,label+'.png'),fullPage:true});
  await pdf(page.locator(tdj?'.tdj-pdf:visible':'#btnExportarPdf').first(),label,total);
  const file=await excel(page.locator(tdj?'.tdj-excel:visible':'#btnExportarExcel').first(),label);
  await page.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});
  if(tdj)await page.waitForSelector('.obligacion-card');
  else{await set('.fecha-vto','01/01/2022');await set('[data-v="impuesto"]','1000000');}
  await choose(page.locator(tdj?'.tdj-import-excel:visible':'.btn-importar-excel:visible').first(),file);
  if(tdj)await page.locator('[data-tab="titulos"]').click();await page.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();
  assert.equal(money(await page.locator(totalSelector).textContent()),total,'Reimportación de solo sanción sin fechas de cuota');
  if(!tdj)await page.locator('[data-pane="resultados"].active').waitFor({state:'visible'});
  await page.locator('[data-tab="pagos"]').click();
  await page.locator(tdj?'[data-action="agregar-pago"]':'#btnAgregarPago').click();
  const payment=page.locator(tdj?'.pagos-mini tbody tr':'#tablaPagos tbody tr').last();
  await payment.locator(tdj?'.fecha-campo':'.fecha-pago').fill('11/01/2026');await payment.locator(tdj?'.fecha-campo':'.fecha-pago').press('Tab');
  await payment.locator(tdj?'[data-p="valor"]':'[data-k="valor"]').fill('10000');await payment.locator(tdj?'[data-p="valor"]':'[data-k="valor"]').press('Tab');
  if(tdj){
   await page.locator('[data-tab="titulos"]').click();await page.locator('#btnAgregarTitulo').click();const title=page.locator('#tablaTitulos tbody tr').last();
   await title.locator('[data-t="tdj"]').fill('254000001');await title.locator('.fecha-campo').fill('15/01/2026');await title.locator('.fecha-campo').press('Tab');await title.locator('[data-t="valor"]').fill('10000');await title.locator('[data-t="valor"]').press('Tab');
   await title.locator('select').last().selectOption('TASA DIAN');
  }
  await page.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();
  assert.equal(money(await page.locator(totalSelector).textContent()),total-(tdj?20000:10000),'Pagos/títulos descuentan sanción sin necesitar cuota');
  await pdf(page.locator(tdj?'.tdj-pdf:visible':'#btnExportarPdf').first(),label+'-con-movimientos',total-(tdj?20000:10000));
  results.push({module,reciente,total});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({results,alerts,errors},null,2));console.log(JSON.stringify({estado:'OK',results,errors}));
}finally{await browser.close();}
