# PDF sin rótulo DIAN — 16.33.278

Se retira el nodo del rótulo DIAN en todos los encabezados del PDF: detalle de pago, corte sin pagos, solo sanción, resúmenes, excedentes y cierre TDJ. Un espacio vacío conserva la columna, el título central y la fecha; desaparecen el texto y su separador lateral.

Alcance: ambos módulos, régimen ordinario/SIMPLE, liquidación privada/oficial. Los nombres de tasas y referencias normativas permanecen como datos del cálculo. No se alteran motores, fórmulas, parámetros, beneficios, importadores, Excel ni Supabase.

Base publicada: e12160e7df6b7df1d6a47c12fb38db76bb695fa8. La prueba de alcance exige igualdad literal de las cuatro plantillas salvo retirada del rótulo y caché de la plantilla de sanción. Fixture reversible: tests/fixtures/cambios-logo-278.json. Reversión de publicación: revertir el PR completo.
