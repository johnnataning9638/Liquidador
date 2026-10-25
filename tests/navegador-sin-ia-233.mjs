import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const decodedRoot = process.env.TEST_SITE_DIR ? path.resolve(process.env.TEST_SITE_DIR) : path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const {version}=JSON.parse(await fs.readFile(path.join(decodedRoot,'version.json'),'utf8'));
const output = process.env.ARTIFACT_DIR || path.resolve(decodedRoot, 'test-results/sin-ia-233');
const live = process.env.TEST_BASE_URL;
const baseURL = live || 'http://127.0.0.1:23300';
await fs.mkdir(output, {recursive:true});
const browser = await chromium.launch({...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{}), headless:true});
const errors = [], requests = [], alerts = [];
try {
  const ctx = await browser.newContext({viewport:{width:1365,height:950}});
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (live) return route.continue();
    if (url.hostname !== '127.0.0.1') return route.abort();
    const name = decodeURIComponent(url.pathname).slice(1);
    if (name === 'js/supabase-config.js') return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL=""; export const SUPABASE_ANON_KEY="";'});
    const target = path.resolve(decodedRoot, name);
    if (!target.startsWith(decodedRoot + path.sep)) return route.fulfill({status:403, body:''});
    try {
      const body = await fs.readFile(target);
      return route.fulfill({status:200,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body});
    } catch {return route.fulfill({status:404,body:''});}
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => {alerts.push(d.message()); console.log('DIÁLOGO:',d.message()); await d.accept();});
  const assertNoIA = async () => {
    assert.equal(await page.locator('button').filter({hasText:/^\s*Importar IA\s*$/i}).count(), 0);
    assert.equal(await page.locator('.indicador-ia').count(), 0);
  };
  const numeric = text => Number(text.replace(/[^\d-]/g,''));
  const buttonStyles=async(selector)=>page.locator(selector).evaluateAll(buttons=>buttons.map(button=>{
    const s=getComputedStyle(button);
    return Object.fromEntries(['height','fontFamily','fontSize','fontWeight','lineHeight','padding','borderRadius','backgroundColor','color'].map(k=>[k,s[k]]));
  }));
  const captureExports = async (pdfButton, excelButton, label, expectedBalance) => {
    await page.evaluate(()=>{
      window.__pdfHTML233=''; window.__xlsx233=null;
      window.open=()=>({document:{readyState:'complete',open(){},write(html){window.__pdfHTML233=html;},close(){}},focus(){},print(){}});
      const create=URL.createObjectURL;
      URL.createObjectURL=function(blob){window.__xlsx233=blob;return create.call(this,blob);};
    });
    await pdfButton.click();
    await page.waitForFunction(()=>window.__pdfHTML233.length>0);
    const html=await page.evaluate(()=>window.__pdfHTML233);
    assert.ok(html.includes('900123456'),label+' PDF conserva NIT');
    assert.ok(html.includes(new Intl.NumberFormat('es-CO').format(expectedBalance)),label+' PDF conserva saldo');
    const preview=await ctx.newPage(); await preview.setContent(html);
    await preview.pdf({path:path.join(output,label+'.pdf'),format:'A4',printBackground:true}); await preview.close();
    await excelButton.click(); await page.waitForFunction(()=>Boolean(window.__xlsx233));
    const rows=await page.evaluate(async()=>{
      const {leerXlsxPrimeraHoja}=await import('./js/importador-excel.js');
      return leerXlsxPrimeraHoja(window.__xlsx233);
    });
    assert.ok(rows.flat().some(v=>String(v)==='900123456'),label+' Excel conserva NIT');
    assert.ok(rows.flat().some(v=>Number(v)===expectedBalance),label+' Excel conserva saldo');
    const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__xlsx233.arrayBuffer())));
    const xlsxPath=path.join(output,label+'.xlsx'); await fs.writeFile(xlsxPath,new Uint8Array(bytes));
    return xlsxPath;
  };
  const obligation = 'NIT: 900123456\nRazón social: EMPRESA PRUEBA SAS\nAño: 2023\nFecha\tImpuesto\n16/05/2024\t1.000.000';
  const payment = 'Recibo\tFecha\tValor\n4911089297230\t16/05/2024\t100.000';
  await page.goto(`${baseURL}/liquidacion.html?v=${version}`, {waitUntil:'networkidle'});
  await page.waitForFunction(() => document.querySelector('#concepto')?.options.length > 1);
  await assertNoIA();
  await page.locator('#pegarDatosObligacion').fill(obligation);
  await page.locator('#btnProcesarDatosObligacion').click();
  assert.equal(await page.locator('#nit').inputValue(), '900123456');
  assert.equal(await page.locator('#tablaVencimientos tbody tr').count(), 1);
  await page.locator('.importador-obligacion').screenshot({path:path.join(output,'dian-importar.png')});
  await page.locator('[data-tab="pagos"]').click();
  await page.locator('#pegarDatos').fill(payment);
  await page.locator('#btnProcesarPegado').click();
  assert.equal(await page.locator('#tablaPagos tbody tr').count(), 1);
  assert.ok(await page.locator('#tablaPagos tbody input').evaluateAll(els=>els.some(x=>x.value==='4911089297230')));
  await page.locator('[data-tab="datos"]').click();
  await page.locator('#concepto').selectOption('RENTA');
  await page.locator('#periodo').selectOption('1');
  await page.locator('#tieneSancion').selectOption('NO');
  await page.locator('.btn-calcular-normal:visible').first().click();
  await page.waitForFunction(()=>Number(document.querySelector('#rDeudaImpuesto')?.textContent.replace(/[^0-9]/g,''))>0);
  assert.equal(numeric(await page.locator('#rSaldoImpuesto').textContent()),900000);
  await page.locator('[data-tab="resultados"]').click();
  assert.equal(await page.locator('.soporte-panel').count(),0,'DIAN elimina el recuadro de soportes');
  assert.deepEqual(await page.locator('[data-pane="resultados"] .botonera button').allTextContents(),
    ['Importar Excel','Exportar Excel','Exportar PDF','Limpiar','Calcular liquidación'],
    'DIAN reúne las exportaciones después de Importar Excel');
  await captureExports(page.locator('#btnExportarPdf'),page.locator('#btnExportarExcel'),'dian',900000);
  const dianDesktop=await buttonStyles('[data-pane="resultados"] .botonera button');
  assert.deepEqual(await page.locator('.topbar .ruta-modulo button').allTextContents(),
    ['← Módulo de inicio','Ir a liquidación de TDJ'],'Navegación DIAN con enlace TDJ');
  const dianNav=await buttonStyles('.topbar .ruta-modulo button');
  assert.deepEqual(dianNav[1],dianNav[0],'Enlace TDJ con el diseño de Inicio');
  for(const pane of ['datos','pagos','resultados']){
    await page.locator(`[data-tab="${pane}"]`).click();
    const bar=`[data-pane="${pane}"] .botonera`;
    assert.deepEqual(await page.locator(bar+' button').allTextContents(),
      ['Importar Excel','Exportar Excel','Exportar PDF','Limpiar','Calcular liquidación'],`Cinco acciones DIAN ${pane}`);
    assert.deepEqual(await buttonStyles(bar+' button'),dianDesktop,`Diseño DIAN ${pane}`);
    await captureExports(page.locator(bar+' .btn-exportar-pdf'),page.locator(bar+' .btn-exportar-excel'),'dian-'+pane,900000);
  }
  await page.locator('.topbar').screenshot({path:path.join(output,'dian-navegacion.png')});
  await page.locator('[data-pane="resultados"] .botonera').screenshot({path:path.join(output,'dian-botonera.png')});
  await page.setViewportSize({width:390,height:844});
  const dianMobile=await buttonStyles('[data-pane="resultados"] .botonera button');
  for(const pane of ['datos','pagos','resultados']){
    await page.locator(`[data-tab="${pane}"]`).click();
    assert.deepEqual(await buttonStyles(`[data-pane="${pane}"] .botonera button`),dianMobile,`Diseño DIAN móvil ${pane}`);
  }
  for(const id of ['btnExportarExcel','btnExportarPdf']){
    const button=page.locator('#'+id);await button.scrollIntoViewIfNeeded();
    const box=await button.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=390,'Exportación accesible en móvil');
  }
  await page.locator('[data-pane="resultados"] .botonera').screenshot({path:path.join(output,'dian-botonera-movil.png')});
  await page.setViewportSize({width:1365,height:950});
  const fields=async(selector)=>page.locator(selector).evaluateAll(els=>els.map(el=>({id:el.id,value:el.value,disabled:el.disabled})));
  const datosAntesDeLimpiar=await fields('[data-pane="datos"] input,[data-pane="datos"] select,[data-pane="datos"] textarea');
  const saldoAntesDeLimpiar=await page.locator('#rSaldoImpuesto').textContent();
  await page.locator('[data-tab="pagos"]').click();
  await page.locator('[data-pane="pagos"] .btn-limpiar-normal').click();
  assert.equal(await page.locator('#tablaPagos tbody tr').count(), 0);
  assert.deepEqual(await fields('[data-pane="datos"] input,[data-pane="datos"] select,[data-pane="datos"] textarea'),datosAntesDeLimpiar,'Limpiar Pagos conserva datos y vencimientos');
  assert.equal(await page.locator('#rSaldoImpuesto').textContent(),saldoAntesDeLimpiar,'Limpiar Pagos conserva resultado previo');
  await page.locator('#pegarDatos').fill(payment);await page.locator('#btnProcesarPegado').click();
  const pagosAntesDeLimpiar=await fields('#tablaPagos input,#tablaPagos select,#pegarDatos');
  await page.waitForTimeout(100);
  await page.locator('[data-tab="datos"]').click();
  await page.locator('[data-pane="datos"] .btn-limpiar-normal').click();
  assert.equal(await page.locator('#nit').inputValue(),'');
  assert.equal(await page.locator('#razonSocial').inputValue(),'');
  assert.equal(await page.locator('#tieneSancion').inputValue(),'');
  assert.equal(await page.locator('#tablaVencimientos tbody tr').count(),1);
  assert.equal(await page.locator('#tablaVencimientos .fecha-native').inputValue(),'');
  assert.deepEqual(await fields('#tablaPagos input,#tablaPagos select,#pegarDatos'),pagosAntesDeLimpiar,'Limpiar Datos conserva pagos');
  assert.equal(await page.locator('#rSaldoImpuesto').textContent(),saldoAntesDeLimpiar,'Limpiar Datos conserva resultado previo');
  await page.locator('#btnIrTDJ').click();
  await page.waitForURL('**/titulos.html');
  await page.waitForLoadState('networkidle');

  await page.goto(`${baseURL}/titulos.html?v=${version}`, {waitUntil:'networkidle'});
  await page.waitForSelector('.obligacion-card', {state:'attached'});
  await assertNoIA();
  assert.equal(await page.locator('.nav-footer').count(),0,'TDJ elimina navegación inferior');
  assert.deepEqual(await page.locator('.topbar .ruta-modulo button').allTextContents(),
    ['← Módulo de inicio','Ir a liquidación de obligaciones'],'Navegación TDJ agrupada arriba');
  for(const [width,reference] of [[1365,dianDesktop],[390,dianMobile]]){
    await page.setViewportSize({width,height:width===390?844:950});
    const navStyles=await buttonStyles('.topbar .ruta-modulo button');
    assert.deepEqual(navStyles[1],navStyles[0],'Mismo diseño de ambos botones superiores');
    const navBoxes=await page.locator('.topbar .ruta-modulo button').evaluateAll(buttons=>buttons.map(b=>{
      const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right};
    }));
    assert.ok(navBoxes.every(b=>b.x>=0&&b.right<=width),'Navegación superior accesible');
    if(width===1365)assert.ok(navBoxes[1].x>navBoxes[0].x&&navBoxes[1].y===navBoxes[0].y,'Enlace DIAN a la derecha de Inicio');
    await page.locator('.topbar').screenshot({path:path.join(output,`tdj-navegacion-${width}.png`)});
    for(const pane of ['datos','pagos','titulos']){
      await page.locator(`[data-tab="${pane}"]`).click();
      const bar=`[data-pane="${pane}"] .tdj-sheet-actions`;
      assert.deepEqual(await page.locator(bar+' button').allTextContents(),
        ['Importar Excel','Exportar Excel','Exportar PDF','Limpiar','Calcular liquidación'],`Orden TDJ ${pane}`);
      assert.deepEqual(await buttonStyles(bar+' button'),reference,`Diseño DIAN en TDJ ${pane} a ${width}px`);
      await page.locator(bar).screenshot({path:path.join(output,`tdj-botonera-${pane}-${width}.png`)});
    }
  }
  await page.setViewportSize({width:1365,height:950});
  await page.locator('[data-tab="datos"]').click();
  await page.locator('#destinoImportacionObligacion').selectOption({index:1});
  await page.locator('#importarObligacionTexto').fill(obligation);
  await page.locator('#btnImportarObligacionTDJ').click();
  assert.equal(await page.locator('#nitGlobal').inputValue(), '900123456');
  await page.locator('.obligacion-card [data-k="concepto"]').selectOption('RENTA');
  await page.locator('.obligacion-card [data-k="periodo"]').selectOption('1');
  await page.locator('[data-tab="pagos"]').click();
  await page.locator('#destinoImportacionPagos').selectOption({index:1});
  await page.locator('#importarPagosTexto').fill(payment);
  await page.locator('#btnImportarPagosTDJ').click();
  assert.equal(await page.locator('[data-p="recibo"]').first().inputValue(), '4911089297230');
  await page.locator('[data-tab="titulos"]').click();
  await page.locator('#importarTitulosTexto').fill('TDJ\tFecha\tValor\n4911095388931\t16/05/2024\t157');
  await page.locator('#btnProcesarImportTitulos').click();
  assert.equal(await page.locator('#tablaTitulos tbody [data-t="tdj"]').first().inputValue(), '4911095388931');
  await page.locator('.btn-calcular-tdj:visible').first().click();
  await page.waitForFunction(()=>document.querySelector('#resSaldo')?.textContent.replace(/[^0-9]/g,'')==='899843');
  assert.equal(numeric(await page.locator('#resSaldo').textContent()),899843);
  const xlsxPath=await captureExports(page.locator('.tdj-pdf:visible').first(),page.locator('.tdj-excel:visible').first(),'tdj',899843);
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.tdj-import-excel:visible').first().click()]);
  await chooser.setFiles(xlsxPath);
  await page.waitForFunction(()=>document.querySelector('#tablaTitulos [data-t="tdj"]')?.value==='4911095388931');
  await page.locator('.btn-calcular-tdj:visible').first().click();
  assert.equal(numeric(await page.locator('#resSaldo').textContent()),899843,'Excel TDJ conserva el saldo al reimportar');
  await page.locator('.tdj-title-import').screenshot({path:path.join(output,'tdj-importar.png')});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.tdj-title-import').screenshot({path:path.join(output,'tdj-importar-movil.png')});
  const overflow = await page.locator('.tdj-title-import').evaluate(el=>el.scrollWidth > el.clientWidth);
  assert.equal(overflow, false, 'El importador TDJ debe caber en móvil');
  await page.locator('#btnLimpiarTitulosGlobal').click();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.obligacion-card', {state:'attached'});
  await page.locator('.topbar .ruta-modulo button').nth(1).click();
  await page.waitForURL('**/liquidacion.html');
  // La carga de parámetros debe terminar antes de salir de DIAN; abortarla
  // durante la siguiente navegación activa el aviso de error de la aplicación.
  await page.waitForLoadState('networkidle');
  await page.goto(`${baseURL}/titulos.html`,{waitUntil:'networkidle'});
  await page.locator('.topbar .ruta-modulo button').first().click();
  await page.waitForURL('**/index.html');
  const iaRequests = requests.filter(x=>/ai-bridge|ai-liquidador|\/interpret\/|\/feedback|\/health.*ia/i.test(x));
  assert.deepEqual(iaRequests, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(alerts.filter(x=>!x.startsWith('¿Desea iniciar')&&!x.startsWith('Excel importado correctamente.')), []);
  const result = {estado:'OK',modo:live?'produccion':'local', importaciones:['DIAN obligación','DIAN pagos','TDJ obligación','TDJ pagos','TDJ títulos'],saldos:{dian:900000,tdj:899843},exportaciones:'PDF y XLSX DIAN/TDJ; reimportación XLSX TDJ',limpieza:'DIAN pagos y TDJ global',solicitudesIA:iaRequests,erroresJS:errors,alertas:alerts,serviciosExternos:live?'Conexión real de producción':'Bloqueados; configuración Supabase vacía de prueba'};
  await fs.writeFile(path.join(output,'navegador-233.json'),JSON.stringify(result,null,2));
  console.log(result);
} finally {await browser.close();}
