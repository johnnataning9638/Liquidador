# Cambios

## 16.33.232 - 2026-10-22 (propuesta)

- TDJ: ruta opcional de recibos compartidos para documentos identificados explícitamente como una misma obligación DIAN privada ordinaria de dos cuotas. Primero cancela documentos cubiertos y luego calcula una proporción conjunta y distribuye por vencimiento/documento.
- Mantiene los motores privados/oficiales y sus fórmulas sin cambios. Sin identificación documental se conserva la ruta anterior. SIMPLE, beneficios y títulos judiciales quedan fuera de la nueva ruta; una combinación no admitida se informa y no se reclasifica silenciosamente.
- Conserva identidad y trazabilidad en Excel y PDF. La prueba AINNEX reproduce los cuatro pagos y los saldos de impuesto $196.999.000 y sanción $18.592.000.
- Preparado para revisión en rama separada. No desplegado en producción.

## 16.33.210 - 2026-10-20

- Exclusivamente TDJ: la tabla visual de tasas de cada título/obligación usa la misma información efectiva del motor, inicialmente JSON local y después las tasas sincronizadas desde Supabase.
- Se elimina el fetch independiente del JSON en el componente visual, origen de porcentajes desactualizados con títulos de octubre y beneficios derivados.
- Al importar títulos pegados se mantiene por defecto TASA DIAN en todas las obligaciones y el funcionario puede elegir individualmente otro tratamiento; la importación de Excel recupera las selecciones existentes.
- Si faltan tasas realmente, se conserva la advertencia de dato no parametrizado sin fabricar porcentajes. No se alteran motores matemáticos, pagos, endoso ni exportaciones.


## 16.33.209 - 2026-10-19

- TDJ: presentar mensaje idéntico al aviso del Liquidador DIAN cuando se intenten artículos 9 o 10 sobre títulos con fecha no permitida, tanto al cambiar el beneficio como al editar la fecha.
- TDJ: proteger exclusivamente el campo «PEGUE DATOS DE TDJ / TÍTULOS» frente a eventos de pegado duplicados; conservar exactamente los registros y respetar texto/cursor seleccionados.
- Importadores normales/IA, motores matemáticos, pagos, beneficios y endosos sin alteraciones funcionales.
- Regresiones automáticas del cuadro de pegado (cinco títulos, dobles eventos, pegado legítimo repetido, aislamiento de otros campos) y del mensaje.


## 16.33.208 - 2026-10-19

- TDJ: homologación del mensaje explicativo cuando se seleccionan los artículos 9 o 10 con fecha de constitución no autorizada. Continúa la selección automática TASA DIAN.
- TDJ: corrección aislada del cálculo proporcional sobre sanción reducida por artículo 9 cuando los títulos preceden a la fecha de sanción: el motor TDJ debe considerar el saldo efectivo reducido y no una sanción nominal antigua al asignar un título.
- TDJ: preservar íntegros los pagos normales, imputar sucesivamente los títulos en las obligaciones registradas, evitar remanentes ficticios con deuda y mantener conservación nominal del título.
- Pruebas reproducibles: tres obligaciones, pagos intercalados, dos títulos de fechas diferentes/iguales, cuatro títulos y tratamientos mixtos artículo 9 / TASA DIAN con parámetros TIM/UVT reales.
- Motores matemáticos compartidos, módulo DIAN y reglas de beneficios/fechas sin modificaciones.


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

