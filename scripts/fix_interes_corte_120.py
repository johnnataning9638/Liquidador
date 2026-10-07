from pathlib import Path
import re

ROOT=Path('.')

APP=r'''function tablaInteresesPdf(x,r){
  const detallePago=Array.isArray(x?.interesesPorCuota)?x.interesesPorCuota:[];
  const detalleCorte=Array.isArray(r?.interesesPorCuota)?r.interesesPorCuota:[];
  const p=x?.pago||{};
  const esCorteInformativo=Number(p.valor||0)===0 && Boolean(fechaISO(p.fecha)) && !String(p.recibo||"").trim() && !String(p.tdj||"").trim();
  const filas=detallePago.length?detallePago:(esCorteInformativo?detalleCorte:[]);
  const interesDirecto=t=>Number(t?.interes??t?.valor??0);
  const interesAnidado=t=>{
    const grupos=[];
    if(Array.isArray(t?.tramos))grupos.push(...t.tramos);
    if(Array.isArray(t?.tramoInteres1))grupos.push(...t.tramoInteres1);
    if(Array.isArray(t?.tramoInteres2))grupos.push(...t.tramoInteres2);
    if(t?.tramoSuspension)grupos.push(t.tramoSuspension);
    return grupos.reduce((s,z)=>s+Math.max(0,Number(z?.valor??z?.interes??0)),0);
  };
  const capitalFila=t=>{
    const vtoRef=(r?.vencimientos||[]).find(v=>v?.id===t?.vto)||null;
    return Number(t?.capitalBase||t?.base||vtoRef?.saldo||vtoRef?.impuesto||0);
  };
  const interesesCalculados=filas.map(t=>{
    const directo=interesDirecto(t);
    if(directo>0)return directo;
    return esCorteInformativo?interesAnidado(t):0;
  });
  if(esCorteInformativo && filas.length && interesesCalculados.every(v=>v<=0)){
    const totalCorte=Math.max(0,Number(r?.intereses||0));
    if(totalCorte>0){
      const bases=filas.map(capitalFila);
      const baseTotal=bases.reduce((s,v)=>s+Math.max(0,v),0);
      if(filas.length===1)interesesCalculados[0]=totalCorte;
      else if(baseTotal>0)filas.forEach((_,i)=>{interesesCalculados[i]=totalCorte*(Math.max(0,bases[i])/baseTotal);});
    }
  }
  let rows="";
  if(filas.length){
    rows=filas.map((t,i)=>{
      const vtoRef=(r?.vencimientos||[]).find(v=>v?.id===t?.vto)||null;
      const cuota=t?.cuota??t?.vto??vtoRef?.numero??(i+1);
      const capital=capitalFila(t);
      const fechaVto=t?.fechaVencimiento||vtoRef?.fecha||"";
      const fechaPago=t?.fechaPago||p.fecha||(esCorteInformativo?r?.fechaCorte||"":"");
      const dias=Number(t?.dias||0);
      const tasa=t?.tasa!=null?((Number(t.tasa)*100).toFixed(3)+"%"):(x?.tasaVisible!=null?Number(x.tasaVisible).toFixed(3)+"%":"—");
      const interes=Number(interesesCalculados[i]||0);
      return `<tr><td>${escPdf(cuota)}</td><td>${dinero(capital)}</td><td>${escPdf(fechaVisible(fechaVto))}</td><td>${escPdf(fechaVisible(fechaPago))}</td><td>${dias}</td><td>${tasa}</td><td>${dinero(interes)}</td></tr>`;
    }).join("");
  }else{
    rows=(r?.vencimientos||[]).map(v=>`<tr><td>${escPdf(v?.numero||"")}</td><td>${dinero(0)}</td><td>${escPdf(fechaVisible(v?.fecha||""))}</td><td>${escPdf(fechaVisible(p.fecha||""))}</td><td>0</td><td>${x?.tasaVisible==null?"—":Number(x.tasaVisible).toFixed(3)+"%"}</td><td>${dinero(0)}</td></tr>`).join("");
  }
  const total=filas.length?interesesCalculados.reduce((s,v)=>s+Number(v||0),0):(esCorteInformativo?Number(r?.intereses||0):Number(x?.interesGenerado||0));
  return `<div class="pdf-intereses"><h3>CÁLCULO DE INTERESES POR CUOTA</h3><table><thead><tr><th>CUOTA</th><th>CAPITAL BASE</th><th>FECHA VENCIMIENTO</th><th>FECHA PAGO</th><th>DÍAS</th><th>TASA</th><th>INTERÉS</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="6">TOTAL INTERESES DEL PAGO</th><th>${dinero(total)}</th></tr></tfoot></table></div>`;
}
'''

TDJ=APP.replace('function tablaInteresesPdf(x,r){','function tablaInteresesPdfTDJ(x,r){',1).replace('<th>FECHA PAGO</th>','<th>FECHA PAGO / TDJ</th>',1)

def replace_function(path, pattern, replacement):
    p=ROOT/path
    s=p.read_text(encoding='utf-8')
    s2,n=re.subn(pattern,replacement,s,count=1)
    if n!=1: raise RuntimeError(f'No se encontró bloque en {path}: {n}')
    p.write_text(s2,encoding='utf-8')

replace_function('js/app.js',r'function tablaInteresesPdf\(x,r\)\{[\s\S]*?\n\}\n\n(?=function valorNominalPagoPdf)',APP+'\n')
replace_function('js/tdj.js',r'function tablaInteresesPdfTDJ\(x,r\)\{[\s\S]*?\n\}\n\n(?=function bloqueSuspensionInteresesPdfTDJ)',TDJ+'\n')

# Update only active source/version references, never historical RELEASES.
for p in ROOT.rglob('*'):
    if not p.is_file() or any(x in p.parts for x in {'.git','RELEASES','node_modules'}): continue
    if p.suffix.lower() not in {'.js','.html','.css','.yml','.yaml','.json','.mjs'}: continue
    try: s=p.read_text(encoding='utf-8')
    except UnicodeDecodeError: continue
    if '16.33.119' in s:
        p.write_text(s.replace('16.33.119','16.33.120'),encoding='utf-8')

# The audit must accept 16.33.120 and reject 16.33.119 as the active prior version.
a=ROOT/'.github/workflows/audit-estabilidad.yml'
s=a.read_text(encoding='utf-8')
s=s.replace('16.33.119','16.33.120')
s=s.replace('16\\.33\\.(110|111|112|113|114|115|116|117|118)','16\\.33\\.(110|111|112|113|114|115|116|117|118|119)')
a.write_text(s,encoding='utf-8')

print('PATCH_READY')
