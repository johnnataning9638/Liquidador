import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
import {TIPO_688_50} from '../js/decreto-688-50.js';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url))),root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):project;
const output=process.env.ARTIFACT_DIR||path.join(project,'test-results/688-50-266');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:26600';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],alerts=[],results=[];
try{
 const ctx=await browser.newContext({viewport:{width:1485,height:1000}});
 ctx.setDefaultTimeout(15000);
 if(!process.env.TEST_BASE_URL)await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  const n=decodeURIComponent(u.pathname).slice(1),f=path.resolve(root,n);
  if(!f.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(n==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({contentType:n.endsWith('.js')?'text/javascript':n.endsWith('.css')?'text/css':n.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(f)});}catch{return route.fulfill({status:404,body:''});}
 });
 await ctx.addInitScript(()=>{window.print=()=>{};});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
 const money=x=>Number(String(x).replace(/[^0-9-]/g,''));
 const set=async(sel,v)=>{await p.locator(sel).fill(v);await p.locator(sel).press('Tab');};
 const selectFile=async(button,file)=>{const dialog=p.waitForEvent('dialog');const [chooser]=await Promise.all([p.waitForEvent('filechooser'),button.click()]);await chooser.setFiles(file);await dialog;await p.waitForTimeout(200);};
 for(const mode of ['dian','dian-oficial','tdj-pago','tdj-titulo']){
  const tdj=mode.startsWith('tdj'),titulo=mode==='tdj-titulo';
  await p.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});
  if(tdj){
   await p.waitForSelector('.obligacion-card');await set('#nitGlobal','900000001');await set('#razonGlobal','PRUEBA IBC MANUAL');
   await p.locator('[data-k="concepto"]').selectOption('RENTA');await set('[data-k="anio"]','2019');await p.locator('[data-k="periodo"]').selectOption('1');
   await set('.cuotas-mini .fecha-campo','01/01/2020');await set('.cuotas-mini [data-v="impuesto"]','1000000');
  }else{
   await set('#nit','900000001');await set('#razonSocial','PRUEBA IBC MANUAL');await p.locator('#concepto').selectOption('RENTA');await set('#anio','2019');await p.locator('#periodo').selectOption('1');
   await p.locator('#tieneSancion').selectOption('NO');
   if(mode==='dian-oficial'){await p.locator('#tieneSancion').selectOption('SI');await p.locator('#tipoLiquidacion').selectOption('OFICIAL');await set('#valorSancion','1000000');await set('#fechaSancion','01/06/2020');}
   await set('.fecha-vto','01/01/2020');await set('[data-v="impuesto"]','1000000');
  }
  let type,date;
  if(titulo){
   await p.locator('[data-tab="titulos"]').click();await p.locator('#btnAgregarTitulo').click();await set('[data-t="tdj"]','266000001');await set('#tablaTitulos .fecha-campo','01/06/2020');await set('[data-t="valor"]','10000');
   type='#tablaTitulos .tdj-beneficio-select';date='#tablaTitulos .fecha-campo';await p.waitForSelector(type);
  }else{
   await p.locator('[data-tab="pagos"]').click();
   if(tdj){if(!await p.locator('.pagos-mini tbody tr').count())await p.locator('[data-action="agregar-pago"]').click();date='.pagos-mini .fecha-campo';type='[data-p="tipo"]';await set(date,'01/06/2020');await set('[data-p="valor"]','10000');}
   else{if(!await p.locator('#tablaPagos tbody tr').count())await p.locator('#btnAgregarPago').click();date='.fecha-pago';type='[data-k="tipo"]';await set(date,'01/06/2020');await set('#tablaPagos [data-k="valor"]','10000');}
  }
  assert.equal(await p.locator(type).inputValue(),'TASA DIAN','El 50% nunca se selecciona automáticamente');
  assert.equal(await p.locator(type+' option').filter({hasText:TIPO_688_50}).count(),1,'Opción manual disponible una sola vez');
  await p.locator(type).selectOption(TIPO_688_50);
  if(titulo)await p.waitForFunction(()=>document.querySelector('.tdj-tasa-visual')?.textContent==='TASA: 9.060%');
  else assert.ok((await p.locator(type).locator('xpath=ancestor::tr').textContent()).includes('9.060%'),'Tasa visible coincide con motor');
  await p.screenshot({path:path.join(output,mode+'-seleccion.png'),fullPage:true});
  if(tdj)await p.locator('[data-tab="titulos"]').click();
  await p.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();
  const total=mode==='dian-oficial'?2028000:1028000;
  const totalSel=tdj?'#tablaResultadoObligaciones tbody tr td:last-child':'#rSaldoTotalFooter';
  await p.waitForFunction(({sel,total})=>Number((document.querySelector(sel)?.textContent||'').replace(/[^0-9-]/g,''))===total,{sel:totalSel,total});assert.equal(money(await p.locator(totalSel).textContent()),total,mode+' resultado independiente');
  const [pdf]=await Promise.all([p.waitForEvent('popup'),p.locator(tdj?'.tdj-pdf:visible':'#btnExportarPdf').first().click()]);await pdf.waitForSelector('main');
  const text=await pdf.locator('body').textContent();assert.ok(text.includes(TIPO_688_50),'PDF conserva selección manual');assert.ok(text.includes('9.060'),'PDF conserva tasa');
  await pdf.pdf({path:path.join(output,mode+'.pdf'),format:'A4',printBackground:true});await pdf.close();
  await p.evaluate(()=>{window.__blob266=null;const create=URL.createObjectURL;URL.createObjectURL=b=>{window.__blob266=b;return create.call(URL,b);};});
  await p.locator(tdj?'.tdj-excel:visible':'#btnExportarExcel').first().click();await p.waitForFunction(()=>window.__blob266);
  const rows=await p.evaluate(async()=>{const {leerXlsxPrimeraHoja}=await import('./js/importador-excel.js');return leerXlsxPrimeraHoja(window.__blob266);});assert.ok(JSON.stringify(rows).includes(TIPO_688_50),'Excel conserva selección');
  const bytes=await p.evaluate(async()=>Array.from(new Uint8Array(await window.__blob266.arrayBuffer()))),file=path.join(output,mode+'.xlsx');await fs.writeFile(file,new Uint8Array(bytes));
  await p.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});if(tdj)await p.waitForSelector('.obligacion-card');
  await selectFile(p.locator(tdj?'.tdj-import-excel:visible':'.btn-importar-excel:visible').first(),file);
  await p.locator('[data-tab="'+(titulo?'titulos':'pagos')+'"]').click();
  assert.equal(await p.locator(type).inputValue(),TIPO_688_50,'Reimportación conserva opción manual');
  if(tdj)await p.locator('[data-tab="titulos"]').click();await p.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();
  assert.equal(money(await p.locator(totalSel).textContent()),total,'Reimportación conserva total');
  if(!tdj)await p.locator('[data-pane="resultados"].active').waitFor({state:'visible'});
  await p.locator('[data-tab="'+(titulo?'titulos':'pagos')+'"]').click();await set(date,'21/05/2020');
  const old=alerts.length;if(tdj)await p.locator('[data-tab="titulos"]').click();await p.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();
  assert.ok(alerts.slice(old).some(x=>/22\/05\/2020.*30\/11\/2020/.test(x)),'Fuera de vigencia bloquea el cálculo');
  assert.equal(await p.locator(type).inputValue(),TIPO_688_50,'No cambia silenciosamente la selección');
  results.push({mode,total,pdf:true,xlsx:true,reimportacion:true,manual:true});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({results,errors,alerts},null,2));console.log(JSON.stringify({estado:'OK',results,errors}));
}catch(e){console.log(JSON.stringify({errors,alerts}));throw e;}finally{await browser.close();}
