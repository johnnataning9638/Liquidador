# Retirada de campos auxiliares de sanción — 16.33.264

Fecha: 2026-10-29. Base: 36a90a5b3ce1af4b834ff50e276f9c7668f98a29 (16.33.263).

## Alcance

DIAN retira Sanción mínima del año y Beneficio sanción. TDJ retira Beneficio sanción y Valor sanción con beneficio; cuotas sube al terminar la fila principal. Se eliminan funciones de vista previa, eventos, propiedades de estado y asignaciones de importación exclusivos de esos controles. El formulario adaptable mantiene campos legibles al cambiar de ancho.

Las exportaciones mantienen las posiciones del formato anterior mediante columnas RESERVADO sin datos. Esto evita desplazar fechas y tratamientos en importadores que usan índices; los valores del campo retirado se ignoran al importar. El reconocimiento de encabezados antiguos conserva sus delimitadores para evitar confundirlos con valores contiguos.

## Elementos conservados

Prueba de igualdad exacta contra la base 263 de motores privado, base y oficial, actualización de sanción por IPC, módulo UVT y datos UVT. No hay migraciones ni escrituras a Supabase. Se conservan los tratamientos de cada pago, la tabla histórica y su actualización automática.

## Validación

- 48 pruebas de cálculo, conservación, regresión y alcance: aprobadas.
- 14 pruebas de navegador del flujo vigente sobre dist: aprobadas. Incluyen UI, PDF, XLSX, reimportación, proporcionalidad, anticipos, excedentes, sanción sin capital y actualización UVT simulada ante año nuevo/caída de conexión.
- Comparación independiente antes/después de seis escenarios: igualdad exacta. TDJ y DIAN privada: 2.771.000 (sanción 2023) y 2.500.000 (sanción reciente). DIAN oficial: 3.021.000 y 2.500.000. Se verificó también descuento por pagos/títulos y reimportación.
- Ausencia de controles en el DOM, conservación de valor/fecha al navegar y adición de cuotas. Capturas de escritorio y móvil.
- Sintaxis de todos los archivos JavaScript: aprobada. Diff sin espacios finales ni cambios en secretos, dependencias o permisos.
- Auditoría reversible 264: todos los cambios de producción se revierten exactamente a la base 263; las auditorías históricas continúan ejecutándose después de neutralizar únicamente esta retirada autorizada.

Las comprobaciones locales no equivalen a publicación. GitHub y Render deben verificar el commit final antes de reportar LIVE. La validación YAML del protocolo se ejecuta en CI con PyYAML; el entorno Python local no tiene ese módulo.

## Reversión

Revertir el commit de esta versión mediante PR y volver a desplegar. No se requiere revertir datos ni tareas de Supabase, ya que permanecen sin cambios.
