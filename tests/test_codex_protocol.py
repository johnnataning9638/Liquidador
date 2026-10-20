"""Validación estricta de instrucciones Codex sin tocar motores tributarios."""
from pathlib import Path
import re
import yaml

ROOT = Path(__file__).resolve().parents[1]
NAMES = (
    "desarrollo-profesional-ia", "analisis-codigo", "correccion-controlada",
    "auditoria-tecnica", "pruebas-matematicas", "control-versiones",
    "github-render", "supabase", "exportaciones",
)

def test_protocol():
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    assert "Liquidador DIAN" in agents and "Liquidador TDJ" in agents
    assert "procede" in agents.lower()
    for name in NAMES:
        path = ROOT / ".agents" / "skills" / name / "SKILL.md"
        body = path.read_text(encoding="utf-8")
        match = re.match(r"\A---\s*\n(.*?)\n---\s*\n", body, re.S)
        assert match, f"Frontmatter YAML ausente: {path}"
        data = yaml.safe_load(match.group(1))
        assert isinstance(data, dict), f"YAML no es mapa: {path}"
        assert data.get("name") == name, f"Nombre de Skill inválido: {path}"
        assert isinstance(data.get("description"), str) and data["description"].strip(), f"Descripción inválida: {path}"
        assert re.search(r"(?m)^#\s+\S+", body[match.end():]), f"Falta contenido: {path}"
    assert (ROOT / "liquidacion.html").is_file()
    assert (ROOT / "titulos.html").is_file()
    print(f"OK: AGENTS.md, {len(NAMES)} Skills con YAML válido y dos módulos presentes.")

if __name__ == "__main__":
    test_protocol()
