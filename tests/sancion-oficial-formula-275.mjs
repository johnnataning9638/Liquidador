import assert from 'node:assert/strict';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';

const ipc=[2023,2024,2025].map(anio=>({anio,inflacion:0.10}));
const cfg={uvt:[],ipc,reglasObligaciones:[],intereses:[]};
const motor=new MotorLiquidacionOficial(cfg);
// Valores independientes calculados con Python Decimal, precisión 60,
// ROUND_HALF_UP al millar, sin redondear IPC/365.
for(const [fecha,corte,dias,base,esperado] of [
 ['2025-12-15','2026-01-01',16,1000000,1004000],
 ['2025-12-15','2026-01-01',16,999450,1004000],
 ['2025-01-01','2026-01-01',364,1000000,1105000],
 ['2025-12-31','2026-01-01',0,1000000,1000000],
 ['2024-12-31','2026-01-01',365,1000000,1105000],
 ['2023-12-31','2025-01-01',366,100000000,110546000]
]){
 const r=motor.actualizarSancionOficial(base,fecha,corte);
 assert.equal(r.valor,esperado,fecha+' → '+corte);
 assert.equal(r.tramos.at(-1).dias,dias);
 assert.equal(r.tramos.at(-1).anioInflacion,Number(corte.slice(0,4))-1);
 assert.equal(r.tramos.at(-1).desde,corte,'Conservar fecha efectiva de aplicación');
}
assert.equal(motor.actualizarSancionOficial(1000000,'2025-12-15','2025-12-31').valor,1000000,'No actualizar antes del cambio de año');
assert.equal(motor.actualizarSancionOficial(1000000,'2025-12-15','2026-06-30').valor,1004000,'No capitalizar de nuevo durante el mismo año');
const excl=motor.actualizarSancionOficial(1004000,'2025-12-15','2026-06-30',{aniosAplicados:[2026]});
assert.equal(excl.valor,1004000);assert.equal(excl.tramos.length,0);
const faltante=new MotorLiquidacionOficial({ipc:[]}).actualizarSancionOficial(1000000,'2025-12-15','2026-01-01');
assert.equal(faltante.valor,1000000);assert.equal(faltante.tramos[0].disponible,false);assert.equal(faltante.advertencias.length,1);

const datos={concepto:'RENTA',anio:2025,periodo:1,tipoLiquidacion:'OFICIAL',tieneSancion:'SI',valorSancion:1000000,fechaSancion:'2025-12-15',vencimientos:[],pagos:[{fecha:'2026-06-30',valor:0}]};
const sin=motor.calcular(datos);
assert.equal(sin.sancion,1004000);assert.equal(sin.impuesto,0);assert.equal(sin.intereses,0);
assert.equal(sin.sancionActualizacion.tramos[0].dias,16);
const con=motor.calcular({...datos,pagos:[{fecha:'2026-01-02',valor:10000,tipo:'TASA DIAN'},{fecha:'2026-02-02',valor:20000,tipo:'TASA DIAN'},...datos.pagos]});
assert.equal(con.sancion,974000,'Descontar pagos sin repetir actualización anual');
assert.equal(con.detalle[0].actualizacionSancion.tramos[0].dias,16,'Conservar días reales en detalle de pago');
assert.equal(con.detalle[1].actualizacionSancion.tramos.length,0);
assert.equal(con.total+con.detalle.reduce((s,d)=>s+d.aplicado.sancion,0),sin.total,'Conservación de sanción');
for(const cambio of [{fechaAutoAdmisorio:'2023-01-01',fechaProvidenciaDefinitiva:'2025-12-01'},{fechaAutoAdmisorio:'2025-01-01',fechaProvidenciaDefinitiva:'2026-01-01'}]){
 assert.equal(motor.calcular({...datos,...cambio}).sancion,sin.sancion,'Auto y providencia no cambian fecha base');
}
const privado=new MotorLiquidacion(cfg).calcular({...datos,tipoLiquidacion:'PRIVADA'});
assert.equal(privado.sancion,1000000,'Privada conserva espera de un año y fórmula existente');
console.log('OFICIAL 275 OK: fórmula exacta, primer tramo, 365/366 días, cortes, pagos, sin duplicados, IPC faltante y fechas conservadas');
