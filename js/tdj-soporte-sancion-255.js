// Presentación exclusiva TDJ. Plantilla y estilos copiados literalmente de
// DIAN; pruebas de paridad impiden divergencias. No calcula ni modifica saldos.
export function crearRenderSancionTDJ(h){
 const {escPdf,dinero,fechaVisible,hoyISO,dvNIT,tasaPdfArt45}=h;
function bloquePdfSinPagos(d,r){
  const detalle=Array.isArray(r.interesesPorCuota)?r.interesesPorCuota:[];
  // LIQUIDACIÓN OFICIAL SIN PAGOS: el motor entrega el interés por vencimiento
  // con sus tramos, pero en este escenario no existe un pago real que complete
  // todos los metadatos de presentación. Para el PDF reconstruimos únicamente
  // la información de soporte desde el vencimiento y los tramos ya calculados.
  // NO se recalcula ningún interés aquí.
  const filasInteres=detalle.length?detalle.map((t,i)=>{
    const vto=(r.vencimientos||[]).find(v=>v.id===t.vto)||null;
    const tramos=Array.isArray(t.tramos)?t.tramos:[];
    const normales=tramos.filter(z=>z&&z.tipo!=="SUSPENSION_INTERESES");
    const primer=normales[0]||tramos[0]||{};
    const desde=t.desde||t.fechaVencimiento||primer.desde||vto?.fecha||"";
    const hasta=t.hasta||t.fechaPago||primer.hasta||r.fechaCorte||"";
    const dias=t.dias!=null?Number(t.dias):normales.reduce((a,z)=>a+Number(z.dias||0),0);
    const tasa=t.tasa!=null?Number(t.tasa):(primer.tasa==null?null:Number(primer.tasa));
    const capital=(Number(t.base||0)>0?Number(t.base):(Number(t.capitalBase||0)>0?Number(t.capitalBase):(Number(vto?.saldo??vto?.impuesto??0)>0?Number(vto?.saldo??vto?.impuesto??0):Number(r.impuesto||0))));
    const interes=t.interes??t.valor??normales.reduce((a,z)=>a+Number(z.valor||0),0);
    const metodologia=t.metodologia||primer.metodologia||"INTERÉS CALCULADO";
    return `<tr><td>${escPdf(t.vto||t.cuota||vto?.numero||i+1)}</td><td>${dinero(capital)}</td><td>${escPdf(fechaVisible(desde))}</td><td>${escPdf(fechaVisible(hasta))}</td><td>${dias}</td><td>${tasa==null?"—":(tasa*100).toFixed(3)+"%"}</td><td>${dinero(interes)}</td><td>${escPdf(metodologia)}</td></tr>`;
  }).join(""):
    `<tr><td colspan="8">NO SE GENERARON TRAMOS DE INTERÉS.</td></tr>`;
  const tramosSancion=(Array.isArray(r.sancionActualizacion?.tramos)?r.sancionActualizacion.tramos:[])
    .flatMap(x=>Array.isArray(x?.tramos)?x.tramos:[x])
    .filter(t=>t&&typeof t==="object"&&Number.isFinite(Number(t.anio)));
  const filasSancion=tramosSancion.length?tramosSancion.map(t=>`<tr><td>${escPdf(t.anio||"")}</td><td>${escPdf(fechaVisible(t.desde||""))}</td><td>${Number(t.anioInflacion??(Number(t.anio||0)-1))}</td><td>${dinero(t.saldoAntes??t.saldoInicial??0)}</td><td>${Number(t.ipcPorcentaje||0).toFixed(3)}%</td><td>${dinero(t.actualizacion||0)}</td><td>${dinero(t.saldoDespues??t.saldoFinal??0)}</td></tr>`).join(""):
    `<tr><td colspan="7">NO SE REALIZARON ACTUALIZACIONES DE SANCIÓN.</td></tr>`;
  const totalAct=tramosSancion.reduce((a,t)=>a+Number(t.actualizacion||0),0);
  const diasInteres=detalle.reduce((a,t)=>a+Number(t.dias||0),0);
  const tasas=[...new Set(detalle.filter(t=>t.tasa!=null).map(t=>tasaPdfArt45(null,Number(t.tasa)*100)))].join(" / ")||"TASA DIAN";
  const corte=r.fechaCorte||d.fechaCorte||hoyISO();
  return `<article class="pdf-liquidacion">
    <div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">LIQUIDADOR OBLIGACIONES<div>LIQUIDACIÓN A FECHA DE CORTE — SIN PAGOS</div></div><div class="pdf-generado">Generado: ${fechaVisible(hoyISO())}</div></div>
    <div class="pdf-datos">
      <div class="pdf-dato"><b>AÑO</b><strong>${escPdf(d.anio)}</strong></div><div class="pdf-dato"><b>CONCEPTO</b><strong>${escPdf(d.concepto)}</strong></div><div class="pdf-dato"><b>PERÍODO</b><strong>${escPdf(d.periodo)}</strong></div><div class="pdf-dato"><b>NIT</b><strong>${escPdf(d.nit)}</strong></div><div class="pdf-dato"><b>D.V.</b><strong>${escPdf(dvNIT(d.nit))}</strong></div>
      <div class="pdf-dato ancho-2"><b>RAZÓN SOCIAL</b><strong>${escPdf(d.razonSocial)}</strong></div><div class="pdf-dato"><b>TIPO DE LIQUIDACIÓN</b><strong>${escPdf(d.tipoLiquidacion||"")}</strong></div><div class="pdf-dato"><b>FECHA DE PRESENTACIÓN/SANCIÓN</b><strong>${escPdf(fechaVisible(d.fechaSancion))}</strong></div><div class="pdf-dato ancho-2"><b>FECHA VENCIMIENTO PARA DECLARAR</b><strong>${escPdf(fechaVisible(d.fechaVencimientoDeclarar))}</strong></div><div class="pdf-dato"><b>FECHA DE CORTE</b><strong>${escPdf(fechaVisible(corte))}</strong></div>
    </div>
    <div class="pdf-obligacion"><div class="pdf-fila"><div class="pdf-celda"><b>IMPUESTO</b><strong>${dinero(r.impuesto||0)}</strong></div><div class="pdf-celda"><b>SANCIÓN ACTUALIZADA</b><strong>${dinero(r.sancion||0)}</strong></div><div class="pdf-celda"><b>INTERESES A FECHA DE CORTE</b><strong>${dinero(r.intereses||0)}</strong></div><div class="pdf-celda"><b>TOTAL OBLIGACIÓN</b><strong>${dinero(r.total||0)}</strong></div></div><div class="pdf-fila"><div class="pdf-celda"><b>VALOR PAGO</b><strong>${dinero(0)}</strong></div><div class="pdf-celda"><b>RECIBO DE PAGO</b><strong></strong></div><div class="pdf-celda"><b>DÍAS TOTALES DE INTERÉS</b><strong>${diasInteres}</strong></div><div class="pdf-celda"><b>TASAS UTILIZADAS</b><strong>${escPdf(tasas)}</strong></div></div></div>
    <div class="pdf-beneficio"><b>CONDICIÓN:</b> LIQUIDACIÓN INFORMATIVA A LA FECHA DE CORTE, SIN PAGOS REGISTRADOS. EL IMPUESTO SE CONSERVA ÍNTEGRAMENTE; SE ACTUALIZAN SANCIÓN E INTERESES CON LAS REGLAS NORMALES DEL LIQUIDADOR.</div>
    <div class="pdf-intereses"><h3>CÁLCULO DE INTERESES — DESGLOSE COMPLETO</h3><div class="pdf-actualizacion-descripcion">Los intereses se calculan desde cada fecha de vencimiento hasta la fecha de corte, sobre el capital correspondiente. Días: ${diasInteres}. Tasa(s) utilizada(s): ${escPdf(tasas)}.</div><table><thead><tr><th>CUOTA / VTO.</th><th>CAPITAL BASE</th><th>DESDE</th><th>HASTA</th><th>DÍAS</th><th>TASA</th><th>INTERÉS</th><th>METODOLOGÍA</th></tr></thead><tbody>${filasInteres}</tbody><tfoot><tr><th colspan="6">TOTAL INTERESES A LA FECHA DE CORTE</th><th>${dinero(r.intereses||0)}</th><th></th></tr></tfoot></table></div>
    <div class="pdf-actualizacion-sancion"><h3>ACTUALIZACIÓN DE SANCIÓN — DETALLE COMPLETO</h3><div class="pdf-actualizacion-descripcion">La actualización se aplica conforme a la lógica normativa vigente del liquidador, identificando cada vigencia, fecha de aplicación, año del IPC utilizado, valor anterior, porcentaje de IPC, actualización y valor resultante.</div><table><thead><tr><th>AÑO</th><th>FECHA APLICACIÓN</th><th>AÑO IPC</th><th>VALOR ANTERIOR</th><th>IPC</th><th>ACTUALIZACIÓN</th><th>VALOR DESPUÉS</th></tr></thead><tbody>${filasSancion}</tbody><tfoot><tr><th colspan="5">TOTAL ACTUALIZACIÓN DE SANCIÓN</th><th>${dinero(totalAct)}</th><th>${dinero(r.sancion||0)}</th></tr></tfoot></table></div>
    <div class="pdf-pago"><div class="pdf-pago-titulo">RESUMEN DE LA OBLIGACIÓN A LA FECHA DE CORTE</div><table class="pdf-tabla"><thead><tr><th>CONCEPTO</th><th>VALOR</th></tr></thead><tbody><tr><td>IMPUESTO</td><td>${dinero(r.impuesto||0)}</td></tr><tr><td>INTERESES</td><td>${dinero(r.intereses||0)}</td></tr><tr><td>SANCIÓN ACTUALIZADA</td><td>${dinero(r.sancion||0)}</td></tr><tr class="total"><td>TOTAL OBLIGACIÓN</td><td>${dinero(r.total||0)}</td></tr></tbody></table></div>
    <div class="pdf-aplicaciones"><h3>PAGOS REGISTRADOS</h3><table><thead><tr><th>ESTADO</th><th>VALOR</th><th>RECIBO</th></tr></thead><tbody><tr><td>SIN PAGOS REGISTRADOS</td><td>${dinero(0)}</td><td></td></tr></tbody></table></div>
    <div class="pdf-nota">Nota: esta liquidación determina el valor total de la obligación a la fecha de corte indicada. No representa un pago registrado ni crea un recibo de pago.</div>
  </article>`;
}

 return bloquePdfSinPagos;
}

