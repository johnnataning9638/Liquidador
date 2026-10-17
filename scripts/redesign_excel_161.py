from pathlib import Path

FILES = [Path('js/app.js'), Path('js/tdj-core-16.33.143.js')]
VERSION_FILES = [Path('js/app.js'), Path('js/tdj-core-16.33.143.js'), Path('js/tdj.js'), Path('js/prioridad-tdj-v132.js'), Path('liquidacion.html'), Path('titulos.html')]
TEST_FILES = [Path('tests/regresion-parametros-160.mjs'), Path('tests/regresion-exportacion-excel-158.mjs')]
OLD_WIDTH = 'const cols=Array.from({length:lastCol},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${Number(columnWidths[i]||16)}" customWidth="1"/>`).join("");'
NEW_WIDTH = '''const valueCols=new Set([
    ...moneyCols,
    ...percentCols,
    ...Object.values(rowMoneyCols||{}).flatMap(v=>Array.isArray(v)?v:[]),
    ...Object.values(rowPercentCols||{}).flatMap(v=>Array.isArray(v)?v:[])
  ].map(Number));
  const excelWidths=Array.from({length:lastCol},(_,i)=>Math.max(10,Number(columnWidths[i]||16)+(valueCols.has(i+1)?4:0)));
  const cols=excelWidths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join("");'''
OLD_HEIGHT = 'const title=titleRows.includes(i),header=headerRows.includes(i),height=title?24:(header?20:18);'
NEW_HEIGHT = '''const title=titleRows.includes(i),header=headerRows.includes(i);
    const maxLines=Math.max(1,...row.map((v,j)=>{
      const texto=String(v??"");
      const ancho=Math.max(10,excelWidths[j]||16);
      const caracteresPorLinea=Math.max(8,Math.floor(ancho*1.05));
      return Math.ceil(Math.max(1,texto.length)/caracteresPorLinea);
    }));
    const height=title?24:(header?Math.min(45,Math.max(20,18+(maxLines-1)*9)):Math.min(60,Math.max(18,18+(maxLines-1)*12)));'''

for path in FILES:
    s = path.read_text(encoding='utf-8')
    if OLD_WIDTH not in s:
        raise SystemExit(f'No se encontró bloque de anchos en {path}')
    if OLD_HEIGHT not in s:
        raise SystemExit(f'No se encontró bloque de altura en {path}')
    s = s.replace(OLD_WIDTH, NEW_WIDTH, 1)
    s = s.replace(OLD_HEIGHT, NEW_HEIGHT, 1)
    s = s.replace('v=16.33.160', 'v=16.33.161')
    path.write_text(s, encoding='utf-8')

for path in VERSION_FILES:
    s = path.read_text(encoding='utf-8').replace('v=16.33.160', 'v=16.33.161')
    path.write_text(s, encoding='utf-8')

for path in TEST_FILES:
    s = path.read_text(encoding='utf-8').replace('16.33.160', '16.33.161')
    path.write_text(s, encoding='utf-8')

print('AJUSTE EXCEL 16.33.161 APLICADO: columnas de valores +4 y alturas adaptativas. Solo presentación XLSX.')
