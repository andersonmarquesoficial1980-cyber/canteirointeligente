import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Camera, Trash2, ChevronDown, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoCi from "@/assets/logo-workflux.png";
import jsPDF from "jspdf";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

interface OgsRef { id: string; ogs_number: string; client_name: string; location_address: string; }
interface Employee { id: string; name: string; role: string; }

// ─── Componente OGS Select ─────────────────────────────────────────────────
function OgsSelect({ value, onChange, onSelect }: { value: string; onChange: (v: string) => void; onSelect: (o: OgsRef) => void }) {
  const [lista, setLista] = useState<OgsRef[]>([]);
  const [filtrados, setFiltrados] = useState<OgsRef[]>([]);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("ogs_reference").select("*").order("ogs_number", { ascending: false })
      .then(({ data }) => { if (data) setLista(data as any); });
  }, []);

  useEffect(() => {
    if (!value) { setFiltrados(lista.slice(0, 20)); return; }
    setFiltrados(lista.filter(o => o.ogs_number?.toLowerCase().includes(value.toLowerCase()) || o.client_name?.toLowerCase().includes(value.toLowerCase())).slice(0, 20));
  }, [value, lista]);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          placeholder="Selecione ou digite a OGS..."
          style={{ width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "0 36px 0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" as any }}
        />
        <ChevronDown size={16} color="#9ca3af" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      </div>
      {aberto && filtrados.length > 0 && (
        <div style={{ position: "absolute", top: 44, left: 0, right: 0, background: "white", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 50, maxHeight: 220, overflowY: "auto" }}>
          {filtrados.map(o => (
            <div key={o.id} onClick={() => { onSelect(o); onChange(o.ogs_number); setAberto(false); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "white"; }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{o.ogs_number}</p>
              <p style={{ fontSize: 11, color: "#9ca3af" }}>{o.client_name} {o.location_address ? `· ${o.location_address}` : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente Assinatura Digital ───────────────────────────────────────────
function SignaturePad({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image();
      img.onload = () => canvasRef.current?.getContext("2d")?.drawImage(img, 0, 0);
      img.src = value;
    }
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const touch = (e as React.TouchEvent).touches?.[0];
    const client = touch || (e as React.MouseEvent);
    return { x: client.clientX - rect.left, y: client.clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    lastPos.current = pos;
  }

  function stopDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = false;
    onChange(canvasRef.current?.toDataURL("image/png") || "");
  }

  function limpar() {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{label}</label>
        <button type="button" onClick={limpar} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Limpar</button>
      </div>
      <canvas
        ref={canvasRef} width={340} height={120}
        style={{ width: "100%", height: 120, border: "1.5px solid #e5e7eb", borderRadius: 10, background: "white", touchAction: "none" }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
      />
      {value ? <p style={{ fontSize: 10, color: "#22c55e", marginTop: 3 }}>✓ Assinatura registrada</p>
        : <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>Assine acima com o dedo ou caneta</p>}
    </div>
  );
}

// ─── Componente Responsavel Select (usa tabela sst_responsaveis) ───────────────────────────────
function ResponsavelSelect({ value, onChange, placeholder, cargo }: { value: string; onChange: (v: string) => void; placeholder?: string; cargo: string }) {
  const [lista, setLista] = useState<{id:string; nome:string; cargo:string}[]>([]);
  const [filtrados, setFiltrados] = useState<{id:string; nome:string; cargo:string}[]>([]);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("sst_responsaveis" as any).select("id,nome,cargo").eq("company_id", COMPANY_ID).eq("cargo", cargo).eq("ativo", true).order("nome")
      .then(({ data }) => { if (data) setLista(data as any); });
  }, [cargo]);

  useEffect(() => {
    if (!value) { setFiltrados(lista.slice(0, 30)); return; }
    setFiltrados(lista.filter(e => e.nome.toLowerCase().includes(value.toLowerCase())).slice(0, 30));
  }, [value, lista]);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input value={value} onChange={e => { onChange(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)}
          placeholder={placeholder || "Selecione..."}
          style={{ width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "0 36px 0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" as any }} />
        <ChevronDown size={16} color="#9ca3af" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      </div>
      {aberto && filtrados.length > 0 && (
        <div style={{ position: "absolute", top: 44, left: 0, right: 0, background: "white", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 50, maxHeight: 220, overflowY: "auto" }}>
          {filtrados.map(e => (
            <div key={e.id} onClick={() => { onChange(e.nome); setAberto(false); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
              onMouseEnter={ev => { ev.currentTarget.style.background = "#f0f7ff"; }}
              onMouseLeave={ev => { ev.currentTarget.style.background = "white"; }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{e.nome}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
type Status3 = "conforme" | "nao_conforme" | "nao_aplica";

const STATUS_OPTS: { value: Status3; label: string; cor: string; bg: string }[] = [
  { value: "conforme", label: "✓ Conforme", cor: "#16a34a", bg: "#dcfce7" },
  { value: "nao_conforme", label: "✗ Não Conforme", cor: "#dc2626", bg: "#fee2e2" },
  { value: "nao_aplica", label: "— N/A", cor: "#6b7280", bg: "#f3f4f6" },
];

function StatusToggle({ value, onChange }: { value: Status3; onChange: (v: Status3) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {STATUS_OPTS.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: `1.5px solid ${value === o.value ? o.cor : "#e5e7eb"}`,
            background: value === o.value ? o.bg : "white", color: value === o.value ? o.cor : "#9ca3af",
            fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: "#0055AA", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #e5e7eb",
  padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box"
};

const taStyle: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb",
  padding: "10px 12px", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box"
};

const EPIs = [
  { key: "epi_capacete", label: "Capacete" },
  { key: "epi_oculos", label: "Óculos de Proteção" },
  { key: "epi_protetor_auricular", label: "Protetor Auricular" },
  { key: "epi_luvas", label: "Luvas" },
  { key: "epi_bota", label: "Bota de Segurança" },
  { key: "epi_colete", label: "Colete Refletivo" },
  { key: "epi_cinto", label: "Cinto de Segurança" },
  { key: "epi_mascara", label: "Máscara / Respirador" },
];

const CHECKLIST_SEG = [
  { key: "seg_sinalizacao", label: "Sinalização adequada?" },
  { key: "seg_isolamento", label: "Isolamento de área?" },
  { key: "seg_extintores", label: "Extintores disponíveis?" },
  { key: "seg_maquinas", label: "Máquinas inspecionadas?" },
  { key: "seg_apr", label: "APR OK?" },
  { key: "seg_dds", label: "DDS realizado?" },
  { key: "seg_primeiros_socorros", label: "Itens de primeiros socorros?" },
];

export default function SSTForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id || id === "nova";
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [form, setForm] = useState<Record<string, any>>({
    nome_obra: "", cliente: "", endereco: "", local_obra: "",
    engenheiro_obra: "", encarregado_obra: "", tecnico_responsavel: "", administrativo: "",
    data_inspecao: today, horario: nowTime,
    qtd_colaboradores: 0, qtd_terceiros: 0,
    epi_capacete: "nao_aplica", epi_oculos: "nao_aplica", epi_protetor_auricular: "nao_aplica",
    epi_luvas: "nao_aplica", epi_bota: "nao_aplica", epi_colete: "nao_aplica",
    epi_cinto: "nao_aplica", epi_mascara: "nao_aplica", epi_obs: "",
    seg_sinalizacao: "nao_aplica", seg_isolamento: "nao_aplica", seg_extintores: "nao_aplica",
    seg_maquinas: "nao_aplica", seg_apr: "nao_aplica", seg_dds: "nao_aplica",
    seg_primeiros_socorros: "nao_aplica", seg_obs: "",
    nao_conformidades: "", fotos: [], // [{url, legenda, lat, lng}]
    ass_tecnico_img: "", ass_engenheiro_img: "",
    status: "rascunho",
  });

  useEffect(() => {
    if (!isNew) {
      supabase.from("sst_inspections").select("*").eq("id", id).single()
        .then(({ data }) => { if (data) setForm(data as any); setLoading(false); });
    }
  }, [id, isNew]);

  function set(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Capturar geolocalização
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}
    const path = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("sst-fotos").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("sst-fotos").getPublicUrl(path);
      set("fotos", [...(form.fotos || []), { url: data.publicUrl, legenda: "", lat, lng }]);
    }
  }

  function updateFoto(i: number, field: string, value: string) {
    const novas = [...(form.fotos || [])];
    novas[i] = { ...novas[i], [field]: value };
    set("fotos", novas);
  }

  async function salvar(status: "rascunho" | "concluido") {
    if (!form.nome_obra.trim()) { alert("Informe o nome da obra."); return; }
    setSaving(true);
    const payload = { ...form, company_id: COMPANY_ID, status, updated_at: new Date().toISOString() };
    delete payload.id;
    delete payload.created_at;

    let error;
    if (isNew) {
      ({ error } = await supabase.from("sst_inspections").insert(payload));
    } else {
      ({ error } = await supabase.from("sst_inspections").update(payload).eq("id", id));
    }
    setSaving(false);
    if (!error) navigate("/sst");
    else alert("Erro ao salvar: " + error.message);
  }

  async function gerarPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const margin = 15;
    let y = 15;

    function fmtDate(d: string) { if (!d) return "-"; const [yr,m,day]=d.split("-"); return `${day}/${m}/${yr}`; }

    // Cabeçalho
    doc.setFillColor(0, 85, 170);
    doc.rect(0, 0, W, 18, "F");
    doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
    doc.text("RELATÓRIO FOTOGRÁFICO", margin, 12);
    doc.setFontSize(9); doc.setFont("helvetica","normal");
    doc.text(`Período: ${fmtDate(form.data_inspecao)}   Hora: ${form.horario || "-"}`, W - margin, 12, { align: "right" });
    y = 25;

    // Dados da obra
    doc.setTextColor(0,0,0);
    doc.setFillColor(240,247,255); doc.rect(margin, y-5, W-margin*2, 28, "F");
    doc.setFontSize(9); doc.setFont("helvetica","bold");
    doc.text("DADOS DA OBRA", margin+2, y);
    doc.setFont("helvetica","normal"); doc.setFontSize(8);
    y += 5;
    doc.text(`OGS: ${form.nome_obra || "-"}`, margin+2, y);
    doc.text(`Cliente: ${form.cliente || "-"}`, W/2, y);
    y += 5;
    doc.text(`Endereço: ${form.endereco || "-"}`, margin+2, y);
    y += 5;
    const campos = [
      ["Engenheiro", form.engenheiro_obra],
      ["Encarregado", form.encarregado_obra],
      ["Técnico SST", form.tecnico_responsavel],
      ["Administrativo", form.administrativo],
    ];
    campos.forEach(([label, val], i) => {
      const x = margin + (i % 2) * (W/2 - margin);
      if (i % 2 === 0 && i > 0) y += 5;
      doc.setFont("helvetica","bold"); doc.text(`${label}: `, x, y);
      doc.setFont("helvetica","normal"); doc.text(val || "-", x + doc.getTextWidth(`${label}: `), y);
    });
    y += 12;

    // Fotos - 2 por linha
    const fotos: any[] = form.fotos || [];
    if (fotos.length === 0) {
      doc.setFontSize(10); doc.text("Nenhuma foto registrada.", margin, y);
    } else {
      const fotoW = (W - margin*2 - 8) / 2;
      const fotoH = fotoW * 0.65;
      let fl = 1;

      for (let i = 0; i < fotos.length; i += 2) {
        if (y + fotoH + 20 > 280) {
          doc.addPage();
          // Repete cabeçalho
          doc.setFillColor(0,85,170); doc.rect(0,0,W,18,"F");
          doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
          doc.text("RELATÓRIO FOTOGRÁFICO", margin, 12);
          doc.setFontSize(9); doc.setFont("helvetica","normal");
          doc.text(`Fl.: ${doc.getCurrentPageInfo().pageNumber} / ?`, W-margin, 12, {align:"right"});
          doc.setTextColor(0,0,0);
          y = 25;
        }

        for (let col = 0; col < 2; col++) {
          const fi = i + col;
          if (fi >= fotos.length) break;
          const foto = fotos[fi];
          const url = foto.url || foto;
          const legenda = foto.legenda || "";
          const lat = foto.lat; const lng = foto.lng;
          const x = margin + col * (fotoW + 8);

          // Número da foto
          doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(0,85,170);
          doc.text(`Foto ${fl++}`, x, y - 1);
          doc.setTextColor(0,0,0);

          try {
            const img = await loadImageAsDataUrl(url);
            doc.addImage(img, "JPEG", x, y, fotoW, fotoH);
          } catch { doc.rect(x, y, fotoW, fotoH); doc.text("Foto", x+2, y+fotoH/2); }

          let ly = y + fotoH + 3;
          if (legenda) {
            doc.setFontSize(7.5); doc.setFont("helvetica","normal");
            const lines = doc.splitTextToSize(legenda, fotoW);
            doc.text(lines, x, ly); ly += lines.length * 3.5;
          }
          if (lat && lng) {
            doc.setFontSize(6.5); doc.setTextColor(100,100,100);
            doc.text(`GPS: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`, x, ly);
            doc.setTextColor(0,0,0);
          }
        }
        y += fotoH + 20;
      }
    }

    const nomeArq = `SST_${form.nome_obra || 'relatorio'}_${form.data_inspecao}.pdf`;
    doc.save(nomeArq);
  }

  function loadImageAsDataUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { const c = document.createElement("canvas"); c.width=img.width; c.height=img.height; c.getContext("2d")!.drawImage(img,0,0); resolve(c.toDataURL("image/jpeg",0.85)); };
      img.onerror = reject; img.src = url;
    });
  }

  if (loading) return <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>Carregando...</div>;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/sst")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">{isNew ? "Nova Inspeção SST" : "Editar Inspeção"}</span>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>

        {/* 1. Dados da Obra */}
        <Section title="1. Dados da Obra">
          <Field label="OGS (OBRA) *">
            <OgsSelect
              value={form.nome_obra}
              onChange={v => set("nome_obra", v)}
              onSelect={o => { set("nome_obra", o.ogs_number); set("cliente", o.client_name || ""); set("endereco", o.location_address || ""); }}
            />
          </Field>
          <Field label="CLIENTE">
            <input style={{...inputStyle, background: form.cliente ? "#f8fafc" : "white"}} value={form.cliente} onChange={e => set("cliente", e.target.value)} placeholder="Preenchido automaticamente pela OGS" />
          </Field>
          <Field label="ENDEREÇO">
            <input style={{...inputStyle, background: form.endereco ? "#f8fafc" : "white"}} value={form.endereco} onChange={e => set("endereco", e.target.value)} placeholder="Preenchido automaticamente pela OGS" />
          </Field>
          {/* LOCAL: só aparece se OGS tem múltiplos locais */}
          {form.endereco && form.endereco.includes(";") && (
            <Field label="LOCAL">
              <select value={form.local_obra} onChange={e => set("local_obra", e.target.value)}
                style={{ width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, padding: "0 12px", background: "white" }}>
                <option value="">Selecione o local...</option>
                {form.endereco.split(";").map((loc: string) => loc.trim()).filter(Boolean).map((loc: string) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="ENGENHEIRO DA OBRA">
            <ResponsavelSelect value={form.engenheiro_obra} onChange={v => set("engenheiro_obra", v)} placeholder="Selecione o engenheiro..." cargo="engenheiro" />
          </Field>
          <Field label="ENCARREGADO DA OBRA">
            <ResponsavelSelect value={form.encarregado_obra} onChange={v => set("encarregado_obra", v)} placeholder="Selecione o encarregado..." cargo="encarregado" />
          </Field>
          <Field label="TÉCNICO/SST RESPONSÁVEL">
            <ResponsavelSelect value={form.tecnico_responsavel} onChange={v => set("tecnico_responsavel", v)} placeholder="Selecione o técnico SST..." cargo="tecnico_sst" />
          </Field>
          <Field label="ADMINISTRATIVO RESPONSÁVEL">
            <ResponsavelSelect value={form.administrativo} onChange={v => set("administrativo", v)} placeholder="Selecione o administrativo..." cargo="administrativo" />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="DATA DA INSPEÇÃO"><input type="date" style={inputStyle} value={form.data_inspecao} onChange={e => set("data_inspecao", e.target.value)} /></Field>
            <Field label="HORÁRIO"><input type="time" style={inputStyle} value={form.horario} onChange={e => set("horario", e.target.value)} /></Field>
          </div>
        </Section>

        {/* 2. Efetivo */}
        <Section title="2. Efetivo da Obra">
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="COLABORADORES">
              <input type="number" min="0" style={inputStyle} value={form.qtd_colaboradores} onChange={e => set("qtd_colaboradores", parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="TERCEIROS">
              <input type="number" min="0" style={inputStyle} value={form.qtd_terceiros} onChange={e => set("qtd_terceiros", parseInt(e.target.value) || 0)} />
            </Field>
          </div>
        </Section>

        {/* 3. EPIs */}
        <Section title="3. Verificação de EPIs">
          {EPIs.map(epi => (
            <div key={epi.key} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{epi.label}</p>
              <StatusToggle value={form[epi.key] as Status3} onChange={v => set(epi.key, v)} />
            </div>
          ))}
          <Field label="OBSERVAÇÕES">
            <textarea style={taStyle} rows={3} value={form.epi_obs} onChange={e => set("epi_obs", e.target.value)} placeholder="Observações sobre EPIs..." />
          </Field>
        </Section>

        {/* 4. Segurança */}
        <Section title="4. Verificação de Segurança da Obra">
          {CHECKLIST_SEG.map(item => (
            <div key={item.key} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{item.label}</p>
              <StatusToggle value={form[item.key] as Status3} onChange={v => set(item.key, v)} />
            </div>
          ))}
          <Field label="OBSERVAÇÕES">
            <textarea style={taStyle} rows={3} value={form.seg_obs} onChange={e => set("seg_obs", e.target.value)} placeholder="Observações de segurança..." />
          </Field>
        </Section>

        {/* 5. Não conformidades + Fotos */}
        <Section title="5. Não Conformidades">
          <Field label="DESCRIÇÃO">
            <textarea style={taStyle} rows={4} value={form.nao_conformidades} onChange={e => set("nao_conformidades", e.target.value)} placeholder="Descreva as não conformidades encontradas..." />
          </Field>
        </Section>

        {/* 5b. Relatório Fotográfico */}
        <Section title="Relatório Fotográfico">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(form.fotos || []).map((foto: any, i: number) => (
              <div key={i} style={{ background: "#f8fafc", borderRadius: 12, padding: 12, position: "relative" }}>
                <button type="button" onClick={() => set("fotos", form.fotos.filter((_: any, j: number) => j !== i))}
                  style={{ position: "absolute", top: 8, right: 8, background: "#ef4444", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trash2 size={12} color="white" />
                </button>
                <img src={foto.url || foto} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
                <input
                  value={foto.legenda || ""}
                  onChange={e => updateFoto(i, "legenda", e.target.value)}
                  placeholder="Legenda da foto..."
                  style={{ ...inputStyle, fontSize: 12 }}
                />
                {(foto.lat || foto.lng) && (
                  <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>📍 {Number(foto.lat).toFixed(6)}, {Number(foto.lng).toFixed(6)}</p>
                )}
              </div>
            ))}
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 12, border: "2px dashed #0055AA", cursor: "pointer", color: "#0055AA", fontWeight: 700, fontSize: 13 }}>
              <Camera size={18} /> Adicionar Foto
              <input type="file" accept="image/*" capture="environment" onChange={handleUploadFoto} style={{ display: "none" }} />
            </label>
          </div>
        </Section>

        {/* 6. Assinaturas Digitais */}
        <Section title="6. Assinaturas">
          <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>Assine com o dedo ou caneta do tablet</p>
          <SignaturePad
            label="TÉCNICO DE SEGURANÇA"
            value={form.ass_tecnico_img}
            onChange={v => set("ass_tecnico_img", v)}
          />
          <SignaturePad
            label="ENGENHEIRO RESPONSÁVEL"
            value={form.ass_engenheiro_img}
            onChange={v => set("ass_engenheiro_img", v)}
          />
        </Section>

      </div>

      {/* Botões fixos */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", padding: "12px 16px", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)", display: "flex", gap: 8, maxWidth: 760, margin: "0 auto" }}>
        <button type="button" disabled={saving} onClick={() => salvar("rascunho")}
          style={{ flex: 1, height: 46, borderRadius: 12, border: "2px solid #0055AA", background: "white", color: "#0055AA", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Rascunho
        </button>
        {!isNew && (form.fotos || []).length > 0 && (
          <button type="button" onClick={gerarPDF}
            style={{ flex: 1, height: 46, borderRadius: 12, border: "2px solid #f97316", background: "white", color: "#f97316", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <FileText size={15} /> Gerar PDF
          </button>
        )}
        <button type="button" disabled={saving} onClick={() => salvar("concluido")}
          style={{ flex: 2, height: 46, borderRadius: 12, background: saving ? "#9ca3af" : "#0055AA", color: "white", fontWeight: 700, fontSize: 13, border: "none", cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Save size={16} /> {saving ? "Salvando..." : "Concluir"}
        </button>
      </div>
    </div>
  );
}