export function esSoloSancionSinPagosTDJ(x){
 const o=x?.obligacion||{},r=x?.estadoFinal||x?.liquidacionBase||{};
 return o.tieneSancion==="SI"&&Number(o.valorSancion)>0
  &&!(o.vencimientos||[]).some(v=>Number(v.impuesto||0)>0)
  &&Number(r.impuesto||0)===0&&Number(r.intereses||0)===0
  &&!(o.pagos||[]).some(p=>Number(p.valor||0)>0)
  &&!(r.detalle||[]).some(d=>Number(d.pago?.valor||0)>0)
  &&!(x.aplicaciones||[]).some(a=>Number(a.aplicado||0)>0);
}

function estilosPdf(){
  return `
  @page{size:A4 portrait;margin:22mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:#17324d;font-family:Arial,Helvetica,sans-serif}
  body{font-size:11pt}
  .pdf-soporte{width:100%;padding:0;margin:0}
  .pdf-hoja{width:100%;height:253mm;min-height:253mm;page-break-after:always;break-after:page;overflow:hidden}
  .pdf-hoja:last-child{page-break-after:auto;break-after:auto}
  .pdf-pagina{width:100%;height:100%;display:block}
  .pdf-liquidacion{width:100%;height:100%;min-height:0;overflow:hidden;border:1px solid #8aa0b2;background:#fff;break-inside:avoid;page-break-inside:avoid}
  .pdf-marca{display:grid;grid-template-columns:18mm 1fr 30mm;align-items:center;border-bottom:1px solid #7f9aae;background:#f5f8fa;height:10mm}
  .pdf-logo{font-weight:700;color:#007f9e;font-size:11pt;text-align:center;padding:1mm;border-right:1px solid #9aadb9}
  .pdf-titulo{text-align:center;font-weight:700;font-size:11pt;letter-spacing:.1px;padding:1mm}
  .pdf-generado{text-align:right;font-size:8pt;padding:1mm 1.5mm}
  .pdf-datos{display:grid;grid-template-columns:1fr 1.1fr .8fr 1fr .55fr;border-bottom:1px solid #9aadb9}
  .pdf-dato{padding:1.5mm 1.5mm;border-right:1px solid #9aadb9;border-bottom:1px solid #d1dbe1;min-height:8mm}
  .pdf-dato b{display:block;font-size:8pt;color:#4b6578;margin-bottom:.5mm}
  .pdf-dato strong{font-size:11pt}
  .pdf-dato.ancho-2{grid-column:span 2}
  .pdf-tasa{font-size:11pt!important}
  .pdf-obligacion{margin:2mm;border:1px solid #8da6b7}
  .pdf-fila{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;border-bottom:1px solid #aebdc7}
  .pdf-fila:last-child{border-bottom:0}
  .pdf-celda{padding:1.5mm 1.5mm;border-right:1px solid #aebdc7}
  .pdf-celda:last-child{border-right:0}
  .pdf-celda b{display:block;font-size:8pt;color:#50697b;margin-bottom:.5mm}
  .pdf-celda strong{font-size:11pt}
  .pdf-observaciones{min-height:8mm}
  .pdf-beneficio{margin:1.5mm 2mm;padding:1.5mm;border:1px solid #9fb4c5;background:#eef5f9;font-size:9pt;color:#17324a;white-space:nowrap;overflow:hidden}
  .pdf-intereses{margin:1.5mm 2mm;border:1px solid #8da6b7;break-inside:avoid;page-break-inside:avoid}
  .pdf-intereses h3{margin:0;padding:1.5mm;background:#dceaf4;color:#17324d;font-size:11pt}
  .pdf-intereses table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-intereses th,.pdf-intereses td{border:1px solid #b4c4cf;padding:1.25mm;text-align:right;font-size:9pt;line-height:1.05;white-space:nowrap}
  .pdf-intereses th:first-child,.pdf-intereses td:first-child{text-align:center}
  .pdf-intereses thead th{background:#eef4f8;font-size:8.5pt}
  .pdf-intereses tfoot th{background:#e8f1f6;font-weight:700;font-size:9pt}
  .pdf-suspension-intereses{margin:1.5mm 2mm;border:1px solid #8da6b7;break-inside:avoid;page-break-inside:avoid}
  .pdf-suspension-intereses h3{font-size:9.5pt;margin:0;padding:1.25mm;background:#dceaf4;color:#17324d}
  .pdf-suspension-descripcion{padding:1.1mm 1.5mm;font-size:7.8pt;line-height:1.1;background:#f8fbfc;border-bottom:1px solid #b7c4cc}
  .pdf-suspension-resumen{display:grid;grid-template-columns:repeat(3,1fr);gap:1mm;padding:1.2mm;background:#fff}
  .pdf-suspension-resumen>div{border:1px solid #c4d1d9;padding:1mm;background:#f5f9fb;min-height:7mm}
  .pdf-suspension-resumen b{display:block;font-size:6.2pt;color:#17324d;margin-bottom:.5mm}
  .pdf-suspension-resumen span{display:block;font-size:8pt;font-weight:700;color:#1f3344}
  .pdf-suspension-intereses table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-suspension-intereses th,.pdf-suspension-intereses td{border:1px solid #b7c4cc;padding:1.05mm;font-size:7.5pt;line-height:1.05;text-align:right;white-space:nowrap}
  .pdf-suspension-intereses th:first-child,.pdf-suspension-intereses td:first-child{text-align:left}
  .pdf-suspension-intereses thead th{background:#eef4f8;font-size:7pt}
  .pdf-suspension-intereses tfoot th{background:#e8f1f6;font-weight:700}
  .pdf-pago{margin:1.5mm 2mm 0;border:1px solid #78a2bc}
  .pdf-pago-titulo{text-align:center;font-weight:700;font-size:11pt;padding:1.5mm;background:#e8f1f6;border-bottom:1px solid #78a2bc}
  .pdf-tabla{width:100%;border-collapse:collapse}
  .pdf-tabla th,.pdf-tabla td{border:1px solid #8da6b7;padding:1.25mm;text-align:right;font-size:9pt;line-height:1.05}
  .pdf-tabla th{font-size:8.5pt;background:#e9eff3}
  .pdf-tabla td:first-child,.pdf-tabla th:first-child{text-align:left}
  .pdf-tabla .total td{font-weight:700;background:#edf3f6}
  .pdf-aplicaciones{margin:1.5mm 2mm;border:1px solid #9db1bf}
  .pdf-aplicaciones h3{font-size:9.5pt;margin:0;padding:1.25mm;background:#edf3f6}
  .pdf-aplicaciones table{width:100%;border-collapse:collapse}
  .pdf-aplicaciones th,.pdf-aplicaciones td{border:1px solid #b7c4cc;padding:1.1mm;font-size:8.5pt;line-height:1.05}
  .pdf-nota{text-align:center;font-weight:700;padding:1mm;font-size:8pt}
  .pdf-excedente{margin:1.5mm 2mm;padding:1.25mm 1.5mm;border:1px solid #c58a1a;background:#fff6d8;color:#7a5200;font-size:9pt}
  .pdf-actualizacion-sancion{margin:1.5mm 2mm;border:1px solid #8da6b7;break-inside:avoid;page-break-inside:avoid}
  .pdf-actualizacion-sancion h3{font-size:9.5pt;margin:0;padding:1.25mm;background:#edf3f6}
  .pdf-actualizacion-sancion table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-actualizacion-sancion th,.pdf-actualizacion-sancion td{border:1px solid #b7c4cc;padding:1mm;font-size:7.5pt;line-height:1.02;text-align:right;white-space:nowrap}
  .pdf-actualizacion-sancion th:first-child,.pdf-actualizacion-sancion td:first-child{text-align:center}
  .pdf-actualizacion-sancion thead th{background:#eef4f8;font-size:7.2pt}
  .pdf-actualizacion-sancion tfoot th{background:#e8f1f6;font-weight:700}
  .pdf-actualizacion-descripcion{padding:1mm 1.5mm;font-size:7.5pt;line-height:1.05;background:#f8fbfc;border-bottom:1px solid #b7c4cc}
  .pdf-bloque{margin:2mm;border:1px solid #c58a1a;background:#fffdf7;break-inside:avoid;page-break-inside:avoid}
  .pdf-bloque h2{margin:0;padding:1.5mm 2mm;background:#fff6d8;color:#7a5200;font-size:11pt;border-bottom:1px solid #c58a1a}
  .pdf-bloque table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-bloque th,.pdf-bloque td{border:1px solid #c9a45a;padding:1.25mm;font-size:8.5pt;line-height:1.05;text-align:right;white-space:nowrap}
  .pdf-bloque th:first-child,.pdf-bloque td:first-child{text-align:center}
  .pdf-bloque thead th{background:#fff9e8;font-size:8pt}
  .pdf-bloque tfoot th{background:#fff0c2;font-weight:700}
  .pdf-excedentes-finales{margin:2mm;border:1px solid #c58a1a;break-inside:avoid;page-break-inside:avoid}
  .pdf-excedentes-finales h3{font-size:9.5pt;margin:0;padding:1.25mm;background:#fff6d8;color:#7a5200}
  .pdf-excedentes-finales table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-excedentes-finales th,.pdf-excedentes-finales td{border:1px solid #c9a45a;padding:1mm;font-size:8pt;line-height:1.02;text-align:right;white-space:nowrap}
  .pdf-excedentes-finales th:first-child,.pdf-excedentes-finales td:first-child{text-align:center}
  .pdf-excedentes-finales thead th{background:#fff9e8}
  .pdf-excedentes-finales tfoot th{background:#fff0c2;font-weight:700}
  .pdf-resumen-final{overflow:hidden}
  .pdf-resumen-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin:3mm 2mm}
  .pdf-resumen-grid>div{border:1px solid #8da6b7;padding:3mm;text-align:center;background:#eef5f9}
  .pdf-resumen-grid b{display:block;font-size:8pt;margin-bottom:1mm}
  .pdf-resumen-grid strong{font-size:13pt}
  .pdf-excedente-final{margin:3mm 2mm;padding:3mm;border:1px solid #c58a1a;background:#fff6d8;color:#7a5200;font-size:12pt}
  .pdf-excedente-final span{font-size:9pt}
  .pdf-alerta{margin:2mm;padding:1.5mm;border:1px solid #d2a84a;background:#fff8df;font-size:10pt}
  .pdf-hoja-final-resumen{width:100%;height:auto!important;min-height:0!important;overflow:visible!important;break-before:page;page-break-before:always;break-after:auto;page-break-after:auto;break-inside:auto;page-break-inside:auto}
  .pdf-hoja-final-resumen + .pdf-hoja-final-resumen{break-before:auto;page-break-before:auto}
  .pdf-hoja-final-resumen .pdf-pagina{height:auto!important;min-height:0!important}
  .pdf-hoja-final-resumen .pdf-liquidacion{height:auto!important;min-height:0!important;overflow:visible!important}
  @media print{
    html,body{width:210mm;background:#fff!important}
    .pdf-soporte{display:block!important;width:100%!important}
    .pdf-hoja{display:block!important;width:100%!important;height:246.2mm!important;min-height:246.2mm!important;page-break-after:always!important;break-after:page!important}
    .pdf-hoja:last-child{page-break-after:auto!important;break-after:auto!important}
    .pdf-pagina{display:block!important;width:100%!important;height:100%!important}
    .pdf-liquidacion{display:block!important;visibility:visible!important;width:100%!important;height:100%!important}
  }`;
}

