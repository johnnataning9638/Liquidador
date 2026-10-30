// Art. 48 parágrafo 2 Ley 2155/2021: IBC certificado SFC,
// modalidad consumo y ordinario. No altera TIM ni otros tratamientos manuales.
// Corte conservador: vencimiento exigible a 30/06/2021 como evidencia
// verificable de obligación existente (revisión jurídica sigue siendo necesaria).
const IBC_PUNTOS_BASICOS=Object.freeze({
  '2021-09':1719,'2021-10':1708,'2021-11':1727,'2021-12':1746,
  '2022-01':1766,'2022-02':1830,'2022-03':1847
});
export function tasaArt48Automatico(tipo,fechaPago,contexto={}){
  const t=String(tipo||'TASA DIAN').trim().toUpperCase();
  if(t!=='TASA DIAN'&&t!=='ART. 48 LEY 2155')return null;
  const fecha=String(fechaPago||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha<'2021-09-14'||fecha>'2022-03-31'||!(Number(contexto.valorPago)>0))return null;
  const puntos=IBC_PUNTOS_BASICOS[fecha.slice(0,7)];
  if(!puntos)return null;
  const vencimientos=contexto.fechaVencimiento?[{fecha:contexto.fechaVencimiento,impuesto:1}]:
    (contexto.vencimientos||[]).filter(v=>Number(v.impuesto??v.saldo??0)>0);
  const fechas=vencimientos.map(v=>String(v.fecha||'').slice(0,10)).filter(f=>/^\d{4}-\d{2}-\d{2}$/.test(f));
  if(!fechas.length)return null;
  const elegibles=fechas.filter(f=>f<='2021-06-30');
  if(!elegibles.length)return null;
  const porCuota=elegibles.length!==fechas.length;
  const tasa=puntos/10000;
  return {tasa:porCuota?null:tasa,porCuota,aplicacionAutomaticaArt48:true,
    nota:porCuota?'LEY 2155 DE 2021 ART. 48 PAR. 2 — IBC AUTOMÁTICO SOLO EN CUOTAS EXIGIBLES AL 30/06/2021; revisar elegibilidad y tasa por cuota.'
    :`LEY 2155 DE 2021 ART. 48 PAR. 2 — IBC AUTOMÁTICO: ${(tasa*100).toFixed(2)}% EA, pago ${fecha}; obligación exigible al 30/06/2021. Verificar requisitos de favorabilidad en cobro.`};
}
