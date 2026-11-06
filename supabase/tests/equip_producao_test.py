"""Testes da migration 20261106120000_equip_producao_apontamento em PostgreSQL isolado.
Uso: python -I supabase/tests/equip_producao_test.py   (venv com pgserver + psycopg2-binary)"""
import pathlib, sys, tempfile, uuid
import pgserver, psycopg2, psycopg2.extras

ROOT = pathlib.Path(__file__).resolve().parents[2]
STUB = (ROOT / "supabase/tests/equip_mtbf_mttr_stub_schema.sql").read_text()
M1 = (ROOT / "supabase/migrations/20261105120000_equip_disponibilidade_mtbf_mttr.sql").read_text()
M2 = (ROOT / "supabase/migrations/20261106120000_equip_producao_apontamento.sql").read_text()

srv = pgserver.get_server(tempfile.mkdtemp(prefix="pgtest_"), cleanup_mode="stop")
conn = psycopg2.connect(srv.get_uri()); conn.autocommit = True
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
U = lambda: str(uuid.uuid4())
A, B = U(), U(); uA, uM, uB = U(), U(), U()
results = []

def check(n, c, d=""):
    results.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c else f"  -> {d}"))
def sql(q, a=None):
    cur.execute(q, a)
    try: return cur.fetchall()
    except psycopg2.ProgrammingError: return []
def as_user(u): cur.execute("RESET ROLE"); cur.execute("SET ROLE authenticated"); cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)", (u,))
def as_super(): cur.execute("RESET ROLE"); cur.execute("SELECT set_config('request.jwt.claim.sub','',false)")
def fails(q, a=None):
    try: cur.execute(q, a); return None
    except psycopg2.Error as e: return str(e).strip().splitlines()[0]

sql(STUB); sql(M1); sql(M2); sql(M2)  # idempotência
sql("INSERT INTO companies VALUES (%s,'A'),(%s,'B')", (A, B))
sql("INSERT INTO profiles VALUES (%s,%s,'user'),(%s,%s,'user'),(%s,%s,'user')", (uA, A, uM, A, uB, B))
sql("INSERT INTO user_permissions(user_id, modulo_manutencao) VALUES (%s,true)", (uM,))
sql("INSERT INTO ogs_reference(company_id, ogs_number) VALUES (%s,'1001'),(%s,'2002'),(%s,'9001')", (A, A, B))
EQ = {}
for fro, cat, comp in (("VB01", "VIBROACABADORA", A), ("VB02", "VIBROACABADORA", A), ("FR01", "FRESAGEM", A), ("RL01", "ROLO COMPACTADOR", A), ("VB99", "VIBROACABADORA", B)):
    EQ[fro] = sql("INSERT INTO equipamentos(company_id,frota,categoria_rdo) VALUES (%s,%s,%s) RETURNING id", (comp, fro, cat))[0]["id"]

def reset(): as_super(); sql("TRUNCATE equip_producao_vibro, equipment_production_areas, equipment_diaries CASCADE")
def diary(f, dia, period="noturno", ws="Trabalhando", ogs="1001", auto=False, status="enviado"):
    return sql("""INSERT INTO equipment_diaries(company_id,date,period,status,is_auto,work_status,ogs_number,equipment_fleet)
                  VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""", (A, dia, period, status, auto, ws, ogs, f))[0]["id"]
def area(d, c): sql("INSERT INTO equipment_production_areas(company_id,diary_id,length_m,width_m) VALUES (%s,%s,%s,3.5)", (A, d, c))
def apont(f, dia, t, turno="noturno", ogs="1001", by=uA):
    return sql("INSERT INTO equip_producao_vibro(company_id,equipamento_id,ogs_number,data,turno,toneladas,created_by) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
               (A, EQ[f], ogs, dia, turno, t, by))[0]["id"]
