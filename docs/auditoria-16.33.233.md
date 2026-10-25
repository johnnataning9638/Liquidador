# Auditoría 16.33.233 — 24 de octubre de 2026

Alcance: retirar la importación IA de DIAN y TDJ y corregir el consumo indebido de $1.000 del cuarto TDJ, autorizado expresamente durante esta revisión. Base publicada: 16.33.231, 18cd6ba645b7d40bd0f3f8f8587c145c1fd7d946. No integra la propuesta de recibos compartidos 232.

## Hallazgos confirmados y corregidos

- Prioridad TDJ, alta: tdj-prioridad-203.js maximizaba el título aplicable sin comprobar primero si los pagos posteriores ya cerraban la deuda con título cero. La prueba independiente reprodujo 1000 frente a 0 antes de la corrección. Se añade el cierre previo y se conserva el título si todavía existe deuda real.
- Trazabilidad TDJ, alta: tdj-core-16.33.143.js podía tomar el último detalle de otro movimiento si no existía el del título actual. Se omiten los títulos excluidos y se exige identidad del detalle. Los casos de beneficios y múltiples obligaciones vuelven a pasar después de esta protección conjunta.
- Versiones y controles históricos: la navegación TDJ conservaba un guard 202 y la limpieza enlazaba a 210; las entradas y el pie visibles eran 231. Se sincronizan en 233 los puntos activos afectados. Los controles vigentes adaptan sus referencias y la exportación PDF imprimible sin eliminar la prueba crítica ni sus valores esperados.
- Entorno CI: la ejecución inicial de navegador falló al instalar Playwright 1.55.0 sobre ubuntu-latest, que resolvió a Ubuntu 26.04 no soportado por esa versión. Se fijan los dos trabajos de navegador a Ubuntu 24.04; no se retiran pruebas ni se actualizan dependencias de aplicación.

## Evidencia

- Caso crítico en Chrome sobre producción 231 antes del cambio: total $31.000.000, aplicado $16.549.000, endoso $14.451.000. No se aceptan esos resultados como oráculo; permanecen documentados como defecto previo.
- Caso corregido en Chrome con código local y tasas públicas: total $31.000.000, aplicado $16.548.000, saldo cero, endoso $14.452.000. Títulos aplicados: $500.000, $500.000, $15.548.000 y $0. El cuarto título conserva $10.000.000. PDF y XLSX coinciden; recalcular mantiene el resultado y el nominal.
- Cinco importaciones normales, limpieza DIAN/TDJ y vista móvil de 390 px: correctas; cero errores JavaScript y cero solicitudes IA.
- Caso independiente de importación y cálculo: deuda $1.000.000, pago en fecha de vencimiento $100.000, saldo DIAN $900.000. Título posterior en la misma fecha de $157: saldo TDJ $899.843. PDF y XLSX conservan los saldos; reimportar XLSX TDJ conserva el resultado.
- Regresión matemática: 33 aserciones. Beneficios y orquestación TDJ: 13 casos más XLSX binario. Sintaxis JavaScript e integridad de motores compartidos verificadas.
- Inventario local ampliado: 53 pruebas, 31 satisfactorias y 22 fallos anteriores de contratos de fuente/estructura/versiones. Ninguna prueba que pasaba en la base dejó de pasar. No se presenta el inventario completo como verde; los controles vigentes de CI y navegador se ejecutan adicionalmente.

## Seguridad, dependencias y Supabase

Se elimina ai-bridge.js y la ruta de interpretación remota del importador TDJ. Los módulos activos no importan IA, no consultan su estado ni construyen/envían ejemplos al limpiar. No se añaden dependencias de aplicación ni se cambian las claves públicas de Supabase. Las dependencias nuevas pertenecen exclusivamente a las pruebas de CI y están fijadas por versión.

Supabase: proyecto ulismfqyxnujkwvjjmcp, estado ACTIVE_HEALTHY. Inspección de esquema y asesores en lectura. No existe impacto de esquema o datos que justifique migración. Los asesores notifican dos advertencias anteriores: extensión pg_trgm en public y protección de contraseñas filtradas deshabilitada; dos avisos informativos corresponden a tablas IA con RLS sin políticas. No se abren políticas ni se eliminan datos.

## Pendientes fuera del alcance

- Importador de obligación, gravedad media: un pegado tabulado con primera columna numérica de cuota, por ejemplo `1\t16/05/2024\t1.000.000`, puede tomar 1 como impuesto. La ruta comprobada de fecha e importe sin ese índice reconoce $1.000.000. El archivo del importador es idéntico a la base; requiere corrección separada y no se oculta cambiando su prueba de dominio.
- Los 22 contratos históricos requieren modernización y clasificación individual; su fallo no prueba por sí solo un defecto funcional.
- El diagnóstico de conservación SIMPLE que el protocolo del repositorio registra como conocido permanece fuera de esta corrección. No se afirma auditoría normativa completa de todos los regímenes.
- La verificación local del protocolo Python requiere PyYAML ausente en este entorno. El workflow Codex protocol lo instaló y aprobó en GitHub para el commit inicial del PR; se vuelve a comprobar sobre el commit final antes de fusionar.

## Publicación y comprobación

Servicio objetivo: liquidador-de-obligaciones-tributarias, srv-dau8hnnavr4c738519d0, espacio AI-Liquidador confirmado por el usuario. Publica main por autodeploy. No disparar un segundo despliegue mientras el automático avance. Registrar el SHA de fusión y el ID del despliegue, exigir estado live y volver a ejecutar los controles de navegador y recursos contra la URL publicada. Una aceptación de despliegue no equivale a Live.
