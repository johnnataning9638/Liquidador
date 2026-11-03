# Beneficio con valor cero en el cuadro principal — 16.33.277

La versión 277 sustituye el resultado separado de 276. Una fila con fecha válida, beneficio seleccionado y valor vacío/cero genera un detalle normal con ese tratamiento, deuda igual a saldo y aplicado cero. Los indicadores y los soportes PDF/Excel utilizan ese mismo resultado. No existe el cuadro «Cuánto pagar con el beneficio».

DIAN privada y oficial muestran el cuadro habitual. TDJ conserva sus indicadores y su tabla de obligaciones, actualizados con el beneficio, y genera el detalle DIAN normal en PDF. El indicador habitual TDJ de saldo final mantiene su definición de impuesto más sanción.

Cada consulta se calcula con los movimientos efectivos anteriores a su fecha, sin volver a reducir la sanción por consultas previas. Si hay un movimiento real posterior, el resultado final corresponde a ese movimiento real. El corte explícito sigue las reglas existentes. Un beneficio desconocido, fuera de vigencia o sin parámetros suficientes impide presentar un resultado alternativo silencioso.

Pruebas: equivalencia con la deuda previa al abono de $1, vacío/cero, saldo por componente, cronología, cortes, consultas independientes, datos inmutables, pantalla/PDF/Excel/reimportación en las tres modalidades, integridad y regresiones históricas. La fórmula oficial 275, parámetros tributarios, asignación de títulos y Supabase se conservan.

Base: 9ce40ca2c7235b8cf369046034ed6e9e89a69b2b. Reversión trazada en tests/fixtures/cambios-cuadro-277.json; para volver a producción anterior se revierte el PR completo.