def prod(ini="2026-10-05", fim="2026-10-31", uid=uA, comp=A, ogs=None, eq=None):
    as_user(uid)
    try: return sql("SELECT * FROM equip_producao_periodo(%s,%s,%s,%s,%s)", (comp, ini, fim, ogs, EQ[eq] if eq else None))
    finally: as_super()

D = "2026-10-05"
# 1. Fresadora: soma de comprimentos de todas as frentes do diário, em metros
reset(); d = diary("FR01", D); area(d, 120.5); area(d, 80)
r = prod()
check("1 fresadora soma 200,5 m do diário (fonte diário, sem duplicar)", len(r) == 1 and r[0]["tipo"] == "fresadora" and float(r[0]["valor"]) == 200.5 and r[0]["unidade"] == "m" and r[0]["fonte"] == "diario" and r[0]["lancado"], r)
# 2. Fresadora trabalhou sem metragem: aparece como não lançado (valor NULL, não zero)
reset(); diary("FR01", D)
r = prod()
check("2 fresadora sem frentes: lancado=false e valor NULL", len(r) == 1 and r[0]["lancado"] is False and r[0]["valor"] is None, r)
# 3. Vibro: apontamento + dia trabalhado sem apontamento aparece como pendente
reset(); diary("VB01", D); diary("VB01", "2026-10-06"); apont("VB01", D, 312.45)
r = sorted(prod(), key=lambda x: x["data"])
check("3 vibro lançado: 312,45 t", r[0]["lancado"] and float(r[0]["valor"]) == 312.45 and r[0]["unidade"] == "t" and r[0]["fonte"] == "apontamento", r)
check("3 vibro dia trabalhado sem tonelada: pendente (NULL)", r[1]["lancado"] is False and r[1]["valor"] is None and len(r) == 2, r)
# 4. Apontamento sem diário no dia ainda aparece (produção lançada vale)
reset(); apont("VB01", D, 100)
r = prod()
check("4 apontamento sem diário no dia é listado", len(r) == 1 and float(r[0]["valor"]) == 100, r)
# 5. Outros equipamentos ficam de fora; diário automático/ não enviado / Disposição também
reset(); diary("RL01", D); diary("VB01", D, auto=True); diary("VB01", D, status="rascunho"); diary("FR01", D, ws="Disposição"); diary("FR01", D, ogs="")
check("5 só vibro/fresa de diários manuais enviados trabalhando e com OGS", prod() == [], prod())
# 6. Dois vibros na mesma obra e dia ficam separados
reset(); apont("VB01", D, 150); apont("VB02", D, 90)
r = prod()
check("6 dois vibros na mesma obra/dia separados", sorted(float(x["valor"]) for x in r) == [90, 150], r)
# 7. Filtros
reset(); apont("VB01", D, 1); apont("VB02", D, 2, ogs="2002"); d = diary("FR01", D); area(d, 10)
check("7 filtro obra", [x["ogs_number"] for x in prod(ogs="2002")] == ["2002"], "")
check("7 filtro equipamento", [x["frota"] for x in prod(eq="FR01")] == ["FR01"], "")
check("7 filtro período exclui fora", prod("2026-11-01", "2026-11-05") == [], "")
# 8. Unicidade e validações
reset(); apont("VB01", D, 10)
as_user(uA)
check("8 duplicidade (equip+obra+dia+turno) rejeitada", fails("INSERT INTO equip_producao_vibro(company_id,equipamento_id,ogs_number,data,turno,toneladas,created_by) VALUES (%s,%s,'1001',%s,'noturno',5,%s)", (A, EQ["VB01"], D, uA)) is not None, "")
as_user(uA)
e = fails("INSERT INTO equip_producao_vibro(company_id,equipamento_id,ogs_number,data,turno,toneladas,created_by) VALUES (%s,%s,'1001',%s,'diurno',5,%s)", (A, EQ["FR01"], D, uA))
check("8 só vibroacabadora recebe toneladas (fresadora rejeitada)", e is not None and "vibroacabadoras" in e, e)
as_user(uA)
check("8 tonelada negativa rejeitada", fails("INSERT INTO equip_producao_vibro(company_id,equipamento_id,ogs_number,data,turno,toneladas,created_by) VALUES (%s,%s,'1001',%s,'diurno',-1,%s)", (A, EQ["VB01"], D, uA)) is not None, "")
as_user(uA)
check("8 tonelada absurda (>5000) rejeitada", fails("INSERT INTO equip_producao_vibro(company_id,equipamento_id,ogs_number,data,turno,toneladas,created_by) VALUES (%s,%s,'1001',%s,'diurno',99999,%s)", (A, EQ["VB01"], D, uA)) is not None, "")
as_user(uA)
e = fails("INSERT INTO equip_producao_vibro(company_id,equipamento_id,ogs_number,data,turno,toneladas,created_by) VALUES (%s,%s,'9001',%s,'diurno',5,%s)", (A, EQ["VB01"], D, uA))
check("8 OGS de outra empresa rejeitada", e is not None and "OGS" in e, e)
as_user(uA)
e = fails("INSERT INTO equip_producao_vibro(company_id,equipamento_id,ogs_number,data,turno,toneladas,created_by) VALUES (%s,%s,'1001',%s,'diurno',5,%s)", (A, EQ["VB99"], D, uA))
check("8 vibro de outra empresa rejeitada", e is not None, e)
as_super()
# 9. Segurança
as_user(uB)
check("S1 outra empresa não lê apontamentos", sql("SELECT count(*) n FROM equip_producao_vibro")[0]["n"] == 0, "")
e = fails("SELECT * FROM equip_producao_periodo(%s,%s,%s)", (A, D, D))
check("S2 outra empresa não consulta produção da empresa A", e is not None and "Sem acesso" in e, e)
as_user(uB)
check("S3 não grava na empresa A", fails("INSERT INTO equip_producao_vibro(company_id,equipamento_id,ogs_number,data,turno,toneladas,created_by) VALUES (%s,%s,'1001',%s,'diurno',5,%s)", (A, EQ["VB01"], D, uB)) is not None, "")
as_super(); cur.execute("SET ROLE anon")
check("S4 anon não executa nem lê", fails("SELECT * FROM equip_producao_periodo(%s,%s,%s)", (A, D, D)) is not None, "")
as_user(uA)
check("S5 não forja autor", fails("INSERT INTO equip_producao_vibro(company_id,equipamento_id,ogs_number,data,turno,toneladas,created_by) VALUES (%s,%s,'1001',%s,'diurno',5,%s)", (A, EQ["VB02"], D, uM)) is not None, "")
# 10. Edição: autor sim, outro usuário comum não, gestão sim
reset(); pid = apont("VB01", D, 10, by=uA)
as_user(uA); check("10 autor corrige a própria tonelada", sql("UPDATE equip_producao_vibro SET toneladas=11 WHERE id=%s RETURNING id", (pid,)) != [], "")
as_user(uM); check("10 gestão corrige tonelada de outro autor", sql("UPDATE equip_producao_vibro SET toneladas=12 WHERE id=%s RETURNING id", (pid,)) != [], "")
as_super(); sql("UPDATE equip_producao_vibro SET created_by=%s", (uM,))
as_user(uA); check("10 usuário comum não altera de outro autor", sql("UPDATE equip_producao_vibro SET toneladas=1 WHERE id=%s RETURNING id", (pid,)) == [], "")
check("10 usuário comum não exclui de outro autor", sql("DELETE FROM equip_producao_vibro WHERE id=%s RETURNING id", (pid,)) == [], "")
as_super()

bad = [n for n, ok in results if not ok]
print(f"\n{len(results)-len(bad)}/{len(results)} verificações passaram"); srv.cleanup(); sys.exit(1 if bad else 0)
