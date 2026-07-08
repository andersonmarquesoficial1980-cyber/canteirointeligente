/**
 * WF Dashboards — Hub de seleção
 * Tela principal de escolha do dashboard para exibir nas TVs.
 * Design: Dark, premium, com cards animados.
 */
import { useNavigate } from "react-router-dom";
import { HardHat, Wrench, Truck, Monitor, Maximize2, ArrowLeft, LayoutDashboard } from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";

interface DashOption {
  id: string;
  route: string;
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
  audience: string;
  badge?: string;
}

const DASHBOARDS: DashOption[] = [
  {
    id: "obras",
    route: "/wf-dashboards/obras",
    title: "Obras & RDOs",
    subtitle: "Dashboard da Presidência",
    description: "Obras ativas, andamento, RDOs do dia, cancelamentos e tendências dos últimos 30 dias.",
    icon: HardHat,
    color: "#6366f1",
    gradient: "from-indigo-600/20 to-purple-600/10",
    audience: "🏛️ Sala da Presidência",
    badge: "Sala Exec.",
  },
  {
    id: "manutencao",
    route: "/wf-dashboards/manutencao",
    title: "Manutenção",
    subtitle: "Dashboard da Diretoria",
    description: "OS abertas, prioridades urgentes, documentos vencendo e equipamentos inoperantes.",
    icon: Wrench,
    color: "#f97316",
    gradient: "from-orange-600/20 to-red-600/10",
    audience: "🔧 Diretoria de Manutenção",
    badge: "Operacional",
  },
  {
    id: "frota",
    route: "/wf-dashboards/frota",
    title: "Frota & Equipamentos",
    subtitle: "Dashboard de Equipamentos",
    description: "Status em tempo real, equipamentos mais utilizados, abastecimento do dia e alertas da frota.",
    icon: Truck,
    color: "#10b981",
    gradient: "from-emerald-600/20 to-teal-600/10",
    audience: "🚜 Engenharia / Campo",
    badge: "Frota",
  },
];

export default function WFDashboards() {
  const navigate = useNavigate();

  const openFullscreen = (route: string) => {
    navigate(route);
    // Tenta entrar em fullscreen após navegar
    setTimeout(() => {
      document.documentElement.requestFullscreen?.();
    }, 300);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/admin/configuracoes")}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={logoCi} alt="Workflux" className="h-8 opacity-90" />
          <div className="w-px h-8 bg-white/20" />
          <div>
            <h1 className="text-white font-black text-xl leading-none flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-indigo-400" />
              WF Dashboards
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Painéis para TVs — tempo real, sem login</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Monitor className="w-4 h-4" />
          {DASHBOARDS.length} dashboards disponíveis
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 px-8 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Instrução */}
          <div className="mb-10 text-center">
            <h2 className="text-white text-2xl font-black mb-3">Escolha o dashboard para esta TV</h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto">
              Cada dashboard é otimizado para telas grandes, com atualização automática a cada minuto.
              Clique em <strong className="text-white">Abrir em Tela Cheia</strong> para usar na TV.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DASHBOARDS.map((d) => {
              const Icon = d.icon;
              return (
                <div key={d.id}
                  className={`relative rounded-2xl border border-white/10 p-6 cursor-pointer group transition-all duration-300 hover:border-white/20 hover:scale-[1.02] bg-gradient-to-br ${d.gradient}`}
                  style={{ background: `linear-gradient(135deg, ${d.color}15, transparent)` }}>

                  {/* Badge */}
                  {d.badge && (
                    <div className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                      style={{ color: d.color, borderColor: `${d.color}44`, background: `${d.color}15` }}>
                      {d.badge}
                    </div>
                  )}

                  {/* Ícone */}
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                    style={{ background: `${d.color}22` }}>
                    <Icon className="w-7 h-7" style={{ color: d.color }} />
                  </div>

                  {/* Texto */}
                  <div className="mb-2">
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{d.subtitle}</p>
                    <h3 className="text-white font-black text-xl mt-0.5">{d.title}</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-5">{d.description}</p>

                  {/* Audiência */}
                  <div className="rounded-xl px-3 py-2 mb-5 border border-white/10"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-slate-300 text-xs font-medium">{d.audience}</p>
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(d.route)}
                      className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all hover:brightness-110"
                      style={{ color: d.color, borderColor: `${d.color}44`, background: `${d.color}15` }}>
                      Ver Dashboard
                    </button>
                    <button
                      onClick={() => openFullscreen(d.route)}
                      className="py-2.5 px-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5"
                      style={{ background: d.color, color: "#fff" }}>
                      <Maximize2 className="w-3.5 h-3.5" />
                      TV
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dica de TV */}
          <div className="mt-10 rounded-2xl border border-white/10 p-6"
            style={{ background: "rgba(255,255,255,0.03)" }}>
            <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-indigo-400" /> Como usar nas TVs
            </h3>
            <div className="grid grid-cols-3 gap-6 text-sm text-slate-400">
              <div>
                <p className="text-white text-xs font-bold mb-1">1. Abrir o link</p>
                <p className="text-xs">No computador da TV, acesse app.workflux.com.br e navegue até WF Dashboards</p>
              </div>
              <div>
                <p className="text-white text-xs font-bold mb-1">2. Tela cheia</p>
                <p className="text-xs">Clique em "TV" ou pressione F11 para ativar modo tela cheia no navegador</p>
              </div>
              <div>
                <p className="text-white text-xs font-bold mb-1">3. Atualização automática</p>
                <p className="text-xs">Os dados se atualizam automaticamente a cada 60 segundos, sem precisar recarregar</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
