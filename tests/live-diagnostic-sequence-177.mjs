import {chromium} from './browser-runtime.mjs';
const u='https://liquidador-de-obligaciones-tributarias.onrender.com/titulos.html?v=16.33.177';
const b=await chromium.launch({headless:true});const p=await b.newPage();try{await p.goto(u,{waitUntil:'networkidle',timeout:30000});const r=await p.evaluate(async()=>{const {MotorLiquidacion}=await import('./js/motor-liquidacion.js?v=16.33.161');const {ajustarTDJParaPagosPosteriores}=await import('./js/prioridad-tdj-v132.js?v=16.33.161');const motor=new MotorLiquidacion();const pagos=[
{id:'P1',numero:1,fecha:'2026-06-16',valor:15027000,tipo:'TASA DIAN'},
{id:'P2',numero:2,fecha:'2026-07-14',valor:5986000,tipo:'TASA DIAN'},
{id:'T1',numero:3,fecha:'2026-07-24',valor:500000,tipo:'TASA DIAN',tdj:'469030003386678',esTDJ:true},
{id:'T2',numero:4,fecha:'2026-07-24',valor:500000,tipo:'TASA DIAN',tdj:'46903000338669',esTDJ:true},
{id:'T3',numero:5,fecha:'2026-07-24',valor:15548000,tipo:'TASA DIAN',tdj:'469030003386680',esTDJ:true},
{id:'T4',numero:6,fecha:'2026-07-24',valor:10000000,tipo:'TASA DIAN',tdj:'469030003387674',esTDJ:true},
{id:'P3',numero:7,fecha:'2026-10-01',valor:8193000,tipo:'ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO'}];
const datos={nit:'901473152',razonSocial:'',anio:2025,concepto:'VENTAS',periodo:'3',tipoLiquidacion:'PRIVADA',fechaCorte:'2026-10-01',vencimientos:[{id:'V1',fecha:'2026-01-14',impuesto:40771000,periodo:'3'}],tieneSancion:'SI',valorSancion:524000,fechaSancion:'2026-06-16',fechaPresentacionDeclaracion1419:'2026-06-16',beneficioSancion:'SIN BENEFICIO',pagos};
const before=motor.calcular({...datos,pagos});const out=ajustarTDJParaPagosPosteriores(motor,datos,{soloTDJId:'T4'});const t4=out.pagos.find(x=>x.id==='T4');const after=motor.calcular(out);return {returnedValue:t4?.valor,baseTotal:before?.total,afterTotal:after?.total,normal:after?.detalle?.find(x=>x.pago?.id==='P3')?.excedente};});console.log('SEQUENCE DIAGNOSTIC 177',JSON.stringify(r,null,2));if(Number(r.returnedValue)!==0)throw new Error('PRIORIDAD 177 DEVUELVE TDJ4 '+r.returnedValue+'; esperado 0');console.log('SEQUENCE DIAGNOSTIC 177 OK')}finally{await b.close()}
