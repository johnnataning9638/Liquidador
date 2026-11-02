"""Paquete reproducible; no incluye archivos ni datos de contribuyentes."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
target = root / 'descargas/puente-dian-273.zip'
target.parent.mkdir(exist_ok=True)
files = {f.name: f.read_text(encoding='utf-8').encode('utf-8') for f in (root / 'extension-dian').iterdir() if f.is_file()}
files['muisca.js'] = (root / 'js/importacion-web-pdf/muisca.js').read_text(encoding='utf-8').encode('utf-8')
with ZipFile(target, 'w', compression=ZIP_DEFLATED) as z:
    for name, data in sorted(files.items()):
        item = ZipInfo(name, (2026, 11, 2, 0, 0, 0))
        item.compress_type = ZIP_DEFLATED
        z.writestr(item, data)
print('Complemento empaquetado: ' + str(target.relative_to(root)))
