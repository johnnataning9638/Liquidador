## 16.33.263 — 2026-10-28

- Histórico oficial de sanción mínima ampliado de 21 a 39 años (1988–2026), con los 21 importes previos idénticos y sin inventar UVT anteriores a 2006.
- Tabla central `uvt_liquidador` con trazabilidad, restricciones de integridad, lectura pública de años vigentes e inserción exclusiva del servidor. DIAN y TDJ consultan la misma fuente con respaldo local y caché de parámetros verificados.
- Actualizador anual DIAN: precarga de diciembre, primeros diez días hábiles de enero, festivos colombianos y reintentos si falta el año. No sobrescribe históricos ni aplica años futuros antes del 1 de enero.
- Mantener cron de las 05:00 Colombia y ejecución independiente de TIM/IPC/UVT; incorporar autenticación interna del programador y registro UVT. No cambian los motores ni las reglas de liquidación.
- Probar histórico, redondeo, vigencias, caídas de fuentes, futura UVT sin despliegue, permisos, UI/PDF/XLSX y recuperación.

## 16.33.262 — 2026-10-28

- Sincronizar la versión visible de DIAN y TDJ, la guardia de URL y la acción de reinicio TDJ con los recursos publicados. Estos indicadores aún conservaban 16.33.259.
- Agregar regresión que exige coincidencia entre `version.json`, el pie de página y la versión de URL después de cargar cada módulo.
- Conservar las sanciones mínimas DIAN corregidas en 261 y todos los cálculos.

## 16.33.261 — 2026-10-28

- Corregir sanción mínima de 2006 a $201.000; 2011 a $251.000; 2012 a $260.000; 2013 a $268.000; 2020 a $356.000; 2021 a $363.000; 2022 a $380.000 y 2023 a $424.000.
- Conservar los otros 13 años y los valores UVT. DIAN y TDJ consumen la misma tabla `datos/uvt.json`; no cambian fórmulas, beneficios, tasas ni IPC.
- Documentar fuentes oficiales y agregar regresión de los 21 años, motores privado/oficial, interfaz y límites del beneficio.

## 16.33.260 — 2026-10-28

- Art. 4 del Decreto 0240/2026: en régimen ordinario se habilita la sanción en proporcionalidad únicamente cuando el pago sea posterior al vencimiento de una cuota con impuesto.
- Se conserva régimen simple sin cambios de lógica, así como los demás beneficios; se sincronizan las rutas de carga de DIAN y TDJ.
- Pendiente: validar pruebas integrales y despliegue de producción antes de publicar.

## 16.33.255 — 2026-10-27

- TDJ: soporte completo de solo sanción sin pagos con la misma plantilla y estilos de DIAN; pantalla y PDF.
- Mostrar desglose de intereses, detalle IPC/actualización, saldos y condición sin pagos antes del resumen TDJ habitual.
- DIAN, motores, fórmulas y Excel intactos; pruebas de paridad y alcance exclusivo, recuperación y casos con movimientos.

## 16.33.254 — 2026-10-27

- Corregir captura manual de solo sanción con cuotas completamente vacías y sin fecha en DIAN/TDJ.
- Validar sanción por su propio valor/fecha; aplicar pagos y títulos sin cuota ficticia.
- Importar Excel sin cuotas elimina capital previo del formulario; conservar corte y actualización vigente.
- Pruebas del formulario nuevo, caso RENTA 2022/sanción 2.500.000 del 01/01/2023, privada/oficial, PDF y round-trip XLSX.

## 16.33.253 — 2026-10-27

- DIAN y TDJ: permitir cuotas de capital cero o vacío cuando existe sanción; mantener intereses de capital en cero.
- Conservar fechas de corte sin valor en la cronología de pagos y títulos, incluyendo recuperación Excel.
- Cierre posterior al último pago en motor oficial con sus reglas existentes; sin cambio en proporcionalidad ni beneficios.
- Pruebas de sanción privada/oficial, IPC, movimientos mezclados, corte cronológico, PDF y Excel.

## 16.33.252 — 2026-10-26
- TDJ: conservar fechas de corte con valor cero, sin recibo ni TDJ, al importar el Excel DIAN.
- Conservar el corte durante el cálculo sin títulos reales y generar la liquidación PDF sin movimientos antes del resumen, incluso usando la fecha calculada cuando no hay corte explícito.
- Corregir escala porcentual de la tasa en el encabezado de proyección y etiquetar sus intereses como intereses a fecha de corte.
- Motores, cálculo DIAN, distribución de pagos/títulos y endosos intactos. Sin cambios de Supabase ni dependencias.
- Reproducido con Excel del usuario: antes solo dos resúmenes; después liquidación detallada, corte conservado y coherencia UI/PDF/XLSX.
- 37 controles locales aprobados. Chromium: caso del usuario y sintético con corte anterior/sin corte, más seis suites de regresión DIAN/TDJ.

