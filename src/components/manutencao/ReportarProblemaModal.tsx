import { useEffect, useMemo, useRef, useState } from "react";
import { useEquipamentos, type Equipamento } from "@/hooks/useEquipamentos";
import { TriangleAlert, X, Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onClose: () => void;
  /** Se omitido, o modal carrega o perfil do usuário logado. */
  profile?: { user_id: string; nome_completo?: string; email?: string; perfil?: string; role?: string; company_id?: string } | null;
  /** Origem gravada na ocorrência (default "encarregado"); o RDO Técnico usa "rdo_tecnico". */
  origem?: string;
  /** Frota já preenchida (ex.: equipamento citado no RDO). */
  frotaInicial?: string;
  /** Texto de contexto anexado à descrição (ex.: "RDO Técnico — OGS 2539 — 09/11/2026"). */
  contexto?: string;
}

async function uploadFoto(file: File): Promise<string | null> {
  const path = `equipamentos/ocorrencias/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("sst-fotos").upload(path, file, { upsert: true });
  if (error) return null;
  return supabase.storage.from("sst-fotos").getPublicUrl(path).data.publicUrl;
}

type PerfilModal = NonNullable<Props["profile"]>;

export default function ReportarProblemaModal({ onClose, profile: profileProp, origem = "encarregado", frotaInicial = "", contexto = "" }: Props) {
  const [profileCarregado, setProfileCarregado] = useState<PerfilModal | null>(null);
  const profile = profileProp ?? profileCarregado;
  useEffect(() => {
    if (profileProp !== undefined) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await (supabase as any).from("profiles").select("*").eq("user_id", user.id).maybeSingle();
        setProfileCarregado(data ? { ...data, user_id: user.id } : { user_id: user.id, email: user.email });
      } catch { /* sem perfil o botão de registrar fica desabilitado */ }
    })();
  }, [profileProp]);

  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { equipamentos, loading: carregandoFrotas } = useEquipamentos();
  const [buscaFrota, setBuscaFrota] = useState(frotaInicial);
  const [equip, setEquip] = useState<Equipamento | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const rotulo = (e: Equipamento) => `${e.frota}${e.nome || e.modelo_completo ? ` — ${e.nome || e.modelo_completo}` : ""}`;
  // frota pré-preenchida: seleciona quando a lista carregar
  useEffect(() => {
    if (!frotaInicial || equip) return;
    const achou = equipamentos.find(e => e.frota.toUpperCase() === frotaInicial.trim().toUpperCase());
    if (achou) { setEquip(achou); setBuscaFrota(rotulo(achou)); }
  }, [equipamentos]); // eslint-disable-line react-hooks/exhaustive-deps
  const sugestoes = useMemo(() => {
    const q = buscaFrota.trim().toLowerCase();
    const base = q ? equipamentos.filter(e => `${e.frota} ${e.nome || ""} ${e.modelo_completo || ""} ${e.placa || ""}`.toLowerCase().includes(q)) : equipamentos;
    return base.slice(0, 30);
  }, [equipamentos, buscaFrota]);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("OCORRÊNCIA");
  const [prioridade, setPrioridade] = useState("NORMAL");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim()) {
      toast({ title: "Informe o que aconteceu", variant: "destructive" });
      return;
    }
    if (buscaFrota.trim() && !equip) {
      toast({ title: "Escolha a frota na lista", description: "Selecione um equipamento cadastrado ou limpe o campo.", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      let fotoUrl = null;
      if (foto) fotoUrl = await uploadFoto(foto);

      const { error } = await (supabase as any).from("equipamentos_ocorrencias").insert({
        equipamento_id: equip?.id || null,
        company_id: profile?.company_id || null,
        frota: equip?.frota || null,
        titulo: titulo.trim(),
        descricao: [descricao.trim(), contexto ? `[${contexto}]` : ""].filter(Boolean).join("\n") || null,
        tipo,
        prioridade,
        status: "ABERTA",
        origem,
        solicitante_nome: profile?.nome_completo || profile?.email || "",
        solicitante_perfil: profile?.perfil || profile?.role || "",
        foto_url: fotoUrl,
        created_by: profile?.user_id,
      });

      if (!error) {
        toast({ title: "Ocorrência registrada!", description: "A equipe de manutenção foi notificada." });
        onClose();
      } else {
        toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TriangleAlert className="w-5 h-5 text-orange-500" />
            <h3 className="font-display font-bold text-base">Reportar Problema</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Frota — lista de equipamentos cadastrados */}
        <div className="space-y-1 relative">
          <Label className="text-xs text-muted-foreground">Frota do Equipamento (opcional)</Label>
          <input
            value={buscaFrota}
            onChange={e => { setBuscaFrota(e.target.value); setEquip(null); setListaAberta(true); }}
            onFocus={() => setListaAberta(true)}
            className={`w-full h-11 rounded-xl border bg-secondary px-3 text-sm ${equip ? "border-green-500" : "border-border"}`}
            placeholder={carregandoFrotas ? "Carregando frotas..." : "Busque por frota, nome ou placa"}
            aria-label="Frota do equipamento"
            autoComplete="off"
          />
          {listaAberta && !equip && (
            <ul role="listbox" className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-background shadow-lg">
              {sugestoes.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">{carregandoFrotas ? "Carregando..." : "Nenhuma frota cadastrada encontrada"}</li>}
              {sugestoes.map(e => (
                <li key={e.id} role="option" aria-selected={false} className="cursor-pointer px-3 py-2 text-sm hover:bg-secondary"
                  onMouseDown={ev => { ev.preventDefault(); setEquip(e); setBuscaFrota(rotulo(e)); setListaAberta(false); }}>
                  <span className="font-bold">{e.frota}</span>{e.nome || e.modelo_completo ? <span className="text-muted-foreground"> — {e.nome || e.modelo_completo}</span> : null}
                </li>
              ))}
            </ul>
          )}
          {equip && <p className="text-[11px] text-green-600">Equipamento vinculado: {rotulo(equip)}</p>}
        </div>

        {/* Título */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">O que aconteceu? *</Label>
          <input
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            className="w-full h-11 rounded-xl border border-border bg-secondary px-3 text-sm"
            placeholder="Ex: Motor fazendo barulho, vaza óleo..."
          />
        </div>

        {/* Descrição */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm min-h-[70px] resize-none"
            placeholder="Descreva melhor o problema..."
          />
        </div>

        {/* Tipo + Prioridade */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-secondary px-2 text-sm"
            >
              {["OCORRÊNCIA","FALHA MECÂNICA","PNEU","ELÉTRICA","VAZAMENTO","RUÍDO ANORMAL","MANUTENÇÃO PREVENTIVA","OUTRO"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prioridade</Label>
            <select
              value={prioridade}
              onChange={e => setPrioridade(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-secondary px-2 text-sm"
            >
              <option value="BAIXA">Baixa</option>
              <option value="NORMAL">Normal</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </div>
        </div>

        {/* Foto */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Foto (opcional)</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex-1 h-10 rounded-xl border border-border bg-secondary flex items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-muted"
            >
              <Camera className="w-4 h-4" /> Câmera
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 h-10 rounded-xl border border-border bg-secondary flex items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-muted"
            >
              <Upload className="w-4 h-4" /> Galeria
            </button>
          </div>
          {foto && <p className="text-xs text-green-600">📎 {foto.name}</p>}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setFoto(e.target.files?.[0] || null)} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFoto(e.target.files?.[0] || null)} />
        </div>

        <Button
          onClick={salvar}
          disabled={salvando || !titulo.trim() || !profile}
          className="w-full font-bold py-5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white"
        >
          {salvando ? "Registrando..." : "Registrar Ocorrência"}
        </Button>
      </div>
    </div>
  );
}
