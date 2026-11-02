# Catálogo de beneficios DIAN y TDJ

La consulta se genera desde `datos/beneficios.json`. Ambos módulos usan el mismo componente, `js/catalogo-beneficios.js`, y la misma presentación, `beneficios.css`.

## Agregar un beneficio

Al incorporar un beneficio en el sistema, registrarlo en `datos/beneficios.json`, que ya alimenta la configuración de los motores. El catálogo incluye cada registro automáticamente; no hay una segunda lista de filas en el componente visual. Las reglas automáticas también deben tener un registro en este archivo.

Los campos existentes conservan su función de cálculo. El objeto opcional `consulta` solo describe la ficha: `norma`, `beneficio`, `aplica` (arreglo), `activacion`, `desde`, `hasta`, `periodo`, `condiciones` (arreglo), `fuente` y `url` HTTPS. Por defecto se utilizan el nombre, los factores, fechas, fuente y condiciones del registro. No se inventan condiciones o fechas ausentes: se señalan como pendientes.

`consulta.variantes` permite describir rutas diferentes de una misma norma (por ejemplo, el automatismo IBC + 2 y su opción histórica del selector). No implica que sean beneficios legales distintos. `consulta.aliases` evita duplicar rótulos históricos.

Una opción nueva en los selectores de pagos que todavía no tenga registro también aparece, con la ficha pendiente de completar. Esto es una protección ante omisiones, no un reemplazo del registro completo. La consulta no modifica opciones de pago ni implementa beneficios en el motor.

El registro se vuelve a consultar al abrir la ventana. Las fuentes externas se abren con HTTPS, sin acceso a la ventana original. Los datos se presentan como texto, nunca como HTML ejecutable. Los errores de conexión muestran un aviso y permiten reintentar; no presentan un catálogo vacío como completo.

## Verificación

- `node tests/catalogo-beneficios-269.mjs`: fichas, filtros, alias, incorporación futura, conservación de reglas y archivos protegidos.
- `node tests/navegador-beneficios-269.mjs`: ambos módulos, teclado, celular, búsqueda, fuentes, nuevo beneficio sin editar la tabla, errores de carga y contenido malicioso.
- `node scripts/preparar-sitio.mjs`: incluye los recursos nuevos en la publicación.

Reversión: revertir el commit de la versión 16.33.269. No hay migraciones ni cambios en Supabase.
