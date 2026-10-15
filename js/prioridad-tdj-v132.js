// CAPA DE IDEMPOTENCIA TDJ — v16.33.132
//
// La lógica de prioridad económica permanece en prioridad-tdj.js v16.33.131.
// Esta capa reinicia exclusivamente el estado de secuencia al iniciar una
// liquidación completa. Así, pulsar CALCULAR LIQUIDACIÓN repetidamente con
// los mismos datos produce exactamente el mismo resultado.
//
// Cuando el módulo es invocado con soloTDJId se conserva la secuencia interna,
// porque esa ruta puede formar parte de un procesamiento cronológico por título.
import {
  ajustarTDJParaPagosPosteriores as ajustarBase,
  ordenarMovimientosCronologicos,
  reiniciarSecuenciaTDJ
} from "./prioridad-tdj.js?v=16.33.131";

export function ajustarTDJParaPagosPosteriores(motor,datos,opciones={}){
  if(!opciones?.soloTDJId) reiniciarSecuenciaTDJ();
  return ajustarBase(motor,datos,opciones);
}

export {ordenarMovimientosCronologicos};
export {reiniciarSecuenciaTDJ};
