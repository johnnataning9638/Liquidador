import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):fileURLToPath(new URL('..',import.meta.url));
const output=path.resolve(process.env.ARTIFACT_DIR||'test-results/color-pagos-242');
const live=process.env.TEST_BASE_URL,base=live||'http://127.0.0.1:24000';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
const errors=[],failures=[];
try{
 const ctx=await browser.newContext({viewport:{width:1400,height:950}});
 await ctx.route('**/*',async route=>{
  if(live)return route.continue();
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(url.pathname).slice(1),file=path.resolve(root,name);
  if(!file.startsWith(path.resolve(root)+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({status:200,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const check=(label,fn)=>{try{fn();}catch(e){failures.push(label+': '+e.message);}};
 const obligation='NIT: 900123456\nRazón social: PRUEBA COLOR SAS\nAño: 2024\nFecha\tImpuesto\n16/05/2024\t1.000.000';
 const payment='Recibo\tFecha\tValor\n49124200001\t16/05/2024\t100.000';
 const reports=[];
 const capture=async(button,name,expected)=>{
  await page.evaluate(()=>{window.__xlsx242=null;const create=URL.createObjectURL;URL.createObjectURL=b=>{window.__xlsx242=b;return create.call(URL,b);};});
  await button.click();await page.waitForFunction(()=>Boolean(window.__xlsx242));
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__xlsx242.arrayBuffer())));
  await fs.writeFile(path.join(output,name+'.xlsx'),new Uint8Array(bytes));
  const report=await page.evaluate(async()=>{
   const data=new Uint8Array(await window.__xlsx242.arrayBuffer()),view=new DataView(data.buffer),decode=new TextDecoder(),files={};
   for(let p=0;p+30<data.length&&view.getUint32(p,true)===0x04034b50;){const size=view.getUint32(p+18,true),n=view.getUint16(p+26,true),extra=view.getUint16(p+28,true),start=p+30+n+extra;files[decode.decode(data.slice(p+30,p+30+n))]=decode.decode(data.slice(start,start+size));p=start+size;}
   const parse=x=>new DOMParser().parseFromString(x,'application/xml');
   const sheet=parse(files['xl/worksheets/sheet1.xml']),styles=parse(files['xl/styles.xml']);
   const get=(node,tag)=>[...node.getElementsByTagName(tag)];
   const xfs=[...styles.getElementsByTagName('cellXfs')[0].children],fills=[...styles.getElementsByTagName('fills')[0].children];
   const color=c=>fills[Number(xfs[Number(c.getAttribute('s')||0)].getAttribute('fillId'))]?.getElementsByTagName('fgColor')[0]?.getAttribute('rgb')?.slice(-6)||null;
   const rows=get(sheet,'row'),blocks=[],otherTitles=[];let active=null;
   for(const [ri,row] of rows.entries()){const cells=get(row,'c'),label=cells[0]?.textContent||'',isTitle=cells.length===1&&['173F5F','A9D6B4'].includes(color(cells[0]));
    if(isTitle){active=null;if(label==='PAGOS Y APLICACIÓN'||(label==='PAGOS REGISTRADOS — LIQUIDACIÓN NORMAL'&&(rows[ri+1]?.textContent||'').includes('TOTAL APLICADO'))){active={title:color(cells[0]),header:null,data:[]};blocks.push(active);}else otherTitles.push({label,color:color(cells[0])});}
    else if(active&&cells.length){if(active.header===null)active.header=cells.map(color);else active.data.push(cells.map(color));}
   }
   const {aplicarVerdePagosExcel}=await import('./js/excel-color-pagos.js');
   const sample='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" s="1" t="inlineStr"><is><t>PAGOS Y APLICACIÓN</t></is></c></row><row r="2"><c r="A2" s="2" t="inlineStr"><is><t>VALOR</t></is></c></row><row r="3"><c r="A3" s="3"><v>14794449</v></c><c r="B3" s="4"><v>0.045</v></c></row></sheetData><mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells></worksheet>';
   const source=[{name:'xl/worksheets/sheet1.xml',data:sample},{name:'xl/styles.xml',data:files['xl/styles.xml']},{name:'docProps/core.xml',data:'INVARIANTE'}];
   const before=JSON.stringify(source),after=aplicarVerdePagosExcel(source),a=parse(sample),b=parse(after[0].data);
   for(const doc of [a,b])for(const c of get(doc,'c'))c.removeAttribute('s');
   const valuesPreserved=a.documentElement.isEqualNode(b.documentElement)&&JSON.stringify(source)===before&&after[2]===source[2];
   const formatsPreserved=xfs.slice(5,10).every((xf,i)=>xf.getAttribute('numFmtId')===xfs[i].getAttribute('numFmtId')&&xf.getElementsByTagName('alignment')[0].isEqualNode(xfs[i].getElementsByTagName('alignment')[0]));
   return {blocks,otherTitles,valuesPreserved,formatsPreserved,xml:files['xl/worksheets/sheet1.xml'],styles:files['xl/styles.xml']};
  });
  assert.equal(report.blocks.length,expected,name+' bloques de pagos');
  assert.ok(report.valuesPreserved,name+' conserva valores, estructura, captura y archivos ajenos');assert.ok(report.formatsPreserved,name+' conserva formatos de moneda, porcentaje y alineación');
  for(const b of report.blocks){assert.equal(b.title,'A9D6B4',name+' título verde');assert.ok(b.header.every(c=>c==='D9EEDD'),name+' encabezado verde claro');assert.ok(b.data.length>0);assert.ok(b.data.flat().every(c=>c==='F3FAF4'),name+' datos verde suave');}
  assert.ok(report.otherTitles.filter(t=>t.color==='173F5F').length>2,name+' conserva los títulos azules');
  assert.ok(report.otherTitles.every(t=>!['A9D6B4','D9EEDD','F3FAF4'].includes(t.color)),name+' verde exclusivo del bloque');
  await fs.writeFile(path.join(output,name+'-hoja.xml'),report.xml);await fs.writeFile(path.join(output,name+'-estilos.xml'),report.styles);
  reports.push({name,blocks:report.blocks,otherTitles:report.otherTitles});
 };
 await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#concepto')?.options.length>1);
 await page.locator('#pegarDatosObligacion').fill(obligation);await page.locator('#btnProcesarDatosObligacion').click();await page.locator('#concepto').selectOption('RENTA');await page.locator('#periodo').selectOption('1');await page.locator('#tieneSancion').selectOption('NO');
 await page.locator('[data-tab="pagos"]').click();await page.locator('#pegarDatos').fill(payment);await page.locator('#btnProcesarPegado').click();await page.locator('.btn-calcular-normal:visible').first().click();await page.locator('[data-tab="resultados"]').click();
 await capture(page.locator('#btnExportarExcel'),'dian',1);
 await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});await page.waitForSelector('.obligacion-card');
 for(let i=1;i<=3;i++){
  await page.locator('[data-tab="datos"]').click();if(i>1)await page.locator('#btnAgregarObligacion').click();
  await page.locator('#destinoImportacionObligacion').selectOption({index:i});await page.locator('#importarObligacionTexto').fill(obligation);await page.locator('#btnImportarObligacionTDJ').click();
  await page.locator('.obligacion-card [data-k="concepto"]').nth(i-1).selectOption('RENTA');await page.locator('.obligacion-card [data-k="periodo"]').nth(i-1).selectOption('1');
  await page.locator('[data-tab="pagos"]').click();await page.locator('#destinoImportacionPagos').selectOption({index:i});await page.locator('#importarPagosTexto').fill(payment.replace('49124200001','4912420000'+i));await page.locator('#btnImportarPagosTDJ').click();
 }
 await page.locator('[data-tab="titulos"]').click();await page.locator('.btn-calcular-tdj:visible').first().click();
 await capture(page.locator('.tdj-excel:visible').first(),'tdj-tres-obligaciones',3);
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify(reports,null,2));
 console.log('COLOR 242 OK: verde exclusivo de pagos DIAN y de cada una de tres obligaciones TDJ; demás bloques azules');
}finally{await browser.close();}