## 16.33.251 — 2026-10-26
- PDF DIAN sin pagos: eliminar referencia a `x` inexistente al presentar tasas; corrige alerta y vista previa vacía.
- Sin cambios en motores, importadores, Excel, parámetros ni Supabase; franja verde conservada.
- Regresión específica privada/oficial, tasas múltiples/nulas y comprobación de resultados intactos.
- 36 controles CI locales aprobados y pruebas Chromium: PDF sin pagos privada/oficial, coherencia UI/PDF/XLSX y regresión de pagos/reimportación DIAN/TDJ.
- Actualizados hashes y controles históricos para admitir únicamente la franja verde ya autorizada y esta corrección; motores intactos frente a 16.33.250.

# 16.33.249

- TDJ: generar siempre el resumen final y la consolidacion de pagos, aunque no haya titulos ni movimientos. Conservar el formato de cierre y las tablas de actualizacion y reduccion de sancion.
- Mostrar saldo y sancion del resultado ya calculado; preservar ceros validos y evitar reconstruir deuda desde pagos historicos. Titulos y endoso solo si existen.
- Conservar motores, beneficios, tasas, IPC, importacion, Excel, persistencia y cierre SIMPLE. Pruebas con los cuatro Excel originales, casos adicionales y auditoria exacta del alcance.

# 16.33.248

- Corrección matemática autorizada: retirar redistribuirSancionSimple, que forzaba sanción después de aplicar la proporción y descontaba saldos varias veces. El motor conserva su reparto proporcional original.
- En cuatro a seis cuotas, registrar la sanción proporcional sobre la misma base de anticipos, también antes o el día del primer vencimiento.
- Caso de control: deuda $430.000 y pago $10.000; aplicar $9.000 a impuesto y $1.000 a sanción, con saldo $391.000 + $29.000 = $420.000.
- Conservar fórmula de proporción/redondeo, TDJ mínimos, beneficios, tasas, IPC y motor oficial. Prueba de conservación ahora obligatoria en CI y auditoría exacta del alcance autorizado.

# 16.33.247

- TDJ: el indicador de TIM del 31/03/2026 reconoce la tasa mensual de marzo ya utilizada por el motor, aunque el tramo histórico termine el día 30. Las tasas derivadas vuelven a mostrarse.
- No se extienden tasas a meses sin parametrizar ni se modifican cálculos, beneficios, tablas, exportaciones o Supabase.

# 16.33.246

- Retirar cuatro notas históricas de RELEASES y dos comprobantes antiguos de integración/despliegue Render. El historial permanece recuperable en Git.
- Conservar las pruebas, AGENTS.md, .agents, CHANGELOG, auditoría técnica y guía de operación TIM/IPC.
- Sin cambios funcionales en DIAN/TDJ, cálculos, beneficios, sanciones, importación, exportación ni Supabase. Los 51 recursos públicos se conservan.

# 16.33.245

- DIAN: valor y fecha de sanción, incluido el calendario, bloqueados si Tiene sanción está vacío o en NO; habilitados con SI. Se conservan los valores al alternar y el comportamiento del tipo de liquidación.
- Sin cambios en cálculos, beneficios, TDJ, exportaciones, TIM, IPC ni Supabase.
- Pruebas de estados, importación, limpieza por pestaña y regresión.

# 16.33.244

- DIAN: retirar únicamente el panel Auditoría y trazabilidad y su código informativo. Colores Excel, protección de pegado, cálculos y soportes de la versión publicada 16.33.243 conservados.

# 16.33.243

- Pegado único en los cuadros de pagos de DIAN y TDJ: captura literal del portapapeles sin propagación múltiple de eventos.
- Sin cambios en motores tributarios, cálculos o importación de títulos.

# 16.33.242

- Auditoría conservadora de GitHub, Render y Supabase. Se conservan pruebas, documentación operativa y módulos activos.
- Se sincroniza la versión pública y parámetros de caché de las páginas, sin cambios en cálculos, motores ni estructura de datos.
- Los sufijos históricos de módulos activos se mantienen para no alterar dependencias.

# 16.33.241

- Encabezados DIAN/TDJ centrados respecto a la pantalla, con adaptación de navegación en pantallas pequeñas. Sin cambios funcionales.

# 16.33.240

- DIAN: excedentes nominales completos en indicador y soportes PDF/Excel, incluso si el cálculo reservó parte de un TDJ para pagos posteriores.
- TDJ: detalle PDF informativo del título íntegro posterior a la cancelación, con deuda, aplicación y saldo en cero.
- Motores, sanciones, beneficios, IPC/TIM y limpieza por pestaña sin cambios.

# Cambios

