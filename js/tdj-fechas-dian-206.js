// Misma ventana compartida con TDJ, aplicada exclusivamente a filas con TDJ Nº.
import {esBeneficio1419TDJ,fechaElegible1419TDJ,tasaEfectiva1419TDJ} from './tdj-tasas-203.js?v=16.33.206';
export function esTituloDian(p){return Boolean(String(p?.tdj||'').trim());}
export function tipoEfectivoTituloDian(p){
  const tipo=String(p?.tipo||'TASA DIAN').trim().toUpperCase()||'TASA DIAN';
  return esTituloDian(p)?tasaEfectiva1419TDJ(tipo,p?.fecha):tipo;
}
export function ajustarBeneficioTituloDian(p){
  if(!p||!esTituloDian(p)||!esBeneficio1419TDJ(p.tipo)||!p.fecha)return false;
  if(fechaElegible1419TDJ(p.fecha))return false;
  p.tipo='TASA DIAN';
  return true;
}
export function filtrarReglasFechaTitulo1419(errores,esTitulo){
  if(!esTitulo)return errores;
  // Solo reemplazar la regla temporal de constitución, no otros requisitos.
  return errores.filter(x=>!/artículo 9 admite títulos|título debe constituirse durante la vigencia|registre la fecha de constitución del título/i.test(x));
}
