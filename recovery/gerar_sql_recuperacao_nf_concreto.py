#!/usr/bin/env python3
import csv
import sys
from pathlib import Path
from typing import Optional

COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

def sql_text(v: Optional[str]):
    if v is None:
        return "NULL"
    s = str(v).strip()
    if s == "":
        return "NULL"
    return "'" + s.replace("'", "''") + "'"

def sql_num(v: Optional[str]):
    if v is None:
        return "NULL"
    s = str(v).strip().replace(",", ".")
    if s == "":
        return "NULL"
    float(s)  # valida
    return s


def main():
    if len(sys.argv) < 2:
        print("Uso: python recovery/gerar_sql_recuperacao_nf_concreto.py recovery/template_recuperacao_nf_concreto.csv")
        sys.exit(1)

    csv_path = Path(sys.argv[1]).expanduser().resolve()
    out_sql = csv_path.parent / "aplicar_recuperacao_nf_concreto.sql"

    rows = list(csv.DictReader(csv_path.open("r", encoding="utf-8-sig")))
    if not rows:
        print("CSV vazio")
        sys.exit(1)

    stmts = []
    stmts.append("-- SQL gerado automaticamente para recuperação de NF Concreto")
    stmts.append("begin;")

    update_count = 0
    insert_count = 0

    for i, r in enumerate(rows, start=2):
        rdo_id = (r.get("rdo_id") or "").strip()
        if not rdo_id:
            continue

        empreiteiro = (r.get("empreiteiro") or "").strip()
        nf = (r.get("nf") or "").strip()
        qtd = (r.get("quantidade_m3") or "").strip()
        tipo = (r.get("tipo_concreto") or "").strip()
        fornecedor = (r.get("fornecedor") or "").strip()

        if empreiteiro:
            stmts.append(
                f"update public.rdo_diarios set empreiteiro = {sql_text(empreiteiro)} where id = {sql_text(rdo_id)} and company_id = '{COMPANY_ID}';"
            )
            update_count += 1

        if nf or qtd or tipo or fornecedor:
            if not nf:
                raise ValueError(f"Linha {i}: nf obrigatório quando há dados de concreto")
            qtd_sql = sql_num(qtd)
            stmts.append(
                "insert into public.rdo_nf_concreto (rdo_id, company_id, nf, quantidade_m3, tipo_concreto, fornecedor, foto_url) "
                f"select {sql_text(rdo_id)}, '{COMPANY_ID}', {sql_text(nf)}, {qtd_sql}, {sql_text(tipo)}, {sql_text(fornecedor)}, null "
                "where not exists ("
                "select 1 from public.rdo_nf_concreto x "
                f"where x.rdo_id = {sql_text(rdo_id)} and coalesce(x.nf,'') = coalesce({sql_text(nf)},'') "
                f"and coalesce(x.tipo_concreto,'') = coalesce({sql_text(tipo)},'') "
                f"and coalesce(x.fornecedor,'') = coalesce({sql_text(fornecedor)},'') "
                f"and coalesce(x.quantidade_m3,-1) = coalesce({qtd_sql},-1)"
                ");"
            )
            insert_count += 1

    stmts.append("commit;")
    out_sql.write_text("\n".join(stmts) + "\n", encoding="utf-8")
    print(f"OK: {out_sql}")
    print(f"Updates de empreiteiro: {update_count}")
    print(f"Inserts de NF concreto: {insert_count}")


if __name__ == "__main__":
    main()
