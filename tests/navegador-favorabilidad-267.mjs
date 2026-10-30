import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
import {TIPO_688_50} from '../js/decreto-688-50.js';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url))),root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):project;
const output=process.env.ARTIFACT_DIR||path.join(project,'test-results/favorabilidad-267');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:26700';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],alerts=[],results=[];
let p;
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
 p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
 const money=x=>Number(String(x).replace(/[^0-9-]/g,''));
 const set=async(sel,v)=>{await p.locator(sel).fill(v);await p.locator(sel).press('Tab');};
 const selectFile=async(button,file)=>{const dialog=p.waitForEvent('dialog');const [chooser]=await Promise.all([p.waitForEvent('filechooser'),button.click()]);await chooser.setFiles(file);await dialog;await p.waitForTimeout(200);};
 for(const mode of (process.env.TEST_MODES?.split(',')||['dian','dian-oficial','tdj-pago','tdj-titulo'])){
  const tdj=mode.startsWith('tdj'),titulo=mode==='tdj-titulo';
  await p.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});
  if(tdj){
   await p.waitForSelector('.obligacion-card');await set('#nitGlobal','900000001');await set('#razonGlobal','PRUEBA IBC MANUAL');
   await p.locator('[data-k="concepto"]').selectOption('RENTA');await set('[data-k="anio"]','2019');await p.locator('[data-k="periodo"]').selectOption('1');
   await set('.cuotas-mini .fecha-campo','27/08/2019');await set('.cuotas-mini [data-v="impuesto"]','5000000');
  }else{
   await set('#nit','900000001');await set('#razonSocial','PRUEBA IBC MANUAL');await p.locator('#concepto').selectOption('RENTA');await set('#anio','2019');await p.locator('#periodo').selectOption('1');
   await p.locator('#tieneSancion').selectOption('NO');
   if(mode==='dian-oficial'){await p.locator('#tieneSancion').selectOption('SI');await p.locator('#tipoLiquidacion').selectOption('OFICIAL');await set('#valorSancion','1000000');await set('#fechaSancion','28/12/2019');}
   await set('.fecha-vto','27/08/2019');await set('[data-v="impuesto"]','5000000');
  }
  let type,date;
  if(titulo){
   await p.locator('[data-tab="titulos"]').click();await p.locator('#btnAgregarTitulo').click();await set('[data-t="tdj"]','267000001');await set('#tablaTitulos .fecha-campo','28/12/2019');await set('[data-t="valor"]','8000000');
   type='#tablaTitulos .tdj-beneficio-select';date='#tablaTitulos .fecha-campo';await p.waitForSelector(type);
  }else{
   await p.locator('[data-tab="pagos"]').click();
   if(tdj){if(!await p.locator('.pagos-mini tbody tr').count())await p.locator('[data-action="agregar-pago"]').click();date='.pagos-mini .fecha-campo';type='[data-p="tipo"]';await set(date,'28/12/2019');await set('[data-p="valor"]','8000000');}
   else{if(!await p.locator('#tablaPagos tbody tr').count())await p.locator('#btnAgregarPago').click();date='.fecha-pago';type='[data-k="tipo"]';await set(date,'28/12/2019');await set('#tablaPagos [data-k="valor"]','8000000');}
  }
  assert.equal(await p.locator(type).inputValue(),'TASA DIAN','El 50% nunca se selecciona automáticamente');
  assert.equal(await p.locator(type+' option').filter({hasText:TIPO_688_50}).count(),1,'Opción manual disponible una sola vez');
  assert.equal(await p.locator(type).inputValue(),'TASA DIAN');
  if(titulo)await p.waitForFunction(()=>document.querySelector('.tdj-tasa-visual')?.textContent==='TASA: 20.910%');
  else assert.ok((await p.locator(type).locator('xpath=ancestor::tr').textContent()).includes('20.910%'),'Tasa visible coincide con motor');
  await p.screenshot({path:path.join(output,mode+'-seleccion.png'),fullPage:true});
  if(tdj)await p.locator('[data-tab="titulos"]').click();
  await p.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();
  const total=0;
  const totalSel=tdj?'#tablaResultadoObligaciones tbody tr td:last-child':'#rSaldoTotalFooter';
  await p.waitForFunction(({sel,total})=>Number((document.querySelector(sel)?.textContent||'').replace(/[^0-9-]/g,''))===total,{sel:totalSel,total});assert.equal(money(await p.locator(totalSel).textContent()),total,mode+' resultado independiente');
  const [pdf]=await Promise.all([p.waitForEvent('popup'),p.locator(tdj?'.tdj-pdf:visible':'#btnExportarPdf').first().click()]);await pdf.waitForSelector('main');
  const text=await pdf.locator('body').textContent();assert.ok(text.includes('LEY 2010 DE 2019'),'PDF identifica la norma automática');assert.ok(text.includes('20.910'),'PDF conserva tasa automática');assert.ok(text.includes('352.000'),'PDF calcula interés correcto');assert.ok(!text.includes('26.370%'),'PDF no conserva la tasa anterior');
  await pdf.pdf({path:path.join(output,mode+'.pdf'),format:'A4',printBackground:true});await pdf.close();
  await p.evaluate(()=>{window.__blob266=null;const create=URL.createObjectURL;URL.createObjectURL=b=>{window.__blob266=b;return create.call(URL,b);};});
  await p.locator(tdj?'.tdj-excel:visible':'#btnExportarExcel').first().click();await p.waitForFunction(()=>window.__blob266);
  const rows=await p.evaluate(async()=>{const {leerXlsxPrimeraHoja}=await import('./js/importador-excel.js');return leerXlsxPrimeraHoja(window.__blob266);});assert.ok(JSON.stringify(rows).includes('352000'),'Excel conserva interés corregido');
  const bytes=await p.evaluate(async()=>Array.from(new Uint8Array(await window.__blob266.arrayBuffer()))),file=path.join(output,mode+'.xlsx');await fs.writeFile(file,new Uint8Array(bytes));
  await p.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});if(tdj)await p.waitForSelector('.obligacion-card');
  await selectFile(p.locator(tdj?'.tdj-import-excel:visible':'.btn-importar-excel:visible').first(),file);
  await p.locator('[data-tab="'+(titulo?'titulos':'pagos')+'"]').click();
  assert.equal(await p.locator(type).inputValue(),'TASA DIAN','Reimportación conserva selección automática');
  if(tdj)await p.locator('[data-tab="titulos"]').click();await p.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();
  assert.equal(money(await p.locator(totalSel).textContent()),total,'Reimportación conserva total');
  if(!tdj)await p.locator('[data-pane="resultados"].active').waitFor({state:'visible'});
  await p.locator('[data-tab="'+(titulo?'titulos':'pagos')+'"]').click();await set(date,'22/05/2020');
  if(titulo)await p.waitForFunction(()=>document.querySelector('.tdj-tasa-visual')?.textContent==='TASA: 18.190%');
  else assert.ok((await p.locator(type).locator('xpath=ancestor::tr').textContent()).includes('18.190%'),'Decreto 688 general automático en la vista');
  assert.equal(await p.locator(type).inputValue(),'TASA DIAN','El 50% no se selecciona automáticamente al cambiar de fase');
  results.push({mode,total,pdf:true,xlsx:true,reimportacion:true,automatico:true,intereses:352000});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({results,errors,alerts},null,2));console.log(JSON.stringify({estado:'OK',results,errors}));
}catch(e){await p.screenshot({path:path.join(output,'fallo.png'),fullPage:true});console.log(JSON.stringify({errors,alerts,filas:await p.locator('.pagos-mini tbody tr,.cuotas-mini tbody tr').evaluateAll(rs=>rs.map(r=>({texto:r.textContent,inputs:[...r.querySelectorAll('input')].map(x=>[x.dataset,x.value])})))}));throw e;}finally{await browser.close();}
