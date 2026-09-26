export const DECRETO_1419 = Object.freeze({
  inicioVigencia: "2026-09-17",
  finVigencia: "2026-11-19",
  fechaCorteObligacion: "2026-08-10",
  fechaCorteTituloExclusiva: "2026-08-10"
});

export const TIPO_1419 = Object.freeze({
  ART9: "ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO",
  ART10_OMISO: "ART. 10 DECRETO 1419 DE 2026 - OMISAS TRIBUTARIAS",
  ART10_CORRECCION: "ART. 10 DECRETO 1419 DE 2026 - CORRECCIONES TRIBUTARIAS"
});

export function esTipoDecreto1419(tipo) {
  return String(tipo || "").toUpperCase().includes("DECRETO 1419 DE 2026");
}

export function esArticulo9_1419(tipo) {
  return String(tipo || "").toUpperCase().includes("ART. 9 DECRETO 1419");
}

export function esArticulo10Omiso1419(tipo) {
  const t = String(tipo || "").toUpperCase();
  return t.includes("ART. 10 DECRETO 1419") && t.includes("OMIS");
}

export function esArticulo10Correccion1419(tipo) {
  const t = String(tipo || "").toUpperCase();
  return t.includes("ART. 10 DECRETO 1419") && t.includes("CORRECC");
}

export function validarSeleccion1419({
  tipo,
  fechasVencimiento = [],
  fechaPresentacion = "",
  fechaDeclaracionOriginal = "",
  fechaPago = "",
  fechaTitulo = "",
  esTitulo = false
} = {}) {
  if (!esTipoDecreto1419(tipo)) return [];
  const errores = [];
  const vencimientos = fechasVencimiento.filter(Boolean).map(String);
  const tieneVencidaAlCorte = vencimientos.some(f => f <= DECRETO_1419.fechaCorteObligacion);
  const todasVencidasAlCorte = vencimientos.length > 0 && vencimientos.every(f => f <= DECRETO_1419.fechaCorteObligacion);

  if ((esArticulo9_1419(tipo) || esArticulo10Omiso1419(tipo)) && !tieneVencidaAlCorte) {
    errores.push("La obligación no tiene vencimiento en mora al 10/08/2026.");
  }
  if (esArticulo10Omiso1419(tipo) && !todasVencidasAlCorte) {
    errores.push("Para el artículo 10, la fecha de vencimiento para declarar debe ser el 10/08/2026 o anterior.");
  }

  if (esArticulo9_1419(tipo)) {
    if (esTitulo) {
      if (!fechaTitulo) errores.push("Registre la fecha de constitución del título.");
      else if (fechaTitulo >= DECRETO_1419.fechaCorteTituloExclusiva) {
        errores.push("El artículo 9 admite títulos constituidos antes del 10/08/2026; el título debe tener fecha anterior a ese día.");
      }
    } else if (!fechaPago || fechaPago < DECRETO_1419.inicioVigencia || fechaPago > DECRETO_1419.finVigencia) {
      errores.push("El pago del artículo 9 debe tener fecha entre el 17/09/2026 y el 19/11/2026.");
    }
  }

  if (esArticulo10Omiso1419(tipo)) {
    if (!fechaPresentacion) errores.push("Registre la fecha de presentación de la declaración omitida.");
    else if (fechaPresentacion > DECRETO_1419.finVigencia) errores.push("La declaración omitida se presentó después del 19/11/2026; no cumple el plazo del artículo 10.");
    else if (vencimientos.length && fechaPresentacion <= vencimientos.sort().at(-1)) errores.push("La fecha de presentación no es posterior al vencimiento; el caso no corresponde a una declaración omitida.");
    if (esTitulo) {
      if (!fechaTitulo || fechaTitulo < DECRETO_1419.inicioVigencia || fechaTitulo > DECRETO_1419.finVigencia) {
        errores.push("Para el artículo 10, el título debe constituirse durante la vigencia del beneficio: 17/09/2026 a 19/11/2026.");
      }
    } else if (!fechaPago || fechaPago < DECRETO_1419.inicioVigencia || fechaPago > DECRETO_1419.finVigencia) {
      errores.push("El pago del artículo 10 debe tener fecha entre el 17/09/2026 y el 19/11/2026.");
    }
  }

  if (esArticulo10Correccion1419(tipo)) {
    if (!fechaDeclaracionOriginal) errores.push("Registre la fecha de presentación de la declaración original que se corrige.");
    else if (fechaDeclaracionOriginal > DECRETO_1419.fechaCorteObligacion) errores.push("La declaración original debe haberse presentado a más tardar el 10/08/2026.");
    if (!fechaPresentacion) errores.push("Registre la fecha de presentación de la corrección.");
    else if (fechaPresentacion > DECRETO_1419.finVigencia) errores.push("La corrección se presentó después del 19/11/2026; no cumple el plazo del artículo 10.");
    else if (fechaDeclaracionOriginal && fechaPresentacion <= fechaDeclaracionOriginal) errores.push("La fecha de presentación de la corrección debe ser posterior a la declaración original.");
    if (esTitulo) {
      if (!fechaTitulo || fechaTitulo < DECRETO_1419.inicioVigencia || fechaTitulo > DECRETO_1419.finVigencia) {
        errores.push("Para el artículo 10, el título debe constituirse durante la vigencia del beneficio: 17/09/2026 a 19/11/2026.");
      }
    } else if (!fechaPago || fechaPago < DECRETO_1419.inicioVigencia || fechaPago > DECRETO_1419.finVigencia) {
      errores.push("El pago del artículo 10 debe tener fecha entre el 17/09/2026 y el 19/11/2026.");
    }
  }
  return errores;
}
