import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileSearch, ChevronRight, Clock } from "lucide-react";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useSmartBack } from "@/hooks/useSmartBack";

export default function GestaoPessoasPontoPdf() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const origem = searchParams.get("origem") || "";
  const goBack = useSmartBack(origem === "gestao-frotas" ? "/gestao-frotas" : "/");

  const withContext = (path: string) => {
    const [pathname, queryString = ""] = path.split("?");
    const params = new URLSearchParams(queryString);
    if (origem) params.set("origem", origem);
    const returnToParams = new URLSearchParams(location.search);
    returnToParams.delete("returnTo");
    const returnToBase = `${location.pathname}${returnToParams.toString() ? `?${returnToParams.toString()}` : ""}`;
    params.set("returnTo", returnToBase);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">Conferência de Ponto (PDF RH)</span>
          <span className="block text-[10px] text-primary-foreground/70">Fluxo oficial atual da Fremix com PDF do PontoMais</span>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
          <p className="text-sm font-semibold text-indigo-900">✅ Fluxo operacional (atual)</p>
          <ul className="mt-2 text-xs text-indigo-900/90 list-disc pl-5 space-y-1">
            <li>1) RH envia PDFs do PontoMais.</li>
            <li>2) Importar no Workflux para análise.</li>
            <li>3) Validar período, batidas e divergências antes de usar no fechamento.</li>
          </ul>
        </section>

        <button
          onClick={() => navigate(withContext("/rh/conferencia-ponto-pdf"))}
          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors text-left w-full"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500/20 text-indigo-600">
            <FileSearch className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">Análise de Jornada por PDF</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground font-semibold">PontoMais</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Importar PDF, auditar batidas e revisar divergências por colaborador/dia.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-sm font-semibold text-amber-900">🔜 Separado da trilha de implantação</p>
          <p className="text-xs text-amber-900/90 mt-1">
            O registro e gerenciamento de ponto direto pelo app Workflux continuam em área própria de implantação.
          </p>
          <button
            onClick={() => navigate(withContext("/gestao-pessoas/gerenciamento-ponto"))}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-50"
          >
            <Clock className="w-4 h-4" />
            Abrir área de implantação do Ponto Workflux
          </button>
        </section>
      </div>
    </div>
  );
}
