from pathlib import Path

path = Path('js/motor-liquidacion-base.js')
text = path.read_text(encoding='utf-8')
start = text.index('      // ART. 20 D.1474 / ART. 3 D.0240:')
end = text.index('      // IMPORTANTE: Art. 21 D1474', start)
new = '''      // BENEFICIO ART. 9 D.1419: primero se actualiza la sanción pendiente
      // conforme al Art. 867-1 E.T.; después se compara el saldo actualizado
      // con la sanción mínima. Si el saldo actualizado es menor o igual a la
      // mínima, NO se reconstruye la sanción ni se aplica el 15%: se conserva
      // el saldo real pendiente. Si es superior a la mínima, se paga el 15%
      // del saldo actualizado y ese resultado respeta la sanción mínima como
      // piso. Los tratamientos D.1474/D.0240 conservan su regla existente.
      const tipoPagoUpper=String(pago.tipo||"").toUpperCase();
      const esArt9D1419=tipoPagoUpper.includes("ART. 9 DECRETO 1419");
      const esReduccionAnterior=tipoPagoUpper.includes("ART. 20 DECRETO 1474") || tipoPagoUpper.includes("ART. 3 DECRETO 0240");
      if(!primerBeneficioDecretoUsado && especial.reduceSancion &&
         (esReduccionAnterior || esArt9D1419) && saldoSancion>0){
        const anioMinima=this.anioSancionParaMinima(datos,true);
        const minima=Math.max(0,Number(this.sancionMinima(anioMinima)||0));
        const saldoActualizado=Number(saldoSancion||0);
        const reducido=roundMil(saldoActualizado*Number(especial.factorSancion||0.15));
        // Art. 9 D.1419: si el saldo real actualizado ya está en o por debajo
        // de la mínima, el beneficio NO se aplica y el saldo no se eleva.
        const aplicaReduccion=esArt9D1419 ? saldoActualizado>minima : true;
        const sancionFinal=aplicaReduccion?Math.max(reducido,minima):saldoActualizado;
        saldoSancion=roundMil(sancionFinal);
        if(!esArt9D1419 || aplicaReduccion) primerBeneficioDecretoUsado=true;
        detalleActualizacionSancion.push({
          fechaPago:pago.fecha,
          beneficio:pago.tipo,
          saldoAntesReduccion:roundMil(saldoActualizado),
          porcentajeReduccion:aplicaReduccion?Number(especial.factorSancion||0.15)*100:0,
          valorReducido:aplicaReduccion?reducido:saldoActualizado,
          sancionMinima:minima,
          saldoDespuesReduccion:saldoSancion,
          actualizacionPrevia:roundMil(Math.max(0,saldoActualizado-sancionBaseOriginal)),
          beneficioAplicado:aplicaReduccion
        });
        actualizacionSancionPago.eventos.push({
          tipo:aplicaReduccion?'REDUCCION POR BENEFICIO':'BENEFICIO NO APLICADO POR SALDO EN O POR DEBAJO DE SANCIÓN MÍNIMA',
          beneficio:pago.tipo,
          saldoAntes:roundMil(saldoActualizado),
          actualizacionPrevia:roundMil(Math.max(0,saldoActualizado-sancionBaseOriginal)),
          porcentaje:aplicaReduccion?Number(especial.factorSancion||0.15)*100:0,
          valorReducido:aplicaReduccion?reducido:saldoActualizado,
          sancionMinima:minima,
          saldoDespues:roundMil(saldoSancion),
          beneficioAplicado:aplicaReduccion
        });
      }
'''
text = text[:start] + new + text[end:]
text = text.replace('utilidades.js?v=16.33.122', 'utilidades.js?v=16.33.127')
text = text.replace('actualizacion-sancion.js?v=16.33.122', 'actualizacion-sancion.js?v=16.33.127')
path.write_text(text, encoding='utf-8')

for name in ['js/motor-liquidacion.js', 'js/app.js', 'liquidacion.html']:
    p = Path(name)
    s = p.read_text(encoding='utf-8')
    s = s.replace('16.33.126', '16.33.127').replace('16.33.122', '16.33.127')
    p.write_text(s, encoding='utf-8')

Path('RELEASES/16.33.127.md').write_text('''# v16.33.127 — Ajuste Art. 9 Decreto 1419 de 2026

- Corrige la aplicación del beneficio del Art. 9 sobre el saldo real pendiente de sanción.
- Actualiza primero la sanción pendiente cuando corresponda por Art. 867-1 E.T.
- Si la sanción actualizada es menor o igual a la mínima, conserva el saldo real y no reconstruye la mínima.
- Si la sanción actualizada supera la mínima, aplica 15% del saldo actualizado y usa la mínima únicamente como piso del resultado reducido.
- Mantiene la regla de múltiples pagos/títulos sin recrear la sanción.
- No modifica la lógica de impuesto, intereses, proporcionalidad TDJ ni régimen SIMPLE.
''', encoding='utf-8')
