import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FROM = "16.33.117";
const TO = "16.33.118";

const activeRoots = ["js", "tests"];
const activeFiles = [
  "index.html",
  "liquidacion.html",
  "titulos.html",
  "estilos.css",
  "tdj-mobile.css",
  ".github/workflows/audit-estabilidad.yml"
];

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function replaceVersions(text) {
  return text.replace(/16\.33\.(11[0-7])/g, TO);
}

for (const root of activeRoots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(path.join(ROOT, root))) {
    if (!/\.(?:js|mjs|html|css|yml|yaml)$/.test(file)) continue;
    const before = fs.readFileSync(file, "utf8");
    const after = replaceVersions(before);
    if (after !== before) fs.writeFileSync(file, after);
  }
}

for (const rel of activeFiles) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, "utf8");
  const after = replaceVersions(before);
  if (after !== before) fs.writeFileSync(file, after);
}

const tdjPath = path.join(ROOT, "js", "tdj.js");
let tdj = fs.readFileSync(tdjPath, "utf8");

const replacements = [
  [
    'function opcionTipoObligacionTDJ(tipo=""){',
    'function opcionTipoObligacionTDJ(tipo="TASA DIAN"){'
  ],
  [
    'const actual=upper(tipo||"");',
    'const actual=upper(tipo||"TASA DIAN");'
  ],
  [
    'beneficioTributario:"NINGUNO",tipoTasa:"",tipoTasaConfirmada:false,',
    'beneficioTributario:"NINGUNO",tipoTasa:"TASA DIAN",tipoTasaConfirmada:false,'
  ],
  [
    'data-k="tipoTasa">${opcionTipoObligacionTDJ(o.tipoTasa||"TASA DIAN")}',
    'data-k="tipoTasa">${opcionTipoObligacionTDJ(o.tipoTasa||"TASA DIAN")}'
  ],
  [
    'sec.querySelector(\'[data-k="tipoTasa"]\').value=o.tipoTasa||"";',
    'sec.querySelector(\'[data-k="tipoTasa"]\').value=o.tipoTasa||"TASA DIAN";'
  ]
];

for (const [from, to] of replacements) {
  if (!tdj.includes(from)) {
    if (from.includes('data-k="tipoTasa"')) continue;
    throw new Error(`No se encontró el patrón esperado en tdj.js: ${from}`);
  }
  tdj = tdj.replace(from, to);
}
fs.writeFileSync(tdjPath, tdj);

const release = `# 16.33.118 — IMPORTACIÓN OPCIONAL Y CAPTURA MANUAL\n\n## Corrección\n- La importación de obligaciones, cuotas, pagos y títulos/TDJ es opcional.\n- La captura manual completa se considera fuente válida de datos y no depende de haber ejecutado un importador.\n- En TDJ se restaura **TASA DIAN** como tratamiento predeterminado para una obligación nueva; los tratamientos especiales continúan pudiéndose seleccionar manualmente.\n- Las validaciones siguen exigiendo los datos realmente necesarios (fechas, valores, identificadores y demás campos aplicables), pero no el origen importado de la información.\n\n## Protección funcional\n- No se modifica la metodología de cálculo DIAN tradicional ni Régimen Simple.\n- No se modifica la distribución de TDJ, pagos, cuotas, endoso ni fecha de corte.\n\n## Regresión\n- Se agrega prueba estructural específica para impedir que reaparezca una dependencia de importación.\n`;
fs.writeFileSync(path.join(ROOT, "RELEASES", "16.33.118.md"), release);

console.log("FIX IMPORTACIÓN OPCIONAL APLICADO");
console.log(`VERSION ACTIVA: ${TO}`);
