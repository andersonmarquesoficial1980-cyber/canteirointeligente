/**
 * /carreteiros/qrcodes
 * Gera QR Codes para impressão — um por caminhão.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer, Search, Truck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import logoCi from "@/assets/logo-workflux.png";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const BASE_URL = "https://app.workflux.com.br";

interface TruckReg {
  id: string;
  placa: string;
  modelo: string | null;
  fornecedor: string | null;
  capacidade_m3: number | null;
}

export default function CarreteirosQRPrint() {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState<TruckReg[]>([]);
  const [filtro, setFiltro] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("truck_registry").select("*").eq("company_id", COMPANY_ID).order("placa")
      .then(({ data }) => { if (data) setTrucks(data as any); setLoading(false); });
  }, []);

  const filtrados = trucks.filter(t =>
    !filtro || t.placa.toLowerCase().includes(filtro.toLowerCase()) || (t.fornecedor || "").toLowerCase().includes(filtro.toLowerCase())
  );

  function toggleSelect(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelecionados(new Set(filtrados.map(t => t.id)));
  }

  function clearAll() {
    setSelecionados(new Set());
  }

  function imprimir() {
    window.print();
  }

  const paraImprimir = trucks.filter(t => selecionados.has(t.id));

  return (
    <div className="min-h-screen bg-background">
      {/* Header — não aparece na impressão */}
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md print:hidden">
        <button onClick={() => navigate("/carreteiros")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">QR Codes — Carreteiros</span>
          <span className="block text-[10px] text-primary-foreground/70">{trucks.length} caminhões</span>
        </div>
        {selecionados.size > 0 && (
          <button onClick={imprimir}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition rounded-lg px-3 py-1.5 text-xs font-bold">
            <Printer size={14} /> Imprimir ({selecionados.size})
          </button>
        )}
      </header>

      {/* Controles — não aparecem na impressão */}
      <div className="print:hidden" style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
            <input placeholder="Buscar placa ou fornecedor..." value={filtro} onChange={e => setFiltro(e.target.value)}
              style={{ width: "100%", paddingLeft: 32, height: 38, borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box" as any }} />
          </div>
          <button onClick={selectAll} style={{ fontSize: 12, fontWeight: 700, color: "#0055AA", background: "none", border: "none", cursor: "pointer" }}>Todos</button>
          <button onClick={clearAll} style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>Limpar</button>
        </div>

        {loading ? <p style={{ textAlign: "center", color: "#9ca3af" }}>Carregando...</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {filtrados.map(t => (
              <div key={t.id} onClick={() => toggleSelect(t.id)}
                style={{ background: selecionados.has(t.id) ? "#e8f0ff" : "white", border: `2px solid ${selecionados.has(t.id) ? "#0055AA" : "#e5e7eb"}`, borderRadius: 12, padding: 12, cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                <Truck size={20} color={selecionados.has(t.id) ? "#0055AA" : "#9ca3af"} style={{ margin: "0 auto 6px" }} />
                <p style={{ fontSize: 14, fontWeight: 800, color: selecionados.has(t.id) ? "#0055AA" : "#1e293b" }}>{t.placa}</p>
                <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{t.fornecedor || "—"}</p>
              </div>
            ))}
          </div>
        )}

        {selecionados.size === 0 && (
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 20 }}>Selecione os caminhões para gerar os QR Codes</p>
        )}
      </div>

      {/* Área de impressão */}
      <div ref={printRef} style={{ display: paraImprimir.length > 0 ? "block" : "none" }}
        className="print:block">
        <style>{`
          @media print {
            @page { size: A6 landscape; margin: 8mm; }
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: fixed; top: 0; left: 0; width: 100%; }
            .qr-card { page-break-after: always; }
          }
        `}</style>
        <div className="print-area" style={{ padding: 8 }}>
          {paraImprimir.map(t => (
            <div key={t.id} className="qr-card" style={{
              width: "10.5cm", minHeight: "14.8cm", margin: "0 auto",
              border: "3px solid #0A0F2C", borderRadius: 12, padding: 20,
              textAlign: "center", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              background: "white", pageBreakInside: "avoid"
            }}>
              {/* Logo */}
              <img src={logoCi} alt="" style={{ height: 36, marginBottom: 4 }} />
              {/* QR Code grande */}
              <QRCodeSVG
                value={`${BASE_URL}/carreteiros/scan/${t.id}`}
                size={260}
                bgColor="white"
                fgColor="#0A0F2C"
                level="M"
              />
              {/* Placa grande */}
              <p style={{ fontSize: 32, fontWeight: 900, color: "#0A0F2C", fontFamily: "Montserrat", letterSpacing: 2, margin: 0 }}>{t.placa}</p>
              {t.fornecedor && <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{t.fornecedor}</p>}
              {t.capacidade_m3 && (
                <p style={{ fontSize: 13, color: "#374151", fontWeight: 700, margin: 0 }}>Cap: {t.capacidade_m3} m³</p>
              )}
              <p style={{ fontSize: 10, color: "#d1d5db", marginTop: 4 }}>WF Carreteiros • app.workflux.com.br</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
