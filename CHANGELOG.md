# Cambios

## 16.33.207 - 2026-10-19

- TDJ: para títulos con fecha futura sin TIM oficial parametrizada, el campo visual muestra el último porcentaje TIM conocido, claramente rotulado como REFERENCIA y con su mes de origen; nunca se presenta como porcentaje oficial de la fecha futura ni alimenta los cálculos.
- DIAN: alerta al intentar elegir artículos 9/10 para TDJ con fecha no permitida; se mantiene conversión automática a TASA DIAN.
- Sin cambios en motores de cálculo, proporciones, endoso ni elegibilidad de beneficios.


## 16.33.206 - 2026-10-19

- Extensión al Liquidador DIAN de la elegibilidad temporal de títulos identificados por TDJ Nº para artículos 9 y 10 Decreto 1419.
- Se reutilizan ventanas TDJ: hasta 09/08/2026 inclusive y del 17/09/2026 al 19/11/2026 inclusive.
- Fechas no elegibles convierten selección del título a TASA DIAN, reflejada en la UI y cálculo/exportación.
- Pagos ordinarios sin TDJ permanecen sujetos a sus reglas vigentes, independientes de esta actualización.
- Sin cambios en motores matemáticos compartidos ni reglas de proporcionalidad y endoso.


## 16.33.205 - 2026-10-19

- Exclusivamente TDJ: artículos 9 y 10 elegibles por constitución hasta 09/08/2026 (inclusive) o entre 17/09/2026 y 19/11/2026 (inclusive).
- TDJ del 10/08/2026 al 16/09/2026, o posteriores al 19/11/2026: aplicación TASA DIAN; los requisitos restantes siguen evaluándose por obligación.
- Sin alteraciones de cálculos compartidos DIAN, imputación cronológica, pago, sanción o endoso.
- Validaciones automáticas de límites, recuperación Excel y continuidad de casos históricos TDJ.


## 16.33.204 - 2026-10-19

- TDJ únicamente: conservar por separado el valor nominal utilizado por el motor y el valor efectivamente aplicado de cada título.
- Reconstruir cronológicamente el motor con los valores de origen para evitar saldo ficticio y endoso simultáneos en el caso Juanca (ART. 9, dos obligaciones y dos títulos).
- Mantener la imputación y trazabilidad efectiva; el importe de simulación no aumenta el monto aplicado ni el endoso.
- Regresión específica: reproducción del error de $1.337.000 y verificación de identidad de tasas, dos títulos y conservación de valor.


## 16.33.203 - 2026-10-19

- Exclusivamente TDJ: transmitir identidad explícita y tasa por título y obligación desde la captura al cálculo y a la recuperación XLSX.
- Registrar la aplicación parcial antes de detener el recorrido de una obligación; el siguiente título continúa sobre su saldo.
- Separar las simulaciones de prioridad de pagos del cursor global histórico compartido con DIAN.
- Conservar los cinco pagos reales del escenario probado, y usar solo el recurso necesario de los títulos.
- Mantener el cierre técnico existente hasta $1.000, documentar su cargo al remanente del título y reflejar el saldo cerrado en el resumen.
- Excel incorpora la matriz completa de tipos y tasas, incluso para combinaciones sin aplicación.
- Resumen PDF lee totales tanto en celdas TH como TD; los errores de cálculo invalidan resultados anteriores.
- Los archivos de motor compartidos, la fórmula de proporcionalidad y el módulo DIAN permanecen sin cambios.

Validación local: diez casos de integración TDJ, exportación XLSX binaria, regresión matemática existente (33 aserciones), sintaxis y controles de estabilidad. El diagnóstico histórico de conservación SIMPLE continúa fuera de este alcance y no se presenta como corregido.
