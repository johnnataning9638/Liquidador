import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('..',import.meta.url));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
const base='http://127.0.0.1:27500';
try{
  const context=await browser.newContext();
  await context.addInitScript(()=>{delete Map.prototype.getOrInsertComputed;delete WeakMap.prototype.getOrInsertComputed;});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base)return route.abort();
    const file=path.join(root,url.pathname);
    const tipos={'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'};
    if(url.pathname==='/js/supabase-config.js')return route.fulfill({
      contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'
    });
    if(url.pathname==='/js/importacion-web-pdf/pdf-worker.mjs'){
      const body=await fs.readFile(file,'utf8');
      return route.fulfill({contentType:'text/javascript',body:'delete Map.prototype.getOrInsert;\n'+body});
    }
    try{return await route.fulfill({body:await fs.readFile(file),contentType:tipos[path.extname(file)]});}
    catch{return route.fulfill({status:404,body:''});}
  });
  const page=await context.newPage();
  page.on('dialog',d=>d.accept());
  await page.goto(base+'/titulos.html',{waitUntil:'domcontentloaded'});
  const respaldo=await page.evaluate(async()=>{
    const {crearRespaldo,codigoRespaldoCompacto}=await import('/js/importacion-web-pdf/respaldo.js');
    const fecha='2025-05-28';
    const titulo={tdj:'4690000000001',fecha,valor:34_099_163};
    const pago={recibo:'4910000000001',fecha,valor:10_000_000,tipo:'TASA DIAN'};
    const obligaciones=[2023,2024].map(anio=>({
      concepto:'RENTA',anio,periodo:1,tipoTasa:'TASA DIAN',vencimientos:[{fecha,impuesto:12_000_000}],pagos:[pago]
    }));
    return codigoRespaldoCompacto(crearRespaldo('TDJ',{nit:'900123456',razonSocial:'PRUEBA'},obligaciones,[titulo,titulo]));
  });
  const preview=await context.newPage();
  await preview.setContent('<style>.pdf-hoja{break-after:page}</style><main class="pdf-soporte"><section class="pdf-hoja"><p>Resumen final de prueba</p></section></main>'+respaldo);
  const codigo=preview.locator('.pdf-hoja:last-of-type > img#liq-codigo-a:last-child');
  assert.equal(await codigo.count(),1);
  assert.equal(await codigo.evaluate(el=>el.style.width),'12mm');
  assert.equal(await preview.locator('a[id^="liq-respaldo-v1-"]').count(),0,'el respaldo visual se prueba sin referencias internas');
  assert.equal(await preview.locator('.pdf-hoja').count(),1,'el código no añade una hoja');
  // Simula la reducción y recompresión del código al imprimir en Windows.
  await codigo.evaluate(async img=>{
    await img.decode();
    const canvas=document.createElement('canvas');
    canvas.width=215;canvas.height=248;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    img.src=canvas.toDataURL('image/jpeg',.88);
    await img.decode();
  });
  const generado=await preview.pdf({format:'A4',printBackground:true});
  const pdf=process.env.PDF_PRUEBA?await fs.readFile(process.env.PDF_PRUEBA):generado;
  if(process.env.GUARDAR_PDF_PRUEBA)await fs.writeFile(process.env.GUARDAR_PDF_PRUEBA,pdf);
  const exportado=Boolean(process.env.PDF_PRUEBA);
  const origenDian=process.env.ORIGEN_PRUEBA==='DIAN';
  for(const esTDJ of [false,true]){
    const tabs=esTDJ?['datos','pagos','titulos']:['datos','pagos','resultados'];
    const campos=esTDJ?['#importarObligacionTexto','#importarPagosTexto','#importarTitulosTexto']:['#pegarDatosObligacion','#pegarDatos','#pegarDatosObligacion'];
    await page.goto(base+(esTDJ?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});
    await page.waitForSelector('.tab-pane.active .wpdf-trigger');
    for(let i=0;i<tabs.length;i++){
      await page.locator(`[data-tab="${tabs[i]}"]`).click();
      const buffer=pdf.toString('base64');
      await page.locator(campos[i]).evaluate((el,bytes)=>{
        const dt=new DataTransfer();
        dt.items.add(new File([Uint8Array.from(atob(bytes),c=>c.charCodeAt(0))],'liquidacion-renombrada.pdf',{type:'application/pdf'}));
        el.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));
      },buffer);
      await page.locator('.tab-pane.active .wpdf-trigger').click();
      const estado=page.locator('.tab-pane.active .wpdf-estado');
      await page.waitForFunction(()=>/Importación lista|wpdf-error/.test(document.querySelector('.tab-pane.active .wpdf-estado')?.outerHTML),null,{timeout:15000});
      assert.match(await estado.textContent(),new RegExp(`Obligaciones: ${esTDJ&&!exportado?2:1}\\. Pagos: ${origenDian?0:1}\\. Títulos: ${origenDian?3:exportado?2:1}`));
    }
    if(esTDJ){
      assert.equal(await page.locator('.obligacion-card').count(),exportado?1:2);
      assert.equal(await page.locator('#tablaTitulos tbody tr').count(),origenDian?3:exportado?2:1);
      assert.match(await page.locator('#tablaTitulos tbody [data-t="valor"]').first().inputValue(),exportado?/19[.,]573[.,]163/:/34[.,]099[.,]163/);
    }else{
      assert.equal(await page.locator('#anio').inputValue(),exportado?'2024':'2023');
    }
  }
  console.log('Recuperación de un PDF real desde las seis pestañas, con reimportación sin duplicados.');
}finally{await browser.close();}
