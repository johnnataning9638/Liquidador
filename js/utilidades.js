export function truncarValorEntero(v){const n=Number(v||0);return Number.isFinite(n)?Math.trunc(n):0;}
export function dinero(v){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Math.round(Number(v||0)));}
export function numeroDesdeTexto(v){
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  let s=String(v??"").trim().replace(/\s/g,"").replace(/\$/g,"");
  if(!s)return 0;
  // Acepta valores COP tanto con separador de miles por punto como por coma:
  // 1.688.000 / 1,688,000 / $1.688.000 / $1,688,000.
  // Si hay varios separadores iguales, se interpretan como miles.
  if(/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  else if(/^[-+]?\d{1,3}(?:,\d{3})+$/.test(s))s=s.replace(/,/g,"");
  else if(s.includes(".")&&s.includes(",")){
    // Acepta ambos estilos cuando vienen desde Excel/portales: 3,471,000.00
    // (miles con coma y decimal con punto) y 3.471.000,00 (miles con punto
    // y decimal con coma). La posición del último separador determina el
    // decimal cuando el patrón de miles del otro separador es válido.
    if(/^[-+]?\d{1,3}(?:,\d{3})+\.\d+$/.test(s))s=s.replace(/,/g,"");
    else if(/^[-+]?\d{1,3}(?:\.\d{3})+,\d+$/.test(s))s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/\./g,"").replace(",",".");
  }
  else if(s.includes(",")){
    const partes=s.split(",");
    // Una sola coma seguida de tres dígitos es normalmente separador de miles
    // en los valores copiados de Excel/portales colombianos.
    if(partes.length===2&&/^\d{3}$/.test(partes[1]))s=partes[0]+partes[1];
    else s=s.replace(/,/g,".");
  }
  const n=Number(s);
  return Number.isFinite(n)?n:0;
}
export function fechaISO(v){if(v===null||v===undefined)return "";if(v instanceof Date&&!isNaN(v.getTime()))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;let s=String(v).trim();if(!s)return "";s=s.replace(/\s+/g,"/");let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m){const y=+m[1],mo=+m[2],d=+m[3];return fechaValida(y,mo,d)?`${m[1]}-${m[2]}-${m[3]}`:"";}m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);if(m){const d=+m[1],mo=+m[2],yy=m[3],y=yy.length===2?2000+Number(yy):Number(yy);return fechaValida(y,mo,d)?`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`:"";}m=s.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/);if(m){const d=+m[1],mo=+m[2],yy=m[3],y=yy.length===2?2000+Number(yy):Number(yy);return fechaValida(y,mo,d)?`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`:"";}m=s.match(/^(\d{4})(\d{2})(\d{2})$/);if(m){const y=+m[1],mo=+m[2],d=+m[3];return fechaValida(y,mo,d)?`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`:"";}return "";}
function fechaValida(y,mo,d){if(y<1900||y>2100||mo<1||mo>12||d<1||d>31)return false;const x=new Date(y,mo-1,d);return x.getFullYear()===y&&x.getMonth()===mo-1&&x.getDate()===d;}
export function fechaVisible(v){const iso=fechaISO(v);if(!iso)return "";const [y,m,d]=iso.split("-");return `${d}/${m}/${y}`;}
export function diasEntre(a,b){const x=new Date(a+"T00:00:00"),y=new Date(b+"T00:00:00");if(isNaN(x)||isNaN(y))return 0;return Math.max(0,Math.round((y-x)/86400000));}
export function roundMil(v){return Math.round(Number(v||0)/1000)*1000;}
export function roundupMil(v){return Math.ceil(Number(v||0)/1000)*1000;}

// CORRECCIÓN DE IMPRESIÓN PDF — no modifica cálculos ni datos.
// El exportador abre una ventana dinámica y llama a print() muy pronto en
// algunos navegadores. Eso puede mostrar una hoja/PDF completamente blanco.
// Se intercepta únicamente la ventana del Liquidador normal, se deja que el
// exportador termine de escribir el documento y se imprime cuando ya existe
// contenido real en el body.
if(typeof window!=="undefined" && /liquidacion\.html$/i.test(window.location.pathname||"" ) && !window.__pdfPrintGuardInstalled){
  window.__pdfPrintGuardInstalled=true;
  const abrirNativo=window.open.bind(window);
  window.open=function(...args){
    const win=abrirNativo(...args);
    if(!win)return win;
    const printNativo=typeof win.print==="function"?win.print.bind(win):null;
    // El exportador original programa su propio print() a los 700 ms. Lo
    // neutralizamos para evitar una impresión prematura y hacemos una sola
    // impresión controlada cuando el documento ya tiene contenido.
    if(printNativo){
      try{win.print=()=>{};}catch{}
    }
    let intentos=0;
    const imprimirCuandoListo=()=>{
      intentos++;
      let listo=false;
      try{
        const body=win.document?.body;
        const html=String(body?.innerHTML||"").trim();
        listo=Boolean(body&&html.length>500&&body.scrollHeight>0);
      }catch{}
      if(listo||intentos>=20){
        try{win.focus();}catch{}
        try{if(printNativo)printNativo();}catch(e){console.error("No fue posible imprimir el soporte PDF",e);}
        return;
      }
      setTimeout(imprimirCuandoListo,150);
    };
    setTimeout(imprimirCuandoListo,900);
    return win;
  };
}
