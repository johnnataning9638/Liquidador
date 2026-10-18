import {chromium} from 'playwright';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const URL='https://liquidador-de-obligaciones-tributarias.onrender.com/titulos.html?v=16.33.177';
const money=v=>Number(String(v||'').replace(/[^0-9-]/g,''))||0;
const assert=(ok,msg)=>{if(!ok)throw new Error(`LIVE TDJ 177: ${msg}`)};

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true,viewport:{width:1600,height:1000}});
page.on('pageerror',e=>console.error('PAGEERROR',e.message));

async function setNativeDate(locator,iso){
  await locator.fill(iso);
  await locator.dispatchEvent('change');
}
async function setMoney(locator,n){
  await locator.fill(String(n));
  await locator.dispatchEvent('input');
  await locator.dispatchEvent('change');
  await locator.blur();
}

try{
  let ok=false,last='';
  for(let i=0;i<12;i++){
    try{
      const r=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
      last=`HTTP ${r?.status()}`;
      const html=await page.content();
      if(html.includes('TDJ UI DEPLOY 16.33.177')){ok=true;break;}
    }catch(e){last=e.message}
    await page.waitForTimeout(2500);
  }
  assert(ok,`Render no entregó la interfaz 16.33.177 (${last})`);
  await page.waitForSelector('#listaObligaciones .obligacion-card',{timeout:30000});
  await page.waitForFunction(()=>/MOTOR DISPONIBLE|MOTOR DE LIQUIDACIÓN DISPONIBLE|IA DIAN/.test(document.body.innerText),{timeout:30000});

  await page.locator('#nitGlobal').fill('901473152');
  const ob=page.locator('#listaObligaciones .obligacion-card').first();
  await ob.locator('[data-k="concepto"]').selectOption({label:'VENTAS'});
  await ob.locator('[data-k="anio"]').fill('2025');
  await ob.locator('[data-k="anio"]').dispatchEvent('change');
  await ob.locator('[data-k="periodo"]').selectOption('3');
  await ob.locator('[data-k="tieneSancion"]').selectOption('SI');
  await setMoney(ob.locator('[data-k="valorSancion"]'),524000);
  await setNativeDate(ob.locator('.fecha-dual').locator('.fecha-native').nth(0),'2026-06-16');
  await ob.locator('[data-k="beneficioSancion"]').selectOption({label:'SIN BENEFICIO'});
  const vto=ob.locator('.cuotas-mini tbody tr').first();
  await setNativeDate(vto.locator('.fecha-native'),'2026-01-14');
  await setMoney(vto.locator('[data-v="impuesto"]'),40771000);

  await page.getByRole('button',{name:'+ AGREGAR PAGO'}).click();
  await page.getByRole('button',{name:'+ AGREGAR PAGO'}).click();
  await page.getByRole('button',{name:'+ AGREGAR PAGO'}).click();
  const pagos=page.locator('.pagos-mini tbody tr');
  assert(await pagos.count()===3,'no se crearon los 3 pagos normales');
  const fechas=['2026-06-16','2026-07-14','2026-10-01'];
  const valores=[15027000,5986000,8193000];
  for(let i=0;i<3;i++){
    await setNativeDate(pagos.nth(i).locator('.fecha-native'),fechas[i]);
    await setMoney(pagos.nth(i).locator('[data-p="valor"]'),valores[i]);
  }
  await pagos.nth(2).locator('[data-p="tipo"]').selectOption({label:'ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO'});
  await pagos.nth(2).locator('[data-p="tipo"]').dispatchEvent('change');

  for(let i=0;i<4;i++)await page.getByRole('button',{name:'+ AGREGAR TÍTULO'}).click();
  const tit=page.locator('#tablaTitulos tbody tr');
  const tdjs=['469030003386678','46903000338669','469030003386680','469030003387674'];
  const tvals=[500000,500000,20000000,10000000];
  for(let i=0;i<4;i++){
    await tit.nth(i).locator('[data-t="tdj"]').fill(tdjs[i]);
    await tit.nth(i).locator('[data-t="valor"]').fill(String(tvals[i]));
    await tit.nth(i).locator('[data-t="valor"]').dispatchEvent('input');
    await tit.nth(i).locator('[data-t="valor"]').blur();
    await setNativeDate(tit.nth(i).locator('.fecha-native'),'2026-07-24');
  }

  await page.getByRole('button',{name:'CALCULAR LIQUIDACIÓN'}).last().click();
  await page.waitForFunction(()=>!document.querySelector('#resultadoTDJ')?.hidden && document.querySelector('#resEndoso')?.textContent?.trim(),{timeout:30000});
  await page.waitForTimeout(1000);

  const summary={
    total:money(await page.locator('#resTotalTitulos').innerText()),
    applied:money(await page.locator('#resAplicado').innerText()),
    saldo:money(await page.locator('#resSaldo').innerText()),
    endoso:money(await page.locator('#resEndoso').innerText())
  };
  assert(summary.total===31000000,`TOTAL TÍTULOS esperado 31.000.000, obtenido ${summary.total}`);
  assert(summary.applied===16548000,`TOTAL APLICADO esperado 16.548.000, obtenido ${summary.applied}`);
  assert(summary.saldo===0,`SALDO esperado 0, obtenido ${summary.saldo}`);
  assert(summary.endoso===14452000,`ENDOSO esperado 14.452.000, obtenido ${summary.endoso}`);

  const rows=page.locator('#tablaAplicacion tbody tr');
  const trace={};
  for(let i=0;i<await rows.count();i++){
    const c=await rows.nth(i).locator('td').allTextContents();
    trace[c[0].trim()]={available:money(c[3]),applied:money(c[7]),saldoTDJ:money(c[8]),saldoOblig:money(c[9])};
  }
  assert(trace[tdjs[0]]?.applied===500000,'TDJ1 no quedó aplicado en 500.000');
  assert(trace[tdjs[1]]?.applied===500000,'TDJ2 no quedó aplicado en 500.000');
  assert(trace[tdjs[2]]?.applied===15548000 && trace[tdjs[2]]?.saldoTDJ===4452000,'TDJ3 no quedó 15.548.000 aplicado / 4.452.000 endoso');
  assert(trace[tdjs[3]]?.applied===0 && trace[tdjs[3]]?.saldoTDJ===10000000,'TDJ4 sigue consumiéndose: debe quedar 0 aplicado / 10.000.000 disponible');

  const endRows=page.locator('#tablaEndoso tbody tr');
  const endText=(await endRows.allTextContents()).join('\n');
  assert(endText.includes(tdjs[2])&&endText.includes('4.452.000'),'ENDOSO no muestra TDJ3 4.452.000');
  assert(endText.includes(tdjs[3])&&endText.includes('10.000.000'),'ENDOSO no muestra TDJ4 10.000.000');

  const pdfDownload=page.waitForEvent('download');
  await page.locator('.tdj-pdf').last().click();
  const pdf=await pdfDownload;
  const pdfPath='/tmp/tdj-177.pdf';
  await pdf.saveAs(pdfPath);
  const pdfText=execFileSync('pdftotext',[pdfPath,'-'],{encoding:'utf8'});
  assert(pdfText.includes('10.000.000'),'PDF no contiene el valor completo del TDJ4');
  assert(/TDJ[\s\S]{0,800}469030003387674[\s\S]{0,800}10\.000\.000/.test(pdfText),'PDF no conserva la identidad/valor del TDJ4');
  assert(pdfText.includes('14.452.000'),'PDF no contiene el total de endoso 14.452.000');

  const xlsxDownload=page.waitForEvent('download');
  await page.locator('.tdj-excel').last().click();
  const xlsx=await xlsxDownload;
  const xlsxPath='/tmp/tdj-177.xlsx';
  await xlsx.saveAs(xlsxPath);
  const sheet=execFileSync('unzip',['-p',xlsxPath,'xl/worksheets/sheet1.xml'],{encoding:'utf8'});
  assert(sheet.includes('469030003386680'),'Excel TDJ no conserva TDJ3');
  assert(sheet.includes('20000000'),'Excel TDJ no conserva TDJ3 original 20.000.000');
  assert(sheet.includes('469030003387674'),'Excel TDJ no conserva TDJ4');
  assert(sheet.includes('10000000'),'Excel TDJ no conserva TDJ4 original 10.000.000');
  assert(sheet.includes('14452000'),'Excel TDJ no conserva el total endoso 14.452.000');

  console.log('LIVE TDJ 177 OK');
  console.log(JSON.stringify({summary,trace,pdf:'/tmp/tdj-177.pdf',xlsx:'/tmp/tdj-177.xlsx'},null,2));
} finally {
  await browser.close();
}
