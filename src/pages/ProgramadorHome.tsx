// WF Programador — Gestão de equipes, funcionários e equipamentos
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Wrench, UserPlus, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import logoCi from "@/assets/logo-workflux.png";

const STATUS_FUNC = ["TRABALHOU", "AFASTADO", "DISPOSIÇÃO", "FÉRIAS", "FALTA"];
const STATUS_EQUIP = ["OPERACIONAL", "MANUTENÇÃO", "INOPERANTE"];
const PERIODOS = ["NOTURNO", "DIURNO", "INTEGRAL"];

interface Equipe { id: string; nome: string; responsavel: string | null; }
interface Funcionario { id: string; name: string; matricula: string | null; role: string | null; }
interface Frota { id: string; frota: string; tipo: string; }
interface Ogs { ogs_number: string; client_name: string; location_address: string; }

type Aba = "equipes" | "funcionarios" | "equipamentos";
type ModoFunc = "status" | "transferencia" | "admissao" | "demissao";
type ModoEquip = "status" | "transferencia";

export default function ProgramadorHome() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aba, setAba] = useState<Aba>("equipes");
  const [saving, setSaving] = useState(false);

  // Dados de referência
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [frota, setFrota] = useState<Frota[]>([]);
  const [ogsList, setOgsList] = useState<Ogs[]>([]);

  // Form: Programação de equipe
  const [progData, setProgData] = useState(new Date().toISOString().split("T")[0]);
  const [progEquipe, setProgEquipe] = useState("");
  const [progOgs, setProgOgs] = useState("");
  const [progRua, setProgRua] = useState("");
  const [progCliente, setProgCliente] = useState("");
  const [progLocal, setProgLocal] = useState("");
  const [progPeriodo, setProgPeriodo] = useState("NOTURNO");
  const [progStatus, setProgStatus] = useState("TRABALHOU");
  const [progObs, setProgObs] = useState("");

  // Utilitário: divide endereços com ;
  const splitRuas = (address: string) => address.split(";").map(r => r.trim()).filter(Boolean);

  // Form: Movimentação funcionário
  const [modoFunc, setModoFunc] = useState<ModoFunc>("status");
  const [funcId, setFuncId] = useState("");
  const [funcNome, setFuncNome] = useState("");
  const [funcMatricula, setFuncMatricula] = useState("");
  const [funcData, setFuncData] = useState(new Date().toISOString().split("T")[0]);
  const [funcStatus, setFuncStatus] = useState("");
  const [funcEquipeOrig, setFuncEquipeOrig] = useState("");
  const [funcEquipeDest, setFuncEquipeDest] = useState("");
  const [funcFuncao, setFuncFuncao] = useState("");
  const [funcAdmissao, setFuncAdmissao] = useState("");
  const [funcObs, setFuncObs] = useState("");
  // Admissão: novo funcionário
  const [novoNome, setNovoNome] = useState("");
  const [novaMatricula, setNovaMatricula] = useState("");
  const [novaFuncao, setNovaFuncao] = useState("");
  const [novaEquipe, setNovaEquipe] = useState("");
  const [novaAdmissao, setNovaAdmissao] = useState(new Date().toISOString().split("T")[0]);
  const [novaObs, setNovaObs] = useState("");

  // Form: Movimentação equipamento
  const [modoEquip, setModoEquip] = useState<ModoEquip>("transferencia");
  const [equipFrota, setEquipFrota] = useState("");
  const [equipData, setEquipData] = useState(new Date().toISOString().split("T")[0]);
  const [equipStatus, setEquipStatus] = useState("");
  const [equipEquipeOrig, setEquipEquipeOrig] = useState("");
  const [equipEquipeDest, setEquipEquipeDest] = useState("");
  const [equipObs, setEquipObs] = useState("");

  useEffect(() => {
    (supabase as any).from("ci_equipes").select("*").eq("ativa", true).order("nome")
      .then(({ data }: any) => { if (data) setEquipes(data); });
    supabase.from("employees").select("id, name, matricula, role").order("name")
      .then(({ data }) => { if (data) setFuncionarios(data as Funcionario[]); });
    (supabase as any).from("maquinas_frota").select("id, frota, tipo").order("tipo").order("frota")
      .then(({ data }: any) => { if (data) setFrota(data); });
    (supabase as any).from("ogs_reference").select("ogs_number, client_name, location_address").order("ogs_number", { ascending: false })
      .then(({ data }: any) => { if (data) setOgsList(data); });
  }, []);

  const handleOgsChange = (ogs: string) => {
    setProgOgs(ogs);
    setProgRua("");
    const o = ogsList.find(o => o.ogs_number === ogs);
    if (o) {
      setProgCliente(o.client_name);
      const ruas = splitRuas(o.location_address);
      setProgLocal(ruas.length === 1 ? ruas[0] : o.location_address);
    }
  };

  const handleFuncSelect = (id: string) => {
    const f = funcionarios.find(f => f.id === id);
    setFuncId(id);
    setFuncNome(f?.name ?? "");
    setFuncMatricula(f?.matricula ?? "");
    setFuncFuncao(f?.role ?? "");
  };

  const equipeResponsavel = (nome: string) => equipes.find(e => e.nome === nome)?.responsavel ?? null;

  // SALVAR PROGRAMAÇÃO DE EQUIPE
  const salvarProgramacao = async () => {
    if (!progEquipe || !progData) return;
    setSaving(true);
    const equipeInfo = equipes.find(e => e.nome === progEquipe);
    const { error } = await (supabase as any).from("ci_programacoes").insert({
      data: progData, equipe: progEquipe,
      responsavel: equipeInfo?.responsavel,
      ogs: progOgs || null, cliente: progCliente || null,
      local: progRua || progLocal || null, periodo: progPeriodo,
      status_equipe: progStatus, obs: progObs || null,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "✅ Programação salva!" });
      setProgOgs(""); setProgCliente(""); setProgLocal(""); setProgObs("");
    }
    setSaving(false);
  };

  // SALVAR MOVIMENTAÇÃO FUNCIONÁRIO
  const salvarMovFunc = async () => {
    if (modoFunc === "admissao") {
      if (!novoNome || !novaMatricula || !novaFuncao || !novaEquipe) return;
      setSaving(true);
      const { error } = await (supabase as any).from("ci_mov_funcionarios").insert({
        data: novaAdmissao, tipo: "admissao",
        funcionario_nome: novoNome.toUpperCase(), matricula: novaMatricula,
        equipe_destino: novaEquipe, funcao: novaFuncao.toUpperCase(),
        data_admissao: novaAdmissao, obs: novaObs || null,
      });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "✅ Admissão registrada!" }); setNovoNome(""); setNovaMatricula(""); setNovaFuncao(""); setNovaEquipe(""); setNovaObs(""); }
      setSaving(false);
      return;
    }
    if (!funcNome) return;
    setSaving(true);
    const payload: any = {
      data: funcData, tipo: modoFunc,
      funcionario_id: funcId || null, funcionario_nome: funcNome,
      matricula: funcMatricula || null,
    };
    if (modoFunc === "status") payload.status = funcStatus;
    if (modoFunc === "transferencia") { payload.equipe_origem = funcEquipeOrig; payload.equipe_destino = funcEquipeDest; }
    if (modoFunc === "demissao") payload.obs = funcObs || null;
    payload.obs = funcObs || null;
    const { error } = await (supabase as any).from("ci_mov_funcionarios").insert(payload);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "✅ Movimentação registrada!" }); setFuncId(""); setFuncNome(""); setFuncMatricula(""); setFuncStatus(""); setFuncEquipeOrig(""); setFuncEquipeDest(""); setFuncObs(""); }
    setSaving(false);
  };

  // SALVAR MOVIMENTAÇÃO EQUIPAMENTO
  const salvarMovEquip = async () => {
    if (!equipFrota) return;
    setSaving(true);
    const frotaInfo = frota.find(f => f.frota === equipFrota);
    const payload: any = {
      data: equipData, tipo: modoEquip,
      frota: equipFrota, tipo_equipamento: frotaInfo?.tipo || null,
      obs: equipObs || null,
    };
    if (modoEquip === "status") payload.status = equipStatus;
    if (modoEquip === "transferencia") {
      payload.equipe_origem = equipEquipeOrig;
      payload.equipe_destino = equipEquipeDest;
      payload.responsavel_destino = equipeResponsavel(equipEquipeDest);
    }
    const { error } = await (supabase as any).from("ci_mov_equipamentos").insert(payload);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "✅ Movimentação registrada!" }); setEquipFrota(""); setEquipStatus(""); setEquipEquipeOrig(""); setEquipEquipeDest(""); setEquipObs(""); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img src={logoCi} alt="CI" className="w-10 h-10 rounded-full border-2 border-white/30 shadow-md" />
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-white">WF Programador</h1>
            <p className="text-xs text-white/70">Equipes · Funcionários · Equipamentos</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card sticky top-[68px] z-40">
        {([
          { id: "equipes", label: "Equipes", icon: Calendar },
          { id: "funcionarios", label: "Funcionários", icon: Users },
          { id: "equipamentos", label: "Equipamentos", icon: Wrench },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-bold transition-colors border-b-2 ${
              aba === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-5 pb-10 space-y-4">

        {/* ── ABA EQUIPES ── */}
        {aba === "equipes" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Programe uma equipe inteira de uma vez. Todos os funcionários da equipe receberão essa localização.</p>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Data *</Label>
                  <Input type="date" value={progData} onChange={e => setProgData(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Período</Label>
                  <Select value={progPeriodo} onValueChange={setProgPeriodo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PERIODOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Equipe *</Label>
                <Select value={progEquipe} onValueChange={setProgEquipe}>
                  <SelectTrigger><SelectValue placeholder="Selecione a equipe" /></SelectTrigger>
                  <SelectContent>{equipes.map(e => <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
                {progEquipe && equipeResponsavel(progEquipe) && (
                  <p className="text-xs text-muted-foreground pl-1">Responsável: {equipeResponsavel(progEquipe)}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Status da equipe</Label>
                <Select value={progStatus} onValueChange={setProgStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_FUNC.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>OGS</Label>
                <Select value={progOgs} onValueChange={handleOgsChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione a OGS" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEM_OGS">Sem OGS</SelectItem>
                    {ogsList.map(o => <SelectItem key={o.ogs_number} value={o.ogs_number}>OGS {o.ogs_number} — {o.client_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Rua específica se OGS tiver múltiplos endereços */}
              {progOgs && (() => {
                const o = ogsList.find(o => o.ogs_number === progOgs);
                const ruas = o ? splitRuas(o.location_address) : [];
                if (ruas.length <= 1) return progCliente ? <p className="text-xs text-muted-foreground">📍 {progLocal}</p> : null;
                return (
                  <div className="space-y-1.5">
                    <Label>Rua específica</Label>
                    <Select value={progRua} onValueChange={v => { setProgRua(v); setProgLocal(v); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione a rua" /></SelectTrigger>
                      <SelectContent>{ruas.map((r, i) => <SelectItem key={i} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea rows={2} value={progObs} onChange={e => setProgObs(e.target.value)} placeholder="Opcional..." />
              </div>

              <Button onClick={salvarProgramacao} disabled={saving || !progEquipe || !progData}
                className="w-full bg-header-gradient text-white font-bold rounded-xl hover:opacity-90">
                {saving ? "Salvando..." : "✅ Salvar Programação"}
              </Button>
            </div>
          </div>
        )}

        {/* ── ABA FUNCIONÁRIOS ── */}
        {aba === "funcionarios" && (
          <div className="space-y-4">
            {/* Tipo de movimentação */}
            <div className="flex gap-2 flex-wrap">
              {([
                { id: "status", label: "Mudar Status" },
                { id: "transferencia", label: "Transferir" },
                { id: "admissao", label: "Admissão" },
                { id: "demissao", label: "Demissão" },
              ] as const).map(m => (
                <button key={m.id} onClick={() => setModoFunc(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    modoFunc === m.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">

              {/* ADMISSÃO — campos diferentes */}
              {modoFunc === "admissao" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Nome completo *</Label>
                    <Input placeholder="NOME DO FUNCIONÁRIO" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="uppercase" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Matrícula *</Label>
                      <Input placeholder="000000" value={novaMatricula} onChange={e => setNovaMatricula(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de admissão *</Label>
                      <Input type="date" value={novaAdmissao} onChange={e => setNovaAdmissao(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Função *</Label>
                    <Input placeholder="FUNÇÃO" value={novaFuncao} onChange={e => setNovaFuncao(e.target.value)} className="uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Equipe *</Label>
                    <Select value={novaEquipe} onValueChange={setNovaEquipe}>
                      <SelectTrigger><SelectValue placeholder="Selecione a equipe" /></SelectTrigger>
                      <SelectContent>{equipes.map(e => <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea rows={2} value={novaObs} onChange={e => setNovaObs(e.target.value)} placeholder="Opcional..." />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Data *</Label>
                    <Input type="date" value={funcData} onChange={e => setFuncData(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Funcionário *</Label>
                    <Select value={funcId} onValueChange={handleFuncSelect}>
                      <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                      <SelectContent>
                        {funcionarios.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.matricula ? `[${f.matricula}] ` : ""}{f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {modoFunc === "status" && (
                    <div className="space-y-1.5">
                      <Label>Novo status *</Label>
                      <Select value={funcStatus} onValueChange={setFuncStatus}>
                        <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                        <SelectContent>{STATUS_FUNC.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {modoFunc === "transferencia" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>De</Label>
                        <Select value={funcEquipeOrig} onValueChange={setFuncEquipeOrig}>
                          <SelectTrigger><SelectValue placeholder="Equipe atual" /></SelectTrigger>
                          <SelectContent>{equipes.map(e => <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Para</Label>
                        <Select value={funcEquipeDest} onValueChange={setFuncEquipeDest}>
                          <SelectTrigger><SelectValue placeholder="Nova equipe" /></SelectTrigger>
                          <SelectContent>{equipes.map(e => <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {modoFunc === "demissao" && (
                    <p className="text-xs text-destructive font-medium">⚠️ Registrará demissão para {funcNome || "o funcionário selecionado"}</p>
                  )}

                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea rows={2} value={funcObs} onChange={e => setFuncObs(e.target.value)} placeholder="Opcional..." />
                  </div>
                </>
              )}

              <Button onClick={salvarMovFunc}
                disabled={saving || (modoFunc === "admissao" ? (!novoNome || !novaMatricula || !novaFuncao || !novaEquipe) : !funcNome)}
                className="w-full bg-header-gradient text-white font-bold rounded-xl hover:opacity-90">
                {saving ? "Salvando..." : `✅ Registrar ${modoFunc === "admissao" ? "Admissão" : modoFunc === "demissao" ? "Demissão" : "Movimentação"}`}
              </Button>
            </div>
          </div>
        )}

        {/* ── ABA EQUIPAMENTOS ── */}
        {aba === "equipamentos" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {([
                { id: "transferencia", label: "Transferir" },
                { id: "status", label: "Mudar Status" },
              ] as const).map(m => (
                <button key={m.id} onClick={() => setModoEquip(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    modoEquip === m.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" value={equipData} onChange={e => setEquipData(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Equipamento (Frota) *</Label>
                <Select value={equipFrota} onValueChange={setEquipFrota}>
                  <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                  <SelectContent>
                    {frota.map(f => <SelectItem key={f.id} value={f.frota}>{f.frota} — {f.tipo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {modoEquip === "status" && (
                <div className="space-y-1.5">
                  <Label>Novo status *</Label>
                  <Select value={equipStatus} onValueChange={setEquipStatus}>
                    <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                    <SelectContent>{STATUS_EQUIP.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {modoEquip === "transferencia" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>De</Label>
                    <Select value={equipEquipeOrig} onValueChange={setEquipEquipeOrig}>
                      <SelectTrigger><SelectValue placeholder="Equipe atual" /></SelectTrigger>
                      <SelectContent>{equipes.map(e => <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Para</Label>
                    <Select value={equipEquipeDest} onValueChange={setEquipEquipeDest}>
                      <SelectTrigger><SelectValue placeholder="Nova equipe" /></SelectTrigger>
                      <SelectContent>{equipes.map(e => <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {equipEquipeDest && equipeResponsavel(equipEquipeDest) && (
                <p className="text-xs text-muted-foreground pl-1">Responsável destino: {equipeResponsavel(equipEquipeDest)}</p>
              )}

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea rows={2} value={equipObs} onChange={e => setEquipObs(e.target.value)} placeholder="Opcional..." />
              </div>

              <Button onClick={salvarMovEquip} disabled={saving || !equipFrota}
                className="w-full bg-header-gradient text-white font-bold rounded-xl hover:opacity-90">
                {saving ? "Salvando..." : "✅ Registrar Movimentação"}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
