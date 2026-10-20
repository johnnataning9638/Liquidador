# Cambios

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
