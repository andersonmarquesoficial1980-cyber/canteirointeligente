"""Testes da migration 20261105120000_equip_disponibilidade_mtbf_mttr em PostgreSQL isolado.

Uso (venv com pgserver + psycopg2-binary, fora do repositório):
  python -I supabase/tests/equip_mtbf_mttr_test.py
Sobe um Postgres temporário, aplica o schema stub + a migration (duas vezes, para checar idempotência)
e roda os cenários. Não toca em produção.
"""
import pathlib, sys, tempfile, uuid
import pgserver, psycopg2, psycopg2.extras

ROOT = pathlib.Path(__file__).resolve().parents[2]
STUB = (ROOT / "supabase/tests/equip_mtbf_mttr_stub_schema.sql").read_text()
MIG = (ROOT / "supabase/migrations/20261105120000_equip_disponibilidade_mtbf_mttr.sql").read_text()

tmp = tempfile.mkdtemp(prefix="pgtest_")
srv = pgserver.get_server(tmp, cleanup_mode="stop")
conn = psycopg2.connect(srv.get_uri())
conn.autocommit = True
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

U = lambda: str(uuid.uuid4())
A, B = U(), U()
uA, uM, uB, uAdm = U(), U(), U(), U()
OGS1, OGS2, OGSB = "1001", "2002", "9001"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))


def sql(q, args=None):
    cur.execute(q, args)
    try:
        return cur.fetchall()
    except psycopg2.ProgrammingError:
        return []


def as_user(uid):
    cur.execute("RESET ROLE")
    cur.execute("SET ROLE authenticated")
    cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (uid,))


def as_super():
    cur.execute("RESET ROLE")
    cur.execute("SELECT set_config('request.jwt.claim.sub', '', false)")


def fails(q, args=None):
    """True se a consulta levanta erro (e desfaz o estado de erro)."""
    try:
        cur.execute(q, args)
        return None
    except psycopg2.Error as e:
        return str(e).strip().splitlines()[0]


# ---------------------------------------------------------------- setup
sql(STUB)
sql(MIG)
sql(MIG)  # idempotência: reaplicar não pode falhar
sql("INSERT INTO companies VALUES (%s,'A'),(%s,'B')", (A, B))
sql("INSERT INTO profiles VALUES (%s,%s,'user'),(%s,%s,'user'),(%s,%s,'user'),(%s,%s,'user')",
    (uA, A, uM, A, uB, B, uAdm, A))
sql("INSERT INTO user_permissions(user_id, modulo_manutencao) VALUES (%s,true)", (uM,))
sql("INSERT INTO user_roles VALUES (%s,'admin')", (uAdm,))
sql("INSERT INTO ogs_reference(company_id, ogs_number) VALUES (%s,%s),(%s,%s),(%s,%s)", (A, OGS1, A, OGS2, B, OGSB))
EQ = {}
for fro, comp in (("FA01", A), ("FA02", A), ("FB01", B)):
    EQ[fro] = sql("INSERT INTO equipamentos(company_id, frota) VALUES (%s,%s) RETURNING id", (comp, fro))[0]["id"]


def reset():
    as_super()
    sql("TRUNCATE equip_falha_reparos, equip_falhas, equip_horario_programado, equipment_diaries, rdo_engenheiro CASCADE")


def diary(frota, dia, period="noturno", ws="Trabalhando", ogs=OGS1, by_id=False):
    sql("""INSERT INTO equipment_diaries(company_id,date,period,status,is_auto,work_status,ogs_number,equipamento_id,equipment_fleet)
           VALUES (%s,%s,%s,'enviado',false,%s,%s,%s,%s)""",
        (A, dia, period, ws, ogs, EQ[frota] if by_id else None, frota))


