"""Ajuste aislado TDJ v16.33.204. Ejecutar antes de la regresión CI."""
from pathlib import Path

p = Path("js/tdj-core-16.33.143.js")
s = p.read_text(encoding="utf-8")
changes = [
    (
        "valorAntes:disponible,aplicado,saldoTitulo:excedente,saldoObligacion:saldoDespues,",
        "valorAntes:disponible,valorCalculoMotorTDJ:Number(pagoActual.valor),aplicado,saldoTitulo:excedente,saldoObligacion:saldoDespues,",
    ),
    (
        "prevTitlePayments.get(o.id).push({...pagoActual,valor:aplicado});",
        "prevTitlePayments.get(o.id).push({...pagoActual,valor:Number(pagoActual.valor)});",
    ),
    (
        "valor:Math.max(0,Number(x.aplicado||0)),",
        "valor:Math.max(0,Number(x.valorCalculoMotorTDJ??x.aplicado??0)),",
    ),
]
for before, after in changes:
    n = s.count(before)
    if n != 1:
        raise RuntimeError(f"Parche detenido: se esperaban 1 ocurrencia y existen {n}: {before}")
    s = s.replace(before, after)
p.write_text(s, encoding="utf-8")
print("Parche aislado TDJ aplicado; la auditoría de regresión decidirá si puede aprobarse.")
