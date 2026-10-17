from pathlib import Path
import re

STYLE='''<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="[$$-es-CO] #,##0"/><numFmt numFmtId="165" formatCode="0.000%"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Arial"/><family val="2"/><color rgb="17324D"/></font><font><b/><sz val="14"/><name val="Arial"/><family val="2"/><color rgb="FFFFFF"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/><color rgb="17324D"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="DCEAF4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="173F5F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="A8BBC9"/></left><right style="thin"><color rgb="A8BBC9"/></right><top style="thin"><color rgb="A8BBC9"/></top><bottom style="thin"><color rgb="A8BBC9"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'''

def patch_sheet(path, fn, colfn, cellfn, crcfn):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    m=re.search(rf'function\s+{re.escape(fn)}\s*\(rows,\{{',s)
    if not m:
        raise RuntimeError(f'No se encontró la función {fn} en {path}')
    start=m.start()
    endm=re.search(rf'\n\nfunction\s+{re.escape(crcfn)}\b',s[start:])
    if not endm:
        raise RuntimeError(f'No se encontró el final de {fn} en {path}')
    end=start+endm.start()
    new=f'''function {fn}(rows,{{moneyCols=[],percentCols=[],rowMoneyCols={{}},rowPercentCols={{}},titleRows=[],headerRows=[],columnWidths=[],mergeRanges=[],landscape=true,fitToWidth=1,fitToHeight=0}}={{}}
  const safeRows=Array.isArray(rows)?rows:[];
  const lastCol=Math.max(1,...safeRows.map(r=>Array.isArray(r)?r.length:0));
  const lastRow=Math.max(1,safeRows.length);
  const dimension=`A1:${{{colfn}(lastCol)}}${{lastRow}}`;
  const body=safeRows.map((r,i)=>{{
    const row=Array.isArray(r)?r:[];
    const rm=Array.isArray(rowMoneyCols[i])?rowMoneyCols[i]:moneyCols;
    const rp=Array.isArray(rowPercentCols[i])?rowPercentCols[i]:percentCols;
    const title=titleRows.includes(i),header=headerRows.includes(i),height=title?24:(header?20:18);
    return `<row r="${{i+1}}" ht="${{height}}" customHeight="1">${{row.map((v,j)=>{{
      let style=0;
      if(title)style=1;
      else if(header)style=2;
      else if(rm.includes(j+1))style=3;
      else if(rp.includes(j+1))style=4;
      return {cellfn}(v,j+1,i+1,style);
    }}).join("")}}</row>`;
  }}).join("");
  const cols=Array.from({{length:lastCol}},(_,i)=>`<col min="${{i+1}}" max="${{i+1}}" width="${{Number(columnWidths[i]||16)}}" customWidth="1"/>`).join("");
  const autoMerges=titleRows.filter(i=>{{const row=safeRows[i]||[];return row.filter(v=>String(v??"").trim()!=="").length<=1;}}).map(i=>`A${{i+1}}:${{{colfn}(lastCol)}}${{i+1}}`);
  const allMerges=[...new Set([...(mergeRanges||[]),...autoMerges])];
  const merges=allMerges.map(x=>`<mergeCell ref="${{x}}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`+
    `<dimension ref="${{dimension}}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"/></sheetViews>`+
    `<sheetFormatPr defaultRowHeight="18"/><cols>${{cols}}</cols><sheetData>${{body}}</sheetData>`+
    (allMerges.length?`<mergeCells count="${{allMerges.length}}">${{merges}}</mergeCells>`:"")+`<printOptions gridLines="0" horizontalCentered="1"/>`+
    `<pageMargins left="0.28" right="0.28" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>`+
    `<pageSetup orientation="${{landscape?'landscape':'portrait'}}" paperSize="9" fitToWidth="${{fitToWidth}}" fitToHeight="${{fitToHeight}}"/></worksheet>`;
'''
    s=s[:start]+new+s[end:]
    s,n=re.subn(r'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">.*?</styleSheet>',STYLE,s,count=1,flags=re.S)
    if n!=1:
        raise RuntimeError(f'No se encontró styles.xml en {path}')
    p.write_text(s,encoding='utf-8')

patch_sheet('js/app.js','xlsxSheet','xlsxCol','xlsxCell','crc32')
patch_sheet('js/tdj-core-16.33.143.js','xlsxSheetTDJ','xlsxColTDJ','xlsxCellTDJ','crc32TDJ')

for name in ['js/app.js','js/tdj-core-16.33.143.js','js/tdj.js','js/prioridad-tdj-v132.js']:
    p=Path(name)
    s=p.read_text(encoding='utf-8')
    p.write_text(re.sub(r'\?v=16\.33\.\d+','?v=16.33.158',s),encoding='utf-8')

p=Path('liquidacion.html')
p.write_text(p.read_text(encoding='utf-8').replace('16.33.149','16.33.158'),encoding='utf-8')
p=Path('titulos.html')
p.write_text(p.read_text(encoding='utf-8').replace('16.33.157','16.33.158'),encoding='utf-8')

Path('tests/regresion-exportacion-excel-158.mjs').write_text('''import fs from "node:fs";
import assert from "node:assert/strict";
const app=fs.readFileSync("js/app.js","utf8");
const tdj=fs.readFileSync("js/tdj-core-16.33.143.js","utf8");
const html=fs.readFileSync("liquidacion.html","utf8");
const tit=fs.readFileSync("titulos.html","utf8");
assert.match(app,/showGridLines="0"/);
assert.match(app,/autoMerges=titleRows/);
assert.match(app,/defaultRowHeight="18"/);
assert.match(tdj,/showGridLines="0"/);
assert.match(tdj,/autoMerges=titleRows/);
assert.match(html,/app\\.js\\?v=16\\.33\\.158/);
assert.match(tit,/16\\.33\\.158/);
for(const h of ["Nº","TDJ Nº","RECIBO Nº","FECHA PAGO / CORTE","VALOR PAGO","TIPO","OBSERVACIÓN"])assert.ok(app.includes(h),`Falta encabezado normal ${h}`);
for(const h of ["Nº","TDJ","FECHA","VALOR ORIGINAL","OBSERVACIÓN"])assert.ok(tdj.includes(h),`Falta encabezado TDJ ${h}`);
console.log("REGRESION EXCEL 16.33.158 OK — solo presentación XLSX; estructura de datos intacta");
''',encoding='utf-8')