def horario(ogs=OGS1, turno="noturno", ini="22:00", fim="04:00", frota=None, data=None, sem_op=False):
    sql("""INSERT INTO equip_horario_programado(company_id,ogs_number,turno,equipamento_id,data,hora_inicio,hora_fim,sem_operacao)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
        (A, ogs, turno, EQ[frota] if frota else None, data, None if sem_op else ini, None if sem_op else fim, sem_op))


def falha(frota, ini, fim, ogs=OGS1, status="confirmada", by=uA):
    return sql("""INSERT INTO equip_falhas(company_id,equipamento_id,ogs_number,parada_inicio,parada_fim,causa,origem,status,created_by)
                  VALUES (%s,%s,%s,%s,%s,'Hidráulica','mecanico',%s,%s) RETURNING id""",
               (A, EQ[frota], ogs, ini, fim, status, by))[0]["id"]


def reparo(fid, ini, fim):
    sql("INSERT INTO equip_falha_reparos(company_id,falha_id,reparo_inicio,reparo_fim) VALUES (%s,%s,%s,%s)", (A, fid, ini, fim))


def calc(ini="2026-10-05", fim="2026-10-05", ogs=None, eq=None, uid=uA, comp=A):
    as_user(uid)
    try:
        return sql("SELECT * FROM equip_indicadores_manutencao(%s,%s,%s,%s,%s)", (comp, ini, fim, ogs, EQ[eq] if eq else None))
    finally:
        as_super()


def row(rows, frota="FA01", ogs=OGS1):
    return next((r for r in rows if r["frota"] == frota and r["ogs_number"] == ogs), None)


D = "2026-10-05"
N = lambda s: f"{s}-03"  # horário local São Paulo

# 1. Sem falhas: 100%, MTBF/MTTR sem dado (NULL, sem divisão por zero)
reset(); diary("FA01", D); horario()
r = row(calc())
check("1 sem falhas: disponibilidade 100% e 6h programadas", r and float(r["disponibilidade_pct"]) == 100 and float(r["tempo_programado_h"]) == 6, r)
check("1 sem falhas: MTBF e MTTR são NULL", r and r["mtbf_h"] is None and r["mttr_h"] is None and r["qtd_falhas"] == 0, r)

# 2. Exemplo da solicitação: 22h-04h, quebra de 2h => 66,67%
reset(); diary("FA01", D); horario()
f = falha("FA01", N("2026-10-06 00:00"), N("2026-10-06 02:00")); reparo(f, N("2026-10-06 00:30"), N("2026-10-06 02:00"))
r = row(calc())
check("2 exemplo 22h-04h com 2h parada = 66,67%", r and float(r["disponibilidade_pct"]) == 66.67, r)
check("2 MTBF=4h (6-2) e MTTR=1,5h (reparo efetivo, não o tempo parado)", r and float(r["mtbf_h"]) == 4 and float(r["mttr_h"]) == 1.5 and float(r["tempo_parado_h"]) == 2, r)

# 3. Parada parcialmente fora da janela: só a parte dentro conta (03:00-06:00 => 1h)
reset(); diary("FA01", D); horario(); falha("FA01", N("2026-10-06 03:00"), N("2026-10-06 06:00"))
r = row(calc())
check("3 parada cortada pela janela: 1h parada", r and float(r["tempo_parado_h"]) == 1 and r["qtd_falhas"] == 1, r)

# 4. Parada inteiramente fora do horário: sem efeito e não conta como falha
reset(); diary("FA01", D); horario(); falha("FA01", N("2026-10-06 06:00"), N("2026-10-06 08:00"))
r = row(calc())
check("4 parada fora do horário não conta (0h, 0 falhas, 100%)", r and float(r["tempo_parado_h"]) == 0 and r["qtd_falhas"] == 0 and float(r["disponibilidade_pct"]) == 100, r)

# 5. Paradas simultâneas não contam duas vezes (00-02 e 01-03 => 3h, 2 falhas)
reset(); diary("FA01", D); horario()
falha("FA01", N("2026-10-06 00:00"), N("2026-10-06 02:00")); falha("FA01", N("2026-10-06 01:00"), N("2026-10-06 03:00"))
r = row(calc())
check("5 sobreposição unida: 3h parado (não 4h) e 2 falhas", r and float(r["tempo_parado_h"]) == 3 and r["qtd_falhas"] == 2 and float(r["disponibilidade_pct"]) == 50, r)

# 6. Falha cancelada / pendente de confirmação são ignoradas
reset(); diary("FA01", D); horario()
falha("FA01", N("2026-10-06 00:00"), N("2026-10-06 02:00"), status="cancelada")
falha("FA01", N("2026-10-06 00:00"), N("2026-10-06 02:00"), status="pendente_confirmacao")
r = row(calc())
check("6 cancelada e pendente não entram", r and r["qtd_falhas"] == 0 and float(r["tempo_parado_h"]) == 0, r)

# 7. Falha em aberto (sem fim): vai até o fim da janela e é sinalizada; MTTR sem dado
reset(); diary("FA01", D); horario(); falha("FA01", N("2026-10-06 01:00"), None)
r = row(calc())
check("7 falha em aberto: 3h parado até o fim da janela, sinalizada, MTTR NULL", r and float(r["tempo_parado_h"]) == 3 and r["falhas_em_aberto"] == 1 and r["mttr_h"] is None, r)

# 8. Falha reparada sem trecho de reparo: entra em falhas, fica fora do MTTR e é sinalizada
reset(); diary("FA01", D); horario(); falha("FA01", N("2026-10-06 00:00"), N("2026-10-06 01:00"))
r = row(calc())
check("8 sem trecho de reparo: MTTR NULL, falhas_sem_reparo=1, MTBF calculado", r and r["mttr_h"] is None and r["falhas_sem_reparo"] == 1 and float(r["mtbf_h"]) == 5, r)

# 9. Dia sem operação (exceção) e dia sem horário cadastrado
reset(); diary("FA01", D); horario(); horario(data=D, sem_op=True)
r = row(calc())
check("9 exceção 'sem operação': programado 0, disponibilidade NULL", r and float(r["tempo_programado_h"]) == 0 and r["disponibilidade_pct"] is None and r["dias_sem_operacao"] == 1, r)
reset(); diary("FA01", D)
r = row(calc())
check("9 sem horário cadastrado: sinalizado e fora do cálculo", r and r["dias_sem_horario"] == 1 and float(r["tempo_programado_h"]) == 0 and r["disponibilidade_pct"] is None, r)

# 10. RDO Técnico: dia parado por chuva sai do programado; 'Indisponibilidade de Equipamento' não
reset(); diary("FA01", D); horario()
sql("INSERT INTO rdo_engenheiro(company_id,data,status,houve_producao,motivo_sem_producao,ogs_number) VALUES (%s,%s,'enviado',false,'Chuva',%s)", (A, D, OGS1))
r = row(calc())
check("10 dia de chuva no RDO Técnico é excluído do programado", r and r["dias_excluidos_rdo"] == 1 and float(r["tempo_programado_h"]) == 0, r)
reset(); diary("FA01", D); horario()
sql("INSERT INTO rdo_engenheiro(company_id,data,status,houve_producao,motivo_sem_producao,ogs_number) VALUES (%s,%s,'enviado',false,'Indisponibilidade de Equipamento',%s)", (A, D, OGS1))
r = row(calc())
check("10 'Indisponibilidade de Equipamento' não exclui o dia", r and r["dias_excluidos_rdo"] == 0 and float(r["tempo_programado_h"]) == 6, r)

# 11. Precedência: equipamento+dia > obra+dia > equipamento padrão > obra padrão
reset(); diary("FA01", D); diary("FA02", D)
horario(ini="22:00", fim="04:00")                      # padrão da obra: 6h
horario(frota="FA01", ini="22:00", fim="02:00")        # padrão do equipamento: 4h
r = calc()
check("11 padrão do equipamento vence padrão da obra", float(row(r, "FA01")["tempo_programado_h"]) == 4 and float(row(r, "FA02")["tempo_programado_h"]) == 6, r)
horario(data=D, ini="22:00", fim="01:00")              # exceção do dia da obra: 3h
r = calc()
check("11 exceção do dia da obra vence padrão do equipamento", float(row(r, "FA01")["tempo_programado_h"]) == 3, r)
horario(frota="FA01", data=D, ini="22:00", fim="23:00")  # equipamento+dia: 1h
r = calc()
check("11 equipamento+dia vence tudo", float(row(r, "FA01")["tempo_programado_h"]) == 1, r)

# 12. Filtros por obra e equipamento; período de vários dias soma janelas
reset(); diary("FA01", D); diary("FA01", "2026-10-06"); diary("FA02", D, ogs=OGS2)
horario(); horario(ogs=OGS2)
r = calc("2026-10-05", "2026-10-06")
check("12 dois dias somam 12h programadas", float(row(r, "FA01")["tempo_programado_h"]) == 12 and row(r, "FA01")["dias_programados"] == 2, r)
check("12 filtro por obra", [x["ogs_number"] for x in calc("2026-10-05", "2026-10-06", ogs=OGS2)] == [OGS2], "")
check("12 filtro por equipamento", [x["frota"] for x in calc("2026-10-05", "2026-10-06", eq="FA02")] == ["FA02"], "")

# 13. work_status e diário automático: só Trabalhando/Manutenção, manual, enviado
reset(); horario()
for ws in ("Disposição", "Folga", "Cancelou", "Em Transporte"):
    diary("FA01", D, ws=ws)
sql("INSERT INTO equipment_diaries(company_id,date,period,status,is_auto,work_status,ogs_number,equipment_fleet) VALUES (%s,%s,'noturno','enviado',true,'Trabalhando',%s,'FA01')", (A, D, OGS1))
check("13 Disposição/Folga/Cancelou/Transporte e diário automático não geram tempo programado", calc() == [], calc())

# 14. Diário vinculado por equipamento_id (sem frota) também é reconhecido
reset(); horario(); sql("INSERT INTO equipment_diaries(company_id,date,period,status,is_auto,work_status,ogs_number,equipamento_id) VALUES (%s,%s,'noturno','enviado',false,'Manutenção',%s,%s)", (A, D, OGS1, EQ["FA01"]))
r = row(calc())
check("14 diário com work_status Manutenção entra no programado", r and float(r["tempo_programado_h"]) == 6, r)

# 15. Turno diurno sem virada
reset(); diary("FA01", D, period="diurno"); horario(turno="diurno", ini="07:00", fim="17:00"); falha("FA01", N(D + " 10:00"), N(D + " 12:00"))
r = row(calc())
check("15 diurno 07-17h com 2h parado = 80%", r and float(r["disponibilidade_pct"]) == 80 and float(r["tempo_programado_h"]) == 10, r)

# ---------------------------------------------------------------- segurança / RLS
reset(); diary("FA01", D); horario()
check("S1 usuário de outra empresa não calcula empresa A", fails("SELECT 1") is None and (as_user(uB) or True) and
      "Sem acesso" in (fails("SELECT * FROM equip_indicadores_manutencao(%s,%s,%s)", (A, D, D)) or ""), "")
as_super()
cur.execute("RESET ROLE"); cur.execute("SET ROLE anon")
check("S2 anon não executa a função", fails("SELECT * FROM equip_indicadores_manutencao(%s,%s,%s)", (A, D, D)) is not None, "")
as_super()
check("S3 período inválido e > 367 dias rejeitados", (as_user(uA) or True) and fails("SELECT * FROM equip_indicadores_manutencao(%s,%s,%s)", (A, "2026-01-01", "2027-06-01")) is not None, "")
as_super()

# Qualquer usuário da empresa lança falha (inclusive sem permissão de módulo) ...
as_user(uA)
e1 = fails("""INSERT INTO equip_falhas(company_id,equipamento_id,ogs_number,parada_inicio,causa,origem)
              VALUES (%s,%s,%s,%s,'Motor','operador')""", (A, EQ["FA01"], OGS1, N("2026-10-06 00:00")))
check("S4 usuário comum lança falha na própria empresa", e1 is None, e1)
fid = sql("SELECT id FROM equip_falhas")[0]["id"]
# ... mas não em outra empresa, nem com equipamento/OGS de outra empresa, nem forjando autor
e2 = fails("""INSERT INTO equip_falhas(company_id,equipamento_id,ogs_number,parada_inicio,causa,origem)
              VALUES (%s,%s,%s,%s,'x','operador')""", (B, EQ["FB01"], OGSB, N("2026-10-06 00:00")))
check("S5 não lança falha em outra empresa (RLS)", e2 is not None, e2)
as_user(uA)
e3 = fails("""INSERT INTO equip_falhas(company_id,equipamento_id,ogs_number,parada_inicio,causa,origem)
              VALUES (%s,%s,%s,%s,'x','operador')""", (A, EQ["FB01"], OGS1, N("2026-10-06 00:00")))
check("S6 equipamento de outra empresa rejeitado pelo trigger", e3 is not None and "Equipamento" in e3, e3)
as_user(uA)
e4 = fails("""INSERT INTO equip_falhas(company_id,equipamento_id,ogs_number,parada_inicio,causa,origem,created_by)
              VALUES (%s,%s,%s,%s,'x','operador',%s)""", (A, EQ["FA01"], OGS1, N("2026-10-06 00:00"), uM))
check("S7 não forja autor (created_by)", e4 is not None, e4)
as_user(uB)
check("S8 outra empresa não enxerga falhas", sql("SELECT count(*) n FROM equip_falhas")[0]["n"] == 0, "")
as_user(uM)  # manutenção (gestão) edita falha alheia; usuário comum de outro autor não
check("S9 gestão edita falha de outro autor", (sql("UPDATE equip_falhas SET causa='Elétrica' WHERE id=%s RETURNING id", (fid,)) != []), "")
as_user(uAdm); sql("UPDATE equip_falhas SET created_by=%s WHERE id=%s", (uM, fid)) if False else None
as_super(); sql("UPDATE equip_falhas SET created_by=%s", (uM,))
as_user(uA)
check("S10 usuário comum não edita falha de outro autor", sql("UPDATE equip_falhas SET causa='x' WHERE id=%s RETURNING id", (fid,)) == [], "")
check("S11 usuário comum não exclui falha de outro autor", sql("DELETE FROM equip_falhas WHERE id=%s RETURNING id", (fid,)) == [], "")

# Horário programado: só gestão
as_user(uA)
e5 = fails("INSERT INTO equip_horario_programado(company_id,ogs_number,turno,hora_inicio,hora_fim) VALUES (%s,%s,'diurno','07:00','17:00')", (A, OGS2))
check("S12 usuário comum não cadastra horário programado", e5 is not None, e5)
as_user(uM)
e6 = fails("INSERT INTO equip_horario_programado(company_id,ogs_number,turno,hora_inicio,hora_fim) VALUES (%s,%s,'diurno','07:00','17:00')", (A, OGS2))
check("S13 manutenção cadastra horário programado", e6 is None, e6)
as_user(uAdm)
check("S14 admin cadastra horário (exceção de dia)", fails("INSERT INTO equip_horario_programado(company_id,ogs_number,turno,data,sem_operacao) VALUES (%s,%s,'diurno','2026-10-07',true)", (A, OGS2)) is None, "")
check("S15 duplicidade do mesmo padrão rejeitada", (as_user(uM) or True) and fails("INSERT INTO equip_horario_programado(company_id,ogs_number,turno,hora_inicio,hora_fim) VALUES (%s,%s,'diurno','08:00','18:00')", (A, OGS2)) is not None, "")
as_super()

# Reparo precisa estar dentro da parada e na mesma empresa
reset(); f = falha("FA01", N("2026-10-06 00:00"), N("2026-10-06 02:00"))
e7 = fails("INSERT INTO equip_falha_reparos(company_id,falha_id,reparo_inicio,reparo_fim) VALUES (%s,%s,%s,%s)", (A, f, N("2026-10-05 23:00"), N("2026-10-06 01:00")))
check("S16 reparo iniciando antes da parada rejeitado", e7 is not None and "dentro" in e7, e7)
e8 = fails("INSERT INTO equip_falha_reparos(company_id,falha_id,reparo_inicio,reparo_fim) VALUES (%s,%s,%s,%s)", (A, f, N("2026-10-06 01:00"), N("2026-10-06 03:00")))
check("S17 reparo terminando depois da parada rejeitado", e8 is not None, e8)
e9 = fails("INSERT INTO equip_falha_reparos(company_id,falha_id,reparo_inicio,reparo_fim) VALUES (%s,%s,%s,%s)", (B, f, N("2026-10-06 00:10"), N("2026-10-06 01:00")))
check("S18 reparo com empresa diferente da falha rejeitado", e9 is not None, e9)
e10 = fails("INSERT INTO equip_falhas(company_id,equipamento_id,ogs_number,parada_inicio,parada_fim,causa,origem) VALUES (%s,%s,%s,%s,%s,'x','operador')",
            (A, EQ["FA01"], OGS1, N("2026-10-06 02:00"), N("2026-10-06 01:00")))
check("S19 fim antes do início rejeitado", e10 is not None, e10)

# Reparos em trechos: MTTR soma só o tempo efetivo, sem dupla contagem de trechos sobrepostos
reset(); diary("FA01", D); horario()
f = falha("FA01", N("2026-10-06 00:00"), N("2026-10-06 03:00"))
reparo(f, N("2026-10-06 00:30"), N("2026-10-06 01:30")); reparo(f, N("2026-10-06 01:00"), N("2026-10-06 02:00")); reparo(f, N("2026-10-06 02:30"), N("2026-10-06 03:00"))
r = row(calc())
check("16 reparo em trechos (sobreposto unido): 2h de reparo efetivo em 3h parado", r and float(r["mttr_h"]) == 2 and float(r["tempo_parado_h"]) == 3, r)

# Dois equipamentos / MTTR médio por quantidade de falhas reparadas
reset(); diary("FA01", D); horario()
f1 = falha("FA01", N("2026-10-06 00:00"), N("2026-10-06 01:00")); reparo(f1, N("2026-10-06 00:00"), N("2026-10-06 01:00"))
f2 = falha("FA01", N("2026-10-06 02:00"), N("2026-10-06 04:00")); reparo(f2, N("2026-10-06 02:00"), N("2026-10-06 03:00"))
r = row(calc())
check("17 MTTR = (1h+1h)/2 e MTBF = (6-3)/2 = 1,5h", r and float(r["mttr_h"]) == 1 and float(r["mtbf_h"]) == 1.5 and r["qtd_reparadas"] == 2, r)

# Superadmin sem empresa pode consultar uma empresa explícita
reset(); diary("FA01", D); horario()
uS = U(); as_super(); sql("INSERT INTO profiles VALUES (%s,NULL,'superadmin')", (uS,))
check("S20 superadmin (company_id nulo) consulta empresa escolhida", row(calc(uid=uS)) is not None, "")

as_super()
falhas = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(falhas)}/{len(results)} verificações passaram")
srv.cleanup()
sys.exit(1 if falhas else 0)
