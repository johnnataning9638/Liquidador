import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/presentacion-sancion-255');
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
 const choose=async(b,f)=>{const done=page.waitForEvent('dialog');const [c]=await Promise.all([page.waitForEvent('filechooser'),b.click()]);await c.setFiles(f);await done;await page.waitForTimeout(200);};
 const excel=async(b,label)=>{await page.evaluate(()=>{window.__xlsx255=null;const old=URL.createObjectURL;URL.createObjectURL=x=>{window.__xlsx255=x;return old.call(URL,x);};});await b.click();await page.waitForFunction(()=>window.__xlsx255);const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__xlsx255.arrayBuffer())));const f=path.join(output,label+'.xlsx');await fs.writeFile(f,new Uint8Array(bytes));return f;};
 await ctx.addInitScript(()=>{window.print=()=>{};});
 let source=process.env.FIXTURE_FILE;
 if(!source){
  await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});await set('#nit','900000001');await set('#razonSocial','PRUEBA SOPORTE SANCION');await page.locator('#concepto').selectOption('RENTA');await set('#anio','2022');await page.locator('#periodo').selectOption('1');await page.locator('#tieneSancion').selectOption('SI');await page.locator('#tipoLiquidacion').selectOption('PRIVADA');await set('#valorSancion','2500000');await set('#fechaSancion','01/01/2023');await set('.fecha-vto','01/01/2022');await page.locator('[data-tab="pagos"]').click();if(!await page.locator('#tablaPagos tbody tr').count())await page.locator('#btnAgregarPago').click();await set('.fecha-pago','27/10/2026');await page.locator('.btn-calcular-normal:visible').first().click();await page.locator('[data-pane="resultados"].active').waitFor();source=await excel(page.locator('#btnExportarExcel'),'fuente-sintetica');
 }
 let dianHtml='',expected=0,dianStyles=null;
 const styles=async element=>element.evaluate(el=>['.pdf-titulo','.pdf-intereses h3','.pdf-intereses thead th','.pdf-actualizacion-sancion h3','.pdf-tabla td','.pdf-aplicaciones th'].map(s=>{const c=getComputedStyle(el.querySelector(s));return [s,...['fontFamily','fontSize','fontWeight','backgroundColor','paddingTop','paddingLeft','borderTopWidth'].map(p=>c[p])];}));
 for(const tdj of [false,true]){
  await page.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});if(tdj)await page.waitForSelector('.obligacion-card');await choose(page.locator(tdj?'.tdj-import-excel:visible':'.btn-importar-excel:visible').first(),source);
  if(tdj)await page.locator('[data-tab="titulos"]').click();await page.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();if(!tdj)await page.locator('[data-pane="resultados"].active').waitFor();
  const total=money(await page.locator(tdj?'#tablaResultadoObligaciones tbody tr td:last-child':'#rSaldoTotalFooter').textContent());assert.equal(total,2771000,'Importe original sin cambio');
  const [preview]=await Promise.all([page.waitForEvent('popup'),page.locator(tdj?'.tdj-pdf:visible':'#btnExportarPdf').first().click()]);await preview.waitForSelector('main');await preview.waitForTimeout(250);
  await preview.pdf({path:path.join(output,tdj?'tdj.pdf':'dian.pdf'),format:'A4',printBackground:true});
  if(!tdj){dianHtml=await preview.locator('.pdf-liquidacion').first().innerHTML();dianStyles=await styles(preview.locator('.pdf-liquidacion').first());expected=total;}
  else if(process.env.EXPECT_OLD!=='1'){
   const detail=preview.locator('.pdf-sancion-dian .pdf-liquidacion');assert.equal(await detail.count(),1,'Soporte DIAN completo dentro de PDF TDJ');assert.equal(await detail.innerHTML(),dianHtml,'HTML del detalle idéntico a DIAN');
   assert.deepEqual(await styles(detail),dianStyles,'Letra, tamaño, color y espaciado iguales a DIAN');
   assert.ok((await preview.locator('main').textContent()).includes('RESUMEN FINAL'),'Mantener resumen TDJ');
   const screen=page.locator('#soporteSancionDianTDJ .pdf-liquidacion');assert.equal(await screen.count(),1);assert.equal(await screen.innerHTML(),dianHtml,'Pantalla TDJ idéntica al detalle DIAN');
   const rows=await screen.locator('.pdf-actualizacion-sancion tbody tr').allTextContents();assert.ok(rows.some(x=>x.includes('133.000')));assert.ok(rows.some(x=>x.includes('138.000')));
   assert.equal(money(await screen.locator('.pdf-actualizacion-sancion tfoot th').nth(1).textContent()),271000);
   await page.screenshot({path:path.join(output,'tdj-pantalla.png'),fullPage:true});
   const f=await excel(page.locator('.tdj-excel:visible').first(),'tdj-recuperacion');await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});await page.waitForSelector('.obligacion-card');await choose(page.locator('.tdj-import-excel:visible').first(),f);await page.locator('[data-tab="titulos"]').click();await page.locator('.btn-calcular-tdj:visible').first().click();assert.equal(money(await page.locator('#tablaResultadoObligaciones tbody tr td').last().textContent()),expected);
  }
  await preview.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({expected,errors,alerts},null,2));console.log(JSON.stringify({estado:'OK',expected,errors,old:process.env.EXPECT_OLD==='1'}));
}finally{await browser.close();}
