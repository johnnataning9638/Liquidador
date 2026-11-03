# Proyección con beneficio sin abono — 16.33.276

Una fila con fecha válida, beneficio seleccionado y valor cero o vacío genera una consulta independiente de impuesto, intereses, sanción y total a pagar. Se ofrece en DIAN privada, DIAN oficial y TDJ.

La consulta tiene aplicado y excedente cero. No reduce el saldo contable, no consume títulos y no altera el tratamiento de pagos reales. Cada consulta parte de la obligación original con los pagos o títulos efectivos anteriores a su fecha; las consultas no se acumulan entre sí. Un pago posterior no cambia una consulta anterior.

El bloque “Cuánto pagar con el beneficio” aparece en pantalla, PDF y Excel. Los soportes distinguen la consulta de los abonos efectivos. Los datos de fecha, tipo y valor cero se conservan para reimportar el libro. No se agregan recibos ni importes ficticios.

Se reutiliza el cálculo existente de cada motor con un evento interno de valor exactamente cero, aislado del resultado contable. Se conserva la fórmula oficial 275, fechas base, intereses, mínimos, beneficios y distribución de los pagos. Una regla desconocida, fecha no admitida o tasa histórica insuficiente deja la consulta no disponible, con explicación; no se sustituye silenciosamente el beneficio.

Validación:

- `node tests/proyeccion-beneficio-cero-276.mjs`: cero/vacío, componentes, paridad con deuda previa a pago real, consultas independientes, pagos previos/posteriores, inmutabilidad y tratamiento no disponible.
- `node tests/alcance-proyeccion-276.mjs`: cambios exactos y reversibles contra 16.33.275, datos y demás recursos preservados.
- `node tests/navegador-proyeccion-276.mjs`: DIAN privada, oficial y TDJ; pantalla/PDF/XLSX/reimportación coinciden y aplicado permanece cero.
- Regresiones vigentes y cotejo independiente del IBC histórico conservados.

El archivo real aportado por el usuario se revisa únicamente de forma local. No forma parte de los recursos publicados ni de las pruebas del repositorio.
