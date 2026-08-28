#!/usr/bin/env python3
"""
Extrai resumo mensal de HE a partir de TXT extraído dos PDFs do Pontomais.

Uso:
  python scripts/extrair_resumo_he_pontomais.py \
    --input-dir tmp_pdf_extracts \
    --out-csv tmp_pdf_extracts/resumo_he.csv \
    --competencia 2026-08-01
"""

from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class LinhaResumo:
    colaborador_nome: str
    equipe_nome: str | None
    periodo_inicio: str | None
    periodo_fim: str | None
    credito_horas: float
    debito_horas: float
    horas_normais: float
    he_70_horas: float
    he_100_horas: float
    adicional_noturno_horas: float
    total_horas_extras_horas: float
    fonte_pdf: str


def to_float(v: str) -> float:
    v = v.strip().replace(',', '.')
    # formato HH:MM -> horas decimais
    if re.fullmatch(r'\d{1,3}:\d{2}', v):
        hh, mm = v.split(':')
        return int(hh) + (int(mm) / 60)
    try:
        return float(v)
    except Exception:
        return 0.0


def parse_file(txt_path: Path) -> list[LinhaResumo]:
    raw = txt_path.read_text(encoding='utf-8', errors='ignore')
    lines = [ln.strip() for ln in raw.splitlines()]

    equipe = None
    m_eq = re.search(r'Filtro por:\s*Equipe\s*-\s*(.+)', raw, re.IGNORECASE)
    if m_eq:
        equipe = m_eq.group(1).strip()

    periodo_ini = periodo_fim = None
    m_per = re.search(r'De\s*(\d{2}/\d{2}/\d{4})\s*at[eé]\s*(\d{2}/\d{2}/\d{4})', raw, re.IGNORECASE)
    if m_per:
        periodo_ini, periodo_fim = m_per.group(1), m_per.group(2)

    totais_idx = [i for i, ln in enumerate(lines) if ln.upper() == 'TOTAIS']
    resultados: list[LinhaResumo] = []

    for idx in totais_idx:
        # Procura colaborador mais próximo acima
        colaborador = None
        for j in range(idx, max(-1, idx - 400), -1):
            m_col = re.match(r'Colaborador:\s*(.+)$', lines[j], flags=re.IGNORECASE)
            if m_col:
                colaborador = m_col.group(1).strip()
                break
        if not colaborador:
            continue

        # Bloco numérico após TOTAIS:
        # [credito, debito, h_intervalo, horas_normais, he70, he100, adicional_noturno, ...]
        nums: list[float] = []
        for k in range(idx + 1, min(len(lines), idx + 20)):
            ln = lines[k]
            # para em próximo colaborador
            if ln.lower().startswith('colaborador'):
                break
            if not ln:
                continue
            token = ln.split()[0]  # corta "Not.:" e afins
            if re.fullmatch(r'\d+(?:\.\d+)?', token) or re.fullmatch(r'\d{1,3}:\d{2}', token):
                nums.append(to_float(token))

        if len(nums) < 7:
            continue

        credito = nums[0]
        debito = nums[1]
        horas_normais = nums[3]
        he70 = nums[4]
        he100 = nums[5]
        adicional = nums[6]

        resultados.append(
            LinhaResumo(
                colaborador_nome=colaborador,
                equipe_nome=equipe,
                periodo_inicio=periodo_ini,
                periodo_fim=periodo_fim,
                credito_horas=credito,
                debito_horas=debito,
                horas_normais=horas_normais,
                he_70_horas=he70,
                he_100_horas=he100,
                adicional_noturno_horas=adicional,
                total_horas_extras_horas=he70 + he100,
                fonte_pdf=txt_path.name,
            )
        )

    # dedupe por colaborador
    by_name = {}
    for r in resultados:
        by_name[r.colaborador_nome] = r
    return list(by_name.values())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--input-dir', required=True)
    ap.add_argument('--out-csv', required=True)
    ap.add_argument('--competencia', required=True, help='YYYY-MM-01')
    args = ap.parse_args()

    input_dir = Path(args.input_dir)
    out_csv = Path(args.out_csv)

    rows: list[LinhaResumo] = []
    for txt in sorted(input_dir.glob('*.txt')):
        rows.extend(parse_file(txt))

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow([
            'competencia', 'colaborador_nome', 'equipe_nome', 'periodo_inicio', 'periodo_fim',
            'credito_horas', 'debito_horas', 'horas_normais', 'he_70_horas', 'he_100_horas',
            'adicional_noturno_horas', 'total_horas_extras_horas', 'fonte_pdf'
        ])
        for r in rows:
            w.writerow([
                args.competencia,
                r.colaborador_nome,
                r.equipe_nome or '',
                r.periodo_inicio or '',
                r.periodo_fim or '',
                f'{r.credito_horas:.2f}',
                f'{r.debito_horas:.2f}',
                f'{r.horas_normais:.2f}',
                f'{r.he_70_horas:.2f}',
                f'{r.he_100_horas:.2f}',
                f'{r.adicional_noturno_horas:.2f}',
                f'{r.total_horas_extras_horas:.2f}',
                r.fonte_pdf,
            ])

    print(f'OK: {len(rows)} linhas extraídas em {out_csv}')


if __name__ == '__main__':
    main()
