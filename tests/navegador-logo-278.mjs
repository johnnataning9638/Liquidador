import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
const root=path.resolve(process.env.TEST_SITE_DIR||fileURLToPath(new URL('..',import.meta.url))),base='http://127.0.0.1:27800';
const output=process.env.ARTIFACT_DIR||path.resolve('test-results/logo-278');await fs.mkdir(output,{recursive:true});
const casos=[];
for(const tdj of [false,true])for(const simple of [false,true])for(const oficial of (tdj?[false]:[false,true]))casos.push({tdj,simple,oficial});
for(const tdj of [false,true])for(const oficial of (tdj?[false]:[false,true]))casos.push({tdj,oficial,sinPagos:true});
for(const tdj of [false,true])casos.push({tdj,soloSancion:true,sinPagos:true});
for(const tdj of [false,true])casos.push({tdj,simple:true,sinPagos:true});
casos.push({excedente:true});
const browser=await chromium.launch({headless:true}),errors=[],alerts=[],resultados=[];
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1100}});ctx.setDefaultTimeout(15000);await ctx.addInitScript(()=>{window.print=()=>{};});
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({contentType:/\.(mjs|js)$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 for(const c of casos){
  const {tdj,simple,oficial,sinPagos,soloSancion,excedente}=c,id=[tdj?'tdj':'dian',simple?'simple':'ordinario',oficial?'oficial':'privada',soloSancion?'solo-sancion':sinPagos?'sin-pagos':excedente?'excedente':'pago'].join('-');
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(id+': '+e.message));p.on('dialog',async d=>{alerts.push(id+': '+d.message());await d.accept();});
  const set=async(sel,v)=>{const el=typeof sel==='string'?p.locator(sel):sel;await el.fill(v);await el.press('Tab');};
  const tab=async name=>{await p.locator(`[data-tab="${name}"]`).click();await p.locator(`[data-pane="${name}"].active`).waitFor({state:'visible'});};
  await p.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});
  await set(tdj?'#nitGlobal':'#nit','900000001');await set(tdj?'#razonGlobal':'#razonSocial','PRUEBA PDF SIN MARCA');
  await p.locator(tdj?'[data-k="concepto"]':'#concepto').selectOption(simple?'SIMPLE':'RENTA');await set(tdj?'[data-k="anio"]':'#anio','2025');await p.locator(tdj?'[data-k="periodo"]':'#periodo').selectOption('1');
  await p.locator(tdj?'[data-k="tieneSancion"]':'#tieneSancion').selectOption('SI');if(!tdj)await p.locator('#tipoLiquidacion').selectOption(oficial?'OFICIAL':'PRIVADA');await set(tdj?'[data-k="valorSancion"]':'#valorSancion','5000000');await set(tdj?'.obligacion-card .compact-grid .fecha-campo':'#fechaSancion','01/01/2025');
  if(!soloSancion){
   if(simple)while(await p.locator(tdj?'.cuotas-mini tbody tr':'#tablaVencimientos tbody tr').count()<4)await p.locator(tdj?'[data-action="agregar-cuota"]':'#btnAgregarCuota').click();
   const fechas=p.locator(tdj?'.cuotas-mini .fecha-campo':'.fecha-vto'),capitales=p.locator('[data-v="impuesto"]');
   for(let i=0;i<await fechas.count();i++){await set(fechas.nth(i),'01/01/2025');await set(capitales.nth(i),'1000000');}
  }
  await tab('pagos');if(!await p.locator(tdj?'.pagos-mini tbody tr':'#tablaPagos tbody tr').count())await p.locator(tdj?'[data-action="agregar-pago"]':'#btnAgregarPago').click();
  await set(tdj?'.pagos-mini .fecha-campo':'.fecha-pago','31/10/2026');await set(tdj?'[data-p="valor"]':'[data-k="valor"]',sinPagos?'0':excedente?'10000000':'50000');
  if(tdj)await tab('titulos');await p.locator(tdj?'.btn-calcular-tdj:visible':'.btn-calcular-normal:visible').first().click();await p.locator(tdj?'#resultadoTDJ':'[data-pane="resultados"].active').waitFor({state:'visible'});
  const [pdf]=await Promise.all([p.waitForEvent('popup'),p.locator(tdj?'.tdj-pdf:visible':'#btnExportarPdf:visible').first().click()]);await pdf.locator('main').waitFor();await pdf.waitForTimeout(200);
  const headers=pdf.locator('.pdf-marca');assert.ok(await headers.count()>0,id+': tiene encabezados');assert.equal(await pdf.locator('.pdf-logo').count(),0,id+': no existe nodo de logo');
  for(const h of await headers.all()){
   assert.doesNotMatch(await h.textContent(),/DIAN/i,id+': ningún encabezado contiene DIAN');
   assert.ok((await h.locator('.pdf-titulo').textContent()).trim(),id+': título conservado');
   assert.ok((await h.locator('.pdf-generado').textContent()).includes('Generado:'),id+': fecha conservada');
  }
  await pdf.pdf({path:path.join(output,id+'.pdf'),format:'A4',printBackground:true});
  if(id==='dian-ordinario-oficial-pago'||id==='tdj-simple-privada-pago')await pdf.screenshot({path:path.join(output,id+'.png'),fullPage:true});
  resultados.push({caso:id,encabezados:await headers.count(),logos:0});await pdf.close();await p.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(alerts,[]);await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({resultados,errors,alerts},null,2));console.log(JSON.stringify({estado:'OK',casos:resultados.length,encabezados:resultados.reduce((a,x)=>a+x.encabezados,0),errors}));
}finally{await browser.close();}
