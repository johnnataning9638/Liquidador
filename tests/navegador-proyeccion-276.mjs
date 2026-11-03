import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
const root=path.resolve(process.env.TEST_SITE_DIR||fileURLToPath(new URL('..',import.meta.url))),base='http://127.0.0.1:27600';
const output=process.env.ARTIFACT_DIR||path.resolve('test-results/proyeccion-276');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],alerts=[],resultados=[];
const tipo='ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO';
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1100}});ctx.setDefaultTimeout(15000);await ctx.addInitScript(()=>{window.print=()=>{};});
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({contentType:/\.(mjs|js)$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 for(const modalidad of ['privada','oficial','tdj']){
  const tdj=modalidad==='tdj',p=await ctx.newPage();p.on('pageerror',e=>errors.push(modalidad+': '+e.message));p.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
  const set=async(sel,v)=>{await p.locator(sel).fill(v);await p.locator(sel).press('Tab');};
  const tab=async name=>{await p.locator(`[data-tab="${name}"]`).click();await p.locator(`[data-pane="${name}"].active`).waitFor({state:'visible'});};
  await p.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});
  if(tdj){
   await p.locator('.obligacion-card').waitFor();await set('#nitGlobal','900000001');await set('#razonGlobal','PRUEBA PROYECCIÓN');await p.locator('[data-k="concepto"]').selectOption('RENTA');await set('[data-k="anio"]','2025');await p.locator('[data-k="periodo"]').selectOption('1');await p.locator('[data-k="tieneSancion"]').selectOption('SI');await set('[data-k="valorSancion"]','5000000');await set('.obligacion-card .compact-grid .fecha-campo','01/01/2025');await set('.cuotas-mini .fecha-campo','01/01/2025');await set('[data-v="impuesto"]','1000000');
  }else{
   await set('#nit','900000001');await set('#razonSocial','PRUEBA PROYECCIÓN');await p.locator('#concepto').selectOption('RENTA');await set('#anio','2025');await p.locator('#periodo').selectOption('1');await p.locator('#tieneSancion').selectOption('SI');await p.locator('#tipoLiquidacion').selectOption(modalidad==='oficial'?'OFICIAL':'PRIVADA');await set('#valorSancion','5000000');await set('#fechaSancion','01/01/2025');await set('.fecha-vto','01/01/2025');await set('[data-v="impuesto"]','1000000');
  }
  await tab('pagos');if(!await p.locator(tdj?'.pagos-mini tbody tr':'#tablaPagos tbody tr').count())await p.locator(tdj?'[data-action="agregar-pago"]':'#btnAgregarPago').click();
  await set(tdj?'.pagos-mini .fecha-campo':'.fecha-pago','31/10/2026');await set(tdj?'[data-p="valor"]':'[data-k="valor"]','');await p.locator(tdj?'[data-p="tipo"]':'[data-k="tipo"]').selectOption(tipo);
  const calcular=async()=>{if(tdj)await tab('titulos');await p.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();await p.locator(tdj?'#resultadoTDJ':'[data-pane="resultados"].active').waitFor({state:'visible'});};
  await calcular();const panel=p.locator(tdj?'#proyeccionesBeneficioTDJ':'#proyeccionesBeneficioNormal');await panel.locator('tbody tr').waitFor();
  const money=v=>Number(String(v).replace(/[^0-9-]/g,''));const valores=(await panel.locator('tbody tr td').allTextContents()).map(money);assert.equal(valores.length,5);assert.equal(valores[4],0);assert.equal(valores[3],valores[0]+valores[1]+valores[2]);assert.ok(valores[1]>0);assert.ok(valores[2]<5000000,'Sanción reducida sin abono');
  assert.equal(money(await p.locator(tdj?'#resAplicado':'#rPropTotal').textContent()),0,'Aplicado contable cero');
  assert.ok(!alerts.some(x=>/Faltó|El pago no cubrió/.test(x)),'No advertir falta de dinero por una consulta');
  const [pdf]=await Promise.all([p.waitForEvent('popup'),p.locator(tdj?'.tdj-pdf:visible':'#btnExportarPdf:visible').first().click()]);await pdf.locator('main').waitFor();
  const pdfPanel=pdf.locator('.proyeccion-beneficio-276');assert.equal(await pdfPanel.count(),1);assert.deepEqual((await pdfPanel.locator('tbody tr td').allTextContents()).map(money),valores,'PDF idéntico a pantalla');await pdf.pdf({path:path.join(output,modalidad+'.pdf'),format:'A4',printBackground:true});await pdf.close();
  await p.screenshot({path:path.join(output,modalidad+'.png'),fullPage:true});
  await p.evaluate(()=>{window.__blob276=null;const old=URL.createObjectURL;URL.createObjectURL=b=>{window.__blob276=b;return old.call(URL,b);};});await p.locator(tdj?'.tdj-excel:visible':'#btnExportarExcel:visible').first().click();await p.waitForFunction(()=>window.__blob276);
  const rows=await p.evaluate(async()=>{const {leerXlsxPrimeraHoja}=await import('/js/importador-excel.js');return leerXlsxPrimeraHoja(window.__blob276);});
  assert.ok(rows.some(r=>r.includes('CUÁNTO PAGAR CON EL BENEFICIO — CONSULTA SIN ABONO')));assert.ok(rows.some(r=>r[0]==='2026-10-31'&&Number(r[5])===valores[3]&&Number(r[6])===0),'Excel conserva cotización y aplicado cero');
  const bytes=await p.evaluate(async()=>[...new Uint8Array(await window.__blob276.arrayBuffer())]),file=path.join(output,modalidad+'.xlsx');await fs.writeFile(file,new Uint8Array(bytes));
  const [chooser]=await Promise.all([p.waitForEvent('filechooser'),p.locator(tdj?'.tdj-import-excel:visible':'.btn-importar-excel:visible').first().click()]);await chooser.setFiles(file);await p.waitForTimeout(500);await calcular();
  assert.deepEqual((await panel.locator('tbody tr td').allTextContents()).map(money),valores,'Reimportar mantiene consulta sin inventar pago');
  resultados.push({modalidad,impuesto:valores[0],intereses:valores[1],sancion:valores[2],total:valores[3],aplicado:0});await p.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({resultados,errors,alerts},null,2));console.log(JSON.stringify({estado:'OK',resultados,errors}));
}finally{await browser.close();}
