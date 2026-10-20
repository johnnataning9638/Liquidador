# Verificación controlada de despliegue automático

Fecha: 2026-10-19.

Este documento es un marcador de auditoría para verificar el flujo GitHub `main` → Render del sitio estático `liquidador-de-obligaciones-tributarias`.

No altera HTML, JavaScript, estilos, motores de cálculo, tasas, versiones ni conexiones de Supabase. No representa una corrección funcional ni una certificación de pruebas de navegador.

Validación: comparar el SHA de la fusión con el commit reportado por Render; verificar estado `live` y ejecutar pruebas funcionales independientes antes de declarar la validación completa.