let cssCache="";
export function estilosSancionTDJ(){
 if(cssCache)return cssCache;
 const sheet=new CSSStyleSheet();sheet.replaceSync(estilosPdf());
 const scope=".pdf-sancion-dian.pdf-sancion-dian";
 function reglas(list,media=false){return [...list].map(rule=>{
  if(rule.type===1){
   if(media&&/^(html|body|html, body)$/.test(rule.selectorText))return "";
   const selectors=rule.selectorText.split(',').map(s=>s.trim()).map(s=>/^(html|body)$/.test(s)?scope:`${scope} ${s}`);
   const declarations=[...rule.style].map(p=>`${p}:${rule.style.getPropertyValue(p)}!important`).join(';');
   return `${selectors.join(',')}{${declarations}}`;
  }
  if(rule.type===4)return `@media ${rule.conditionText}{${reglas(rule.cssRules,true)}}`;
  return "";
 }).join('\n');}
 cssCache=`${scope} *{all:revert!important}`+reglas(sheet.cssRules)+`${scope}{width:100%;height:100%}#soporteSancionDianTDJ{padding:12px}#soporteSancionDianTDJ .pdf-sancion-dian,#soporteSancionDianTDJ .pdf-liquidacion{height:auto!important;min-height:0!important;overflow:visible!important}`;
 return cssCache;
}
