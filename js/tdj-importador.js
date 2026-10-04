const normTextoTDJ = v => String(v ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[º°]/g, "")
  .replace(/\s+/g, " ").trim().toUpperCase();

function separarCeldasTDJ(linea) {
  const s = String(linea ?? "").replace(/\r/g, "").trim();
  if (!s) return [];
  if (s.includes("\t")) return s.split("\t").map(x => x.trim());
  return s.split(/\s{2,}/).map(x => x.trim()).filter(Boolean);
}

function digitosTDJ(v) {
  return String(v ?? "").replace(/\D/g, "");
}

export function esDocumentoFuenteTDJ(v) {
  const raw = String(v ?? "").trim();
  if (!raw || /[A-Za-z]/.test(raw)) return false;
  const d = digitosTDJ(raw);
  return /^\d{10,15}$/.test(d);
}

function normalizarDocumentoTDJ(v) {
  if (!esDocumentoFuenteTDJ(v)) return "";
  return digitosTDJ(v);
}

function normalizarFechaTDJ(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (!m) return "";
  let [, d, mo, y] = m;
  if (y.length === 2) y = Number(y) >= 70 ? `19${y}` : `20${y}`;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? "" : iso;
}

function normalizarValorTDJ(v) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const limpio = s.replace(/\$/g, "").replace(/\s/g, "");
  if (/^\d{1,3}(?:\.\d{3})+$/.test(limpio)) return Number(limpio.replace(/\./g, ""));
  if (/^\d{1,3}(?:,\d{3})+$/.test(limpio)) return Number(limpio.replace(/,/g, ""));
  if (/^\d+$/.test(limpio)) return Number(limpio);
  const n = Number(limpio.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function indiceCabeceraTDJ(headers, aliases) {
  const h = headers.map(normTextoTDJ);
  for (const alias of aliases) {
    const i = h.findIndex(x => x === normTextoTDJ(alias));
    if (i >= 0) return i;
  }
  return -1;
}

function encontrarDocTDJ(celdas) {
  for (const c of celdas) {
    const doc = normalizarDocumentoTDJ(c);
    if (doc) return doc;
  }
  return "";
}

function encontrarFechaTDJ(celdas) {
  for (const c of celdas) {
    const f = normalizarFechaTDJ(c);
    if (f) return f;
  }
  return "";
}

function encontrarValorTDJ(celdas, indiceDoc = -1, indiceFecha = -1) {
  // Sin encabezados confiables, tomar el ÚLTIMO valor numérico válido de la fila.
  // Así una columna REPETICIÓN=1 nunca se convierte en el VALOR del TDJ.
  for (let i = celdas.length - 1; i >= 0; i--) {
    if (i === indiceDoc || i === indiceFecha) continue;
    const c = String(celdas[i] ?? "").trim();
    if (!c || esDocumentoFuenteTDJ(c) || normalizarFechaTDJ(c)) continue;
    const n = normalizarValorTDJ(c);
    if (n > 0) return n;
  }
  return 0;
}

function filaTDJ(celdas, idxDoc = -1, idxFecha = -1, idxValor = -1) {
  if (!celdas.length) return null;
  const docPreferido = idxDoc >= 0 ? normalizarDocumentoTDJ(celdas[idxDoc]) : "";
  const doc = docPreferido || encontrarDocTDJ(celdas);
  if (!doc) return null;
  const fechaPreferida = idxFecha >= 0 ? normalizarFechaTDJ(celdas[idxFecha]) : "";
  const fecha = fechaPreferida || encontrarFechaTDJ(celdas);
  if (!fecha) return null;
  const valorPreferido = idxValor >= 0 && idxValor < celdas.length ? normalizarValorTDJ(celdas[idxValor]) : 0;
  const valor = valorPreferido > 0 ? valorPreferido : encontrarValorTDJ(celdas, idxDoc, idxFecha);
  if (!(valor > 0)) return null;
  return { tdj: doc, fecha, valor };
}

export function extraerRegistrosTDJTexto(texto) {
  const lineas = String(texto ?? "").replace(/\r/g, "").split("\n").filter(x => x.trim());
  if (!lineas.length) return [];
  const filas = lineas.map(separarCeldasTDJ).filter(Boolean);
  if (!filas.length) return [];

  const headerIndex = filas.findIndex(cells => {
    const h = cells.map(normTextoTDJ);
    return h.some(x => /DOCUMENTO FUENTE/.test(x)) && h.some(x => /FECHA PRESENTACION|FECHA DE PRESENTACION|FECHA/.test(x));
  });

  let idxDoc = -1, idxFecha = -1, idxValor = -1, inicio = 0;
  if (headerIndex >= 0) {
    const headers = filas[headerIndex];
    idxDoc = indiceCabeceraTDJ(headers, [
      "NO. DOCUMENTO FUENTE", "N° DOCUMENTO FUENTE", "NUMERO DOCUMENTO FUENTE", "NÚMERO DOCUMENTO FUENTE", "DOCUMENTO FUENTE"
    ]);
    idxFecha = indiceCabeceraTDJ(headers, [
      "FECHA PRESENTACION", "FECHA DE PRESENTACION", "FECHA PRESENTACIÓN", "FECHA DE PRESENTACIÓN", "FECHA"
    ]);
    idxValor = indiceCabeceraTDJ(headers, ["VALOR PAGADO", "VALOR PAGO", "VALOR"]);
    inicio = headerIndex + 1;
  }

  const out = [];
  const vistos = new Set();
  for (let r = inicio; r < filas.length; r++) {
    const item = filaTDJ(filas[r], idxDoc, idxFecha, idxValor);
    if (!item) continue;
    const key = `${item.tdj}|${item.fecha}|${item.valor}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push(item);
  }
  return out;
}
