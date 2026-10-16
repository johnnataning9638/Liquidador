import fs from "node:fs";

const tdj = fs.readFileSync("js/tdj.js", "utf8");
const html = fs.readFileSync("titulos.html", "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// PDF: los excedentes de pagos ya no crean una hoja independiente.
assert(tdj.includes("const bloquesExcedentesFinal=[];"), "Falta acumulador de excedentes para el resumen final.");
assert(tdj.includes("if(bloqueExcedentes)bloquesExcedentesFinal.push(bloqueExcedentes);"), "Los excedentes todavía no se consolidan en el resumen final.");
assert(!tdj.includes('if(bloqueExcedentes)paginas.push(`<section class="pdf-hoja">${bloqueExcedentes}</section>`);'), "Persisten hojas independientes para excedentes de pagos.");

// PDF: el resumen final debe aparecer aunque ningún TDJ haya sido aplicado.
assert(tdj.includes("const hayTitulosRegistrados=titulos.some(t=>fechaISO(t.fecha)&&Number(t.valor)>0);"), "Falta detección de títulos registrados.");
assert(tdj.includes("const hayExcedentesPago=bloquesExcedentesFinal.length>0;"), "Falta detección de excedentes de pagos.");
assert(tdj.includes("if(hayTitulosRegistrados || hayExcedentesPago)    paginas.push(`"), "El resumen final todavía depende de títulos aplicados.");

// PDF: ambos bloques deben quedar en la misma hoja final.
assert(tdj.includes('${bloquesExcedentesFinal.join("")}<section class="pdf-bloque"><h2>TÍTULOS PARA ENDOSO</h2>'), "No se consolidaron excedentes y títulos para endoso en la misma hoja.");
assert(tdj.includes("resultado.resumenTitulos.filter(x=>Number(x.excedente||0)>0)"), "La tabla de endoso no usa el saldo real del título.");
assert(tdj.includes("<th>SOBRANTE</th><th>DESTINO</th>"), "Falta columna de saldo a endosar/destino.");

// Limpieza global desde TÍTULOS: captura temprana y query de reinicio.
assert(html.includes('id="btnLimpiarTitulosGlobal"'), "Falta identificador del LIMPIAR global de TÍTULOS.");
assert(html.includes('id="tdj-global-clear-141"'), "Falta blindaje de limpieza global TDJ.");
assert(html.includes("e.stopImmediatePropagation();"), "El blindaje no bloquea listeners antiguos/cacheados.");
assert(html.includes('window.location.href="titulos.html?reinicio="+Date.now();'), "La limpieza global no fuerza un estado nuevo.");
assert(html.includes('js/tdj.js?v=16.33.141'), "Falta cache-busting v16.33.141.");
assert(!html.includes('js/tdj.js?v=16.33.123'), "Persisten referencias antiguas v16.33.123.");
assert(!html.includes('js/tdj.js?v=16.33.140'), "Persisten referencias antiguas v16.33.140.");

console.log("OK — regresión TDJ v16.33.141");
