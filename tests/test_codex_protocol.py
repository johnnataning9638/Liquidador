from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
agents = (root / "AGENTS.md").read_text(encoding="utf-8")
assert "Liquidador DIAN" in agents and "Liquidador TDJ" in agents
assert "Procede" in agents or "procede" in agents
names = ["desarrollo-profesional-ia","analisis-codigo","correccion-controlada","auditoria-tecnica","pruebas-matematicas","control-versiones","github-render","supabase","exportaciones"]
for name in names:
    f = root / ".agents" / "skills" / name / "SKILL.md"
    assert f.is_file(), f"Falta skill: {name}"
    body = f.read_text(encoding="utf-8")
    assert re.search(r"(?m)^name:\s*"+re.escape(name)+r"\s*$", body), f"Nombre inválido: {name}"
    assert re.search(r"(?m)^description:\s*\S+", body), f"Falta descripción: {name}"
assert (root / "liquidacion.html").is_file(), "No se encuentra la interfaz DIAN"
print("OK: 9 skills, AGENTS.md e interfaz DIAN presentes. Diagnóstico estático sin modificar cálculos.")
