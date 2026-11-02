# Sanción oficial — versión 16.33.275

Cambio solicitado por el usuario: aplicar `SA = VS × (1 + IPC/365)^n` exclusivamente en la opción Oficial, manteniendo por ahora el campo Fecha sanción como base.

- Primera aplicación: 1 de enero siguiente a Fecha sanción.
- Primer período: días transcurridos desde Fecha sanción hasta el 31 de diciembre, excluyendo el día inicial. Del 15/12 al 31/12 son 16 días.
- Períodos posteriores: años calendario completos de 365 o 366 días.
- IPC: inflación del año anterior al año de aplicación, expresada como decimal. El divisor permanece en 365 incluso en año bisiesto.
- Tasa diaria sin redondeo intermedio. Se calcula SA y luego se aproxima al millar; esto también cubre saldos que dejan pagos en pesos no múltiplos de mil.
- Cada aplicación parte del saldo vigente y se excluyen los años ya procesados para evitar duplicación entre pagos y corte.
- PDF y Excel conservan la fecha de aplicación y muestran adicionalmente fórmula, inicio/fin del período y días.

Ejemplo ilustrativo: sanción $1.000.000 del 15/12/2025, IPC 2025 del 10 %. El 01/01/2026: `1.000.000 × (1 + 0,10/365)^16 = 1.004.392,58`, aproximado a $1.004.000. No se vuelve a actualizar durante 2026.

La fecha base queda pendiente de la directriz que indicó el usuario. Este cambio no reemplaza Fecha sanción por firmeza, auto admisorio ni providencia definitiva. Se conservan el motor privado, intereses, beneficios, mínimos, datos centrales y reglas de imputación.

Validación: `node tests/sancion-oficial-formula-275.mjs`, `node tests/alcance-sancion-oficial-275.mjs` y `node tests/navegador-sancion-oficial-275.mjs`, además de las regresiones vigentes. La prueba de navegador incluye pantalla, PDF, XLSX y reimportación con y sin pagos.
