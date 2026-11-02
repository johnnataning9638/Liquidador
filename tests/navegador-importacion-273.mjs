import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
import {generadorPDF} from './fixtures/generador-273.mjs';
const root=path.resolve(process.env.TEST_SITE_DIR||fileURLToPath(new URL('..',import.meta.url))),base='http://127.0.0.1:27300';
const browser=await chromium.launch({headless:true}),errors=[],results=[];
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({contentType:/\.(mjs|js)$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.zip')?'application/zip':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 const src={fuente:'WEB_MUISCA',nit:'900123456',razonSocial:'PRUEBA S.A.S.',concepto:'RENTA',anio:2024,periodo:1,numeroObligacion:'100100000000001',fechaDeclarar:'2025-08-01',pagos:[{recibo:'4900000000001',fecha:'2025-10-20',valor:84000}]};
 const drop=async(p,selector,bytes,pegar=false)=>{
  const dt=await p.evaluateHandle(({b})=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(b)],'generador.pdf',{type:'application/pdf'}));return d;},{b:[...bytes]});
  if(pegar)await p.evaluate(({dt,selector})=>document.querySelector(selector).dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true,composed:true})),{dt,selector});
  else await p.locator(selector).dispatchEvent('drop',{dataTransfer:dt});await dt.dispose();
 };
 for(const tdj of [false,true]){
  const filename=tdj?'titulos.html':'liquidacion.html',campo=tdj?'#importarObligacionTexto':'#pegarDatosObligacion',nit=tdj?'#nitGlobal':'#nit',mod=tdj?'tdj-core-16.33.143.js':'app.js';
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(filename+': '+e.message));p.on('dialog',d=>d.accept());
  const abrir=async()=>{await p.goto(base+'/'+filename,{waitUntil:'networkidle'});await p.waitForFunction(()=>document.querySelectorAll('.wpdf-trigger').length===3);};
  const snapshot=()=>p.evaluate(async mod=>(await import('/js/'+mod+'?v=16.33.273')).contextoImportacionWebPDF273(),mod);
  const datos=s=>tdj?s.obligaciones[0]:s;
  await abrir();assert.equal(await p.locator('.wpdf-trigger').count(),3);
  const initial=await snapshot();await drop(p,campo,generadorPDF());assert.deepEqual(await snapshot(),initial,'arrastrar no importa');
  await p.locator(tdj?'#btnImportarObligacionTDJ':'#btnProcesarDatosObligacion').click();assert.equal(await p.locator(campo).inputValue(),'');assert.deepEqual(await snapshot(),initial,'importar habitual descarta PDF');
  await drop(p,campo,generadorPDF());await p.locator(`.tab-btn[data-tab="${tdj?'titulos':'resultados'}"]`).click();await p.locator('.tab-pane.active .wpdf-trigger').click();await p.waitForFunction(()=>document.querySelector('.tab-pane.active .wpdf-estado')?.textContent.startsWith('Importación lista'));assert.equal(datos(await snapshot()).vencimientos.length,2,'el adjunto se comparte al cambiar de pestaña');
  for(const tab of ['datos','pagos',tdj?'titulos':'resultados']){
   await abrir();await p.locator(`.tab-btn[data-tab="${tab}"]`).click();
   const dropCampo=tdj?({datos:'#importarObligacionTexto',pagos:'#importarPagosTexto',titulos:'#importarTitulosTexto'})[tab]:tab==='pagos'?'#pegarDatos':campo;
   await drop(p,dropCampo,generadorPDF({mixto:true}),tab!=='datos');
   await p.locator('.tab-pane.active .wpdf-trigger').click();
   await p.waitForFunction(()=>document.querySelector('.tab-pane.active .wpdf-estado')?.textContent.startsWith('Importación lista')).catch(async e=>{console.log(filename,tab,await p.locator('.tab-pane.active .wpdf-estado').innerText(),await p.locator(dropCampo).inputValue());throw e;});
   const d=datos(await snapshot());assert.equal(await p.locator(nit).inputValue(),src.nit);assert.deepEqual(d.vencimientos.filter(v=>v.fecha).map(v=>v.impuesto),[200000,300000]);assert.equal(d.valorSancion,524000);assert.equal(d.fechaSancion,'2025-09-18');
   assert.equal(await p.locator(dropCampo).inputValue(),'');assert.equal(await p.locator('[data-pdf-adjunto]').count(),0);
   assert.equal(d.pagos.length,0);if(tdj)assert.equal(await p.locator('#tablaTitulos tbody tr').count(),0);
   if(!tdj)assert.equal(await p.locator('#rDeudaImpuesto').innerText(),'$ 0','importar no ejecuta una liquidación');
   // Simula exclusivamente el canal del complemento, con los mismos controles de nonce y origen.
   await p.evaluate(src=>window.addEventListener('message',e=>{if(e.data?.tipo==='LIQUIDADOR_MUISCA_SOLICITUD_273')window.postMessage({tipo:'LIQUIDADOR_MUISCA_RESPUESTA_273',id:e.data.id,datos:src},location.origin);}),src);
   for(let i=0;i<2;i++){await p.locator('.tab-pane.active .wpdf-trigger').click();await p.waitForFunction(()=>document.querySelector('.tab-pane.active .wpdf-estado')?.textContent.startsWith('Importación lista'));}
   const merged=datos(await snapshot());assert.equal(merged.vencimientos[0].fecha,'2025-09-19');assert.equal(merged.pagos.length,1);assert.equal(merged.pagos[0].valor,84000);
   assert.equal(await p.evaluate(()=>Object.values(localStorage).some(v=>v.includes('900123456')||v.includes('PRUEBA S.A.S.'))),false,'sin persistir contribuyente');
   results.push(filename+': '+tab+' PDF mixto y web idempotente');
  }
  await abrir();await drop(p,campo,generadorPDF({soloSancion:true}));await p.locator('.tab-pane.active .wpdf-trigger').click();await p.waitForFunction(()=>document.querySelector('.wpdf-estado')?.textContent.startsWith('Importación lista'));
  const solo=datos(await snapshot());assert.equal(solo.valorSancion,524000);assert.equal(solo.fechaSancion,'2026-09-30');assert.equal(solo.vencimientos.filter(v=>v.fecha||v.impuesto).length,0,'solo sanción sin cuota inventada');
  const before=await snapshot();await drop(p,campo,Buffer.from('%PDF-1.4\nINVALIDO'));await p.locator('.tab-pane.active .wpdf-trigger').click();await p.locator('.wpdf-error').first().waitFor();assert.deepEqual(await snapshot(),before,'PDF inválido no modifica datos');
  if(tdj){
   await p.locator('.tab-pane.active .wpdf-quitar').click();await p.locator('#btnAgregarObligacion').click();
   await p.locator('#destinoImportacionObligacion').selectOption({index:2});
   const anteriores=await snapshot();await p.locator('.tab-btn[data-tab="titulos"]').click();await drop(p,'#importarTitulosTexto',generadorPDF());await p.locator('.tab-pane.active .wpdf-trigger').click();
   await p.waitForFunction(()=>document.querySelector('.tab-pane.active .wpdf-estado')?.textContent.startsWith('Importación lista'));
   const varios=await snapshot();assert.deepEqual(varios.obligaciones[0],anteriores.obligaciones[0],'la obligación no elegida permanece intacta');assert.equal(varios.obligaciones[1].vencimientos.length,2,'Títulos respeta el destino elegido en Datos');
   await p.locator('.tab-btn[data-tab="pagos"]').click();await p.locator('#destinoImportacionPagos').selectOption({index:1});await p.locator('.tab-btn[data-tab="titulos"]').click();await drop(p,'#importarTitulosTexto',generadorPDF());await p.locator('.tab-pane.active .wpdf-trigger').click();await p.locator('.tab-pane.active .wpdf-error').waitFor();assert.deepEqual(await snapshot(),varios,'destinos contradictorios se rechazan sin cambios');
  }
  await p.close();
 }
 assert.deepEqual(errors,[]);await fs.mkdir('test-results/importacion-273',{recursive:true});await fs.writeFile('test-results/importacion-273/navegador.json',JSON.stringify(results,null,2));console.log('NAVEGADOR IMPORTACIÓN 273 OK',results);
}finally{await browser.close();}
