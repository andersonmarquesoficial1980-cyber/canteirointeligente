import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Wrench, ChevronRight, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Equipamento {
  id: string;
  codigo_custo: string;
  placa: string;
  modelo: string;
  setor: string;
  categoria: string;
  locadora: string;
  valor_mensal: number;
  status: string;
  observacoes: string;
  tipo_veiculo: string;
}

const STATUS_COLOR: Record<string, string> = {
  ativo:          "bg-green-100 text-green-700",
  inativo:        "bg-red-100 text-red-600",
  em_manutencao:  "bg-yellow-100 text-yellow-700",
  devolvido:      "bg-gray-100 text-gray-500",
};

const TIPO_LABEL: Record<string, string> = {
  veiculo_leve: "Veículo Leve",
  utilitario:   "Utilitário",
  caminhao:     "Caminhão",
  carreta:      "Carreta",
  maquina:      "Máquina",
  van:          "Van",
  outro:        "Outro",
};

function formatBRL(v: number) {
  return v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—";
}

function TabelaEquipamentos({ items, totalLabel }: { items: Equipamento[]; totalLabel: string }) {
  const totalMensal = items.filter(i => i.categoria === "locado").reduce((s, i) => s + (i.valor_mensal || 0), 0);
  const terceiros = items.filter(i => i.categoria === "locado").length;
  const proprios = items.filter(i => i.categoria === "proprio").length;

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rdo-card py-2">
          <p className="text-lg font-display font-bold text-primary">{items.length}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="rdo-card py-2">
          <p className="text-lg font-display font-bold text-blue-600">{terceiros}</p>
          <p className="text-[10px] text-muted-foreground">Terceiros</p>
        </div>
        <div className="rdo-card py-2">
          <p className="text-lg font-display font-bold text-green-600">{proprios}</p>
          <p className="text-[10px] text-muted-foreground">Próprios</p>
        </div>
      </div>

      {totalMensal > 0 && (
        <div className="rdo-card border-l-4 border-l-orange-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold">Custo mensal com terceiros</span>
          </div>
          <span className="text-lg font-display font-bold text-orange-600">{formatBRL(totalMensal)}</span>
        </div>
      )}

      {/* Tabela */}
      <div className="rdo-card overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-primary/5 border-b border-border">
              <th className="text-left px-3 py-2 font-bold text-muted-foreground">Frota</th>
              <th className="text-left px-3 py-2 font-bold text-muted-foreground">Modelo</th>
              <th className="text-left px-3 py-2 font-bold text-muted-foreground">Status</th>
              <th className="text-left px-3 py-2 font-bold text-muted-foreground">Equipe</th>
              <th className="text-left px-3 py-2 font-bold text-muted-foreground">Empresa</th>
              <th className="text-right px-3 py-2 font-bold text-muted-foreground">Valor/mês</th>
              <th className="text-left px-3 py-2 font-bold text-muted-foreground">Obs</th>
            </tr>
          </thead>
          <tbody>
            {items.map((eq, i) => (
              <tr key={eq.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                <td className="px-3 py-2 font-bold">{eq.codigo_custo || eq.placa}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{eq.modelo}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLOR[eq.status] || STATUS_COLOR.ativo}`}>
                    {eq.status === "ativo" ? "Ativo" : eq.status === "em_manutencao" ? "Manutenção" : eq.status === "inativo" ? "Inativo" : "Devolvido"}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{eq.setor || "—"}</td>
                <td className="px-3 py-2">
                  {eq.categoria === "locado"
                    ? <span className="text-blue-600">{eq.locadora || "Locado"}</span>
                    : <span className="text-green-600">Próprio</span>}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-orange-600">
                  {eq.valor_mensal > 0 ? formatBRL(eq.valor_mensal) : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground max-w-[100px] truncate">{eq.observacoes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GestaoFrotasDashboard() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"equipe" | "tipo">("equipe");
  const [selecao, setSelecao] = useState("");

  useEffect(() => {
    supabase.from("frotas_gestao").select("*").order("setor,codigo_custo")
      .then(({ data }) => { if (data) setTodos(data); setLoading(false); });
  }, []);

  const equipes = [...new Set(todos.map(e => e.setor).filter(Boolean))].sort();
  const tipos = [...new Set(todos.map(e => e.tipo_veiculo).filter(Boolean))].sort();

  const itensFiltrados = selecao
    ? todos.filter(e => aba === "equipe" ? e.setor === selecao : e.tipo_veiculo === selecao)
    : [];

  const totalGeral = todos.filter(e => e.categoria === "locado").reduce((s, e) => s + (e.valor_mensal || 0), 0);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Dashboard de Frotas</span>
          <span className="block text-[11px] text-primary-foreground/80">
            {todos.length} equipamentos · Terceiros: <strong>{formatBRL(totalGeral)}/mês</strong>
          </span>
        </div>
      </header>

      {/* Abas */}
      <div className="flex border-b border-border bg-white">
        <button onClick={() => { setAba("equipe"); setSelecao(""); }}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${aba === "equipe" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Por Equipe
        </button>
        <button onClick={() => { setAba("tipo"); setSelecao(""); }}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${aba === "tipo" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
          <Wrench className="w-4 h-4" /> Por Tipo
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : (
          <>
            {/* Seletor */}
            {!selecao ? (
              <>
                <p className="text-xs text-muted-foreground font-semibold px-1">
                  {aba === "equipe" ? "Selecione a equipe:" : "Selecione o tipo de equipamento:"}
                </p>

                {/* Opção — ver todos */}
                <button onClick={() => setSelecao("__todos__")} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {aba === "equipe" ? <Users className="w-5 h-5 text-primary" /> : <Wrench className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-display font-bold text-sm">Todos</p>
                    <p className="text-xs text-muted-foreground">{todos.length} equipamentos · {formatBRL(totalGeral)}/mês</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </button>

                {(aba === "equipe" ? equipes : tipos).map(item => {
                  const itens = todos.filter(e => aba === "equipe" ? e.setor === item : e.tipo_veiculo === item);
                  const custo = itens.filter(e => e.categoria === "locado").reduce((s, e) => s + (e.valor_mensal || 0), 0);
                  return (
                    <button key={item} onClick={() => setSelecao(item)} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {aba === "equipe" ? <Users className="w-5 h-5 text-primary" /> : <Wrench className="w-5 h-5 text-primary" />}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-display font-bold text-sm">{aba === "tipo" ? (TIPO_LABEL[item] || item) : item}</p>
                        <p className="text-xs text-muted-foreground">
                          {itens.length} equipamento{itens.length !== 1 ? "s" : ""}
                          {custo > 0 && <span className="text-orange-600"> · {formatBRL(custo)}/mês</span>}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelecao("")} className="text-xs text-primary underline flex items-center gap-1">
                    ← Voltar
                  </button>
                  <span className="text-sm font-display font-bold">
                    {selecao === "__todos__" ? "Todos os Equipamentos" : (aba === "tipo" ? (TIPO_LABEL[selecao] || selecao) : selecao)}
                  </span>
                </div>
                <TabelaEquipamentos
                  items={selecao === "__todos__" ? todos : itensFiltrados}
                  totalLabel={selecao}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
