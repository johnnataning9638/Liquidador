"""Cotejo independiente contra el certificado SFC conservado, sin dependencias."""
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
import datetime as dt
import hashlib
import json
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TABLE = ROOT / 'datos/interes-bancario-corriente.json'
SOURCE = ROOT / 'tests/fixtures/sfc-interes-20261029.xlsx'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def date(value):
    return (dt.datetime(1899, 12, 30) + dt.timedelta(days=int(value))).date().isoformat()

def bp(value):
    return int((Decimal(value) * 10000).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

def main():
    rows = json.loads(TABLE.read_text(encoding='utf-8'))
    assert len(rows) == 25
    assert rows[0]['desde'] == '2019-12-01'
    assert rows[-1]['hasta'] == '2021-12-31'
    assert len({r['desde'] for r in rows}) == 25
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    with zipfile.ZipFile(SOURCE) as book:
        shared = [''.join(x.itertext()) for x in ET.fromstring(book.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        official = {}
        for row in ET.fromstring(book.read('xl/worksheets/sheet1.xml')).findall('s:sheetData/s:row', NS):
            cells = {}
            for cell in row:
                v = cell.find('s:v', NS)
                value = v.text if v is not None else ''
                if cell.attrib.get('t') == 's':
                    value = shared[int(value)]
                cells[re.sub(r'\d', '', cell.attrib['r'])] = value
            # Columna E = consumo y ordinario desde la cabecera de la fila 275.
            if 275 < int(row.attrib['r']) < 427 and cells.get('C', '').isdigit() and cells.get('E'):
                official[date(cells['C'])] = (cells, int(row.attrib['r']))
    for index, record in enumerate(rows):
        cells, number = official[record['desde']]
        assert record['modalidad'] == 'CONSUMO_Y_ORDINARIO'
        assert record['hasta'] == date(cells['D'])
        assert record['tasa_puntos_basicos'] == bp(cells['E']) == bp(str(record['tasa_efectiva_anual']))
        assert record['resolucion'] == cells['A']
        assert record['fecha_resolucion'] == date(cells['B'])
        assert record['fuente_fila'] == number
        assert record['documento_sha256'] == digest
        assert record['fuente_url'].startswith('https://www.superfinanciera.gov.co/')
        if index:
            assert dt.date.fromisoformat(rows[index-1]['hasta']) + dt.timedelta(days=1) == dt.date.fromisoformat(record['desde'])

    # Neutralizar exclusivamente el beneficio manual autorizado 266 antes del control histórico.
    patches = json.loads((ROOT / 'tests/fixtures/cambios-688-manual-266.json').read_text(encoding='utf-8'))
    def historical(file):
        text = (ROOT / file).read_text(encoding='utf-8')
        # Revertir primero las modificaciones posteriores a 267, sin omitir ni relajar
        # la comparación histórica de los motores con el commit de referencia.
        patches268 = json.loads((ROOT / 'tests/fixtures/cambios-ley2155-268.json').read_text(encoding='utf-8'))
        for before, after in reversed(patches268.get(file, [])):
            assert text.count(after) == 1, file
            text = text.replace(after, before, 1)
        patches267 = json.loads((ROOT / 'tests/fixtures/cambios-favorabilidad-267.json').read_text(encoding='utf-8'))
        for before, after in reversed(patches267.get(file, [])):
            assert text.count(after) == 1, file
            text = text.replace(after, before, 1)
        for before, after in reversed(patches.get(file, [])):
            assert text.count(after) == 1, file
            text = text.replace(after, before, 1)
        return text
    # Integridad: la incorporación 265 no modificó ningún motor ni tabla vigente.
    for file in ['js/motor-liquidacion.js', 'js/motor-liquidacion-base.js', 'js/motor-liquidacion-oficial.js', 'datos/tasas-moratorias.json', 'datos/beneficios.json', 'datos/ipc.json', 'datos/uvt.json']:
        before = subprocess.check_output(['git', 'show', '9791324:' + file], cwd=ROOT).decode('utf-8').replace('\r\n', '\n')
        assert historical(file) == before, file
    code = historical('js/motor-liquidacion-base.js')
    reduced = [Decimal(x) for x in re.search(r'const reducidas2021=\[([^]]+)', code).group(1).split(',')]
    ibc688 = {int(m): Decimal(v) for m, v in re.findall(r'(\d+):([\d.]+)', re.search(r'const ibc688=\{([^}]+)', code).group(1))}
    checked45 = checked688 = 0
    for row in rows:
        rate = Decimal(row['tasa_puntos_basicos']) / 100
        month = int(row['desde'][5:7])
        if '2020-05-01' <= row['desde'] <= '2020-11-01':
            assert rate == ibc688[month]
            checked688 += 1
        if row['desde'] >= '2021-02-01':
            assert (rate * Decimal('.2')).quantize(Decimal('.01'), rounding=ROUND_HALF_UP) == reduced[month-2]
            checked45 += 1
    assert checked45 == 11 and checked688 == 7
    print('IBC 265 OK: 25/25 certificados SFC, cero diferencias, 7 IBC 688 y 11 tasas art.45 conciliadas; motores intactos')

if __name__ == '__main__':
    main()
