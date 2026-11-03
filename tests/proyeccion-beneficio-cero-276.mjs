import assert from 'node:assert/strict';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
const cfg={uvt:[],ipc:[{anio:2025,inflacion:0.10}],intereses:[{desde:'2024-01-01',hasta:'2028-12-31',metodologia:'INTERES_SIMPLE_DIARIO',tasas:{'TASA DIAN':0.365}}],reglasObligaciones:[]};
const tipo='ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO';
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial]){
 const m=new Clase(cfg),datos={concepto:'RENTA',anio:2025,periodo:1,tipoLiquidacion:Clase===MotorLiquidacion?'PRIVADA':'OFICIAL',tieneSancion:'SI',valorSancion:100000,fechaSancion:'2025-01-01',vencimientos:[{id:'V',fecha:'2025-01-01',impuesto:1000000}],pagos:[{id:'Q',fecha:'2026-02-01',valor:0,tipo}]};
 const antes=JSON.stringify(datos),r=m.calcular(datos),q=r.proyeccionesBeneficio?.[0];
 assert.ok(q,'Fecha + beneficio + cero genera proyección');assert.equal(q.aplicado.total,0);assert.equal(q.excedente,0);assert.equal(q.tipo,tipo);assert.equal(q.fecha,'2026-02-01');
 assert.equal(q.impuesto,1000000);assert.equal(q.intereses,49000);assert.equal(q.sancion,Clase===MotorLiquidacion?15000:17000);assert.equal(q.total,q.impuesto+q.intereses+q.sancion);
 assert.equal(r.detalle.reduce((a,x)=>a+x.aplicado.total,0),0,'Ningún peso ni pago ficticio');
 const sinBeneficio=m.calcular({...datos,pagos:[],fechaCorte:'2026-02-01'});const {proyeccionesBeneficio,...contable}=r;assert.deepEqual(contable,sinBeneficio,'Consultar no reduce el saldo contable ni modifica las reglas de títulos');
 assert.equal(JSON.stringify(datos),antes,'Datos originales inmutables');
 // Paridad con la deuda antes de imputar un pago real: el efectivo no condiciona la vista.
 const referencia=m.calcular({...datos,pagos:[{...datos.pagos[0],valor:1}]}).detalle[0].deudaAntes;
 for(const k of ['impuesto','intereses','sancion'])assert.equal(q[k],referencia[k],k+': igual tratamiento del beneficio');
 const blanca=m.calcular({...datos,pagos:[{...datos.pagos[0],valor:''}]});assert.deepEqual(blanca.proyeccionesBeneficio,r.proyeccionesBeneficio,'Vacío equivale a cero');
 const varias=m.calcular({...datos,pagos:[...datos.pagos,{id:'Q2',fecha:'2026-03-01',valor:0,tipo}]});assert.equal(varias.proyeccionesBeneficio.length,2);assert.equal(varias.proyeccionesBeneficio[1].sancion,q.sancion,'No reducir otra vez por otra consulta');
 const efectivo=m.calcular({...datos,pagos:[{id:'P',fecha:'2026-01-01',valor:10000,tipo:'TASA DIAN'},...datos.pagos,{id:'FUTURO',fecha:'2026-03-01',valor:1000,tipo:'TASA DIAN'}]});
 const conPrevios=m.calcular({...datos,pagos:[{id:'P',fecha:'2026-01-01',valor:10000,tipo:'TASA DIAN'},{...datos.pagos[0],valor:1}]}).detalle.at(-1).deudaAntes;
 for(const k of ['impuesto','intereses','sancion'])assert.equal(efectivo.proyeccionesBeneficio[0][k],conPrevios[k],'Consulta respeta pagos anteriores y excluye posteriores');
 const invalida=m.calcular({...datos,pagos:[{fecha:'2026-02-01',valor:0,tipo:'ART. 1 DECRETO 688 DE 2020 - 50% INTERÉS CORRIENTE'}]});assert.equal(invalida.proyeccionesBeneficio[0].disponible,false,'No sustituir beneficio inválido por TASA DIAN');
 const desconocida=m.calcular({...datos,pagos:[{fecha:'2026-02-01',valor:0,tipo:'BENEFICIO NO REGISTRADO'}]});assert.equal(desconocida.proyeccionesBeneficio[0].disponible,false,'Beneficio desconocido permanece no disponible');
}
console.log('PROYECCIÓN 276 OK: privada/oficial, cero/vacío, impuesto/intereses/sanción, paridad, consultas independientes y saldo contable intacto');