## 16.33.239 — Limpieza controlada y parámetros TIM/IPC
- Se retiran 111 archivos históricos o desconectados, incluidas 83 notas anteriores recuperables en Git; se conserva la nota vigente.
- Manifiesto público de 51 recursos, paquete dist y comprobación de integridad de 35 módulos activos contra la versión aprobada.
- TIM mensual SFC e IPC anual de diciembre DANE: consultas independientes, reintentos, validación de período, dry-run, registro del resultado y conservación de registros existentes ante discrepancias.
- Se preserva el cron diario 05:00 Colombia y se amplía su timeout. Se evita duplicar períodos de TIM.
- Respaldo local de octubre sincronizado con la TIM oficial ya registrada (26,59%).
- Motores, beneficios, exportadores, importadores y limpieza por pestaña conservados. La corrección de redistribución de sanción queda expresamente pendiente por decisión del usuario.


## 16.33.238 — Navegación y acciones DIAN
- Se agrega Ir a liquidación de TDJ junto a Módulo de inicio, con el mismo diseño y enlace directo.
- Datos y vencimientos y Pagos incorporan Exportar Excel y Exportar PDF con el orden y diseño de Resultados.
- Los botones nuevos usan los exportadores existentes mediante clases compartidas, sin duplicar identificadores.
- Se conservan intactas las funciones de Limpiar Datos, Limpiar Pagos y su conexión por pestaña. Pruebas antes y después verifican la conservación de datos y pagos respectivamente.
- Regresión de navegación, diseño escritorio/móvil, PDF y Excel desde las tres pestañas y controles vigentes.


## 16.33.237 — Navegación superior TDJ
- Se retira la navegación inferior de TDJ en todas sus pestañas.
- Ir a liquidación de obligaciones se ubica a la derecha de Módulo de inicio en el encabezado, usando las mismas clases y diseño del botón existente.
- En móvil ambos enlaces conservan el diseño accesible de Inicio y se adaptan al ancho.
- Pruebas: posición y estilos del encabezado en escritorio/móvil, navegación efectiva a DIAN e Inicio y regresiones de importación, cálculo, exportación y limpieza.


## 16.33.236 — Barras de acciones TDJ como DIAN
- Las tres pestañas TDJ comparten el orden Importar Excel, Exportar Excel, Exportar PDF, Limpiar y Calcular liquidación.
- Se reutilizan clases de DIAN para tamaño, tipografía, colores, espaciado y adaptación móvil; se retiran estilos duplicados de las barras TDJ.
- Se conservan clases de eventos e identificadores, importaciones, exportaciones, limpieza y motores.
- Prueba de navegador compara estilos computados de cada botón con DIAN en escritorio y móvil, además de la regresión funcional PDF/XLSX vigente.


## 16.33.235 — Botones de exportación DIAN
- En Resultados DIAN, Exportar Excel y Exportar PDF quedan después de Importar Excel en la barra inferior.
- Se elimina el recuadro Soportes de la liquidación; se conserva el aviso de exportación accesible.
- Se mantienen identificadores y manejadores de exportación, cálculos, importadores y diseño TDJ.
- Validación en navegador: orden, ausencia del recuadro, accesibilidad móvil, PDF y Excel con NIT y saldo esperados; regresiones vigentes.


## 16.33.234 - 2026-10-24

- DIAN: un Excel TDJ con inventario de títulos reconocido y vacío ya no cancela la carga de cuotas, fechas e impuestos. Se conserva el rechazo de filas de títulos que no puedan reconocerse.
- Se reproduce y verifica la recuperación de seis anticipos, pagos y ausencia de títulos con el archivo local del usuario, además de una prueba pública con datos ficticios. Verificados los recorridos DIAN → Excel → DIAN y DIAN → Excel → TDJ.
- No modifica TDJ, motores de cálculo, tasas ni datos de Supabase. Versiones de entrada y visibles sincronizadas en 16.33.234.

## 16.33.233 - 2026-10-24

- DIAN y TDJ: se retiran los cinco botones Importar IA, sus indicadores, la conexión al motor IA y el envío de ejemplos. Se conserva el importador normal.
- TDJ: si los pagos posteriores cierran completamente la obligación sin el título actual, este conserva su nominal para otra obligación o endoso. Se impide usar el detalle de otro título cuando el actual queda excluido.
- El caso crítico conserva su expectativa: títulos $31.000.000, aplicado $16.548.000, endoso $14.452.000; el cuarto título conserva $10.000.000.
- Versiones visibles, entradas, estilos y módulos modificados sincronizados. Pruebas nuevas de importación, prioridad, PDF, Excel, recálculo y trazabilidad. Se conservan las pruebas críticas existentes.
- Auditoría y alcance en `docs/auditoria-16.33.233.md`. No requiere migraciones ni cambios de datos en Supabase.

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
