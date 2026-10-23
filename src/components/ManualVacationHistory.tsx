import { useState } from "react";
import { validatePastVacation } from "@/lib/vacationManualHistory";

export interface ManualHistoryPayload {
  start: string;
  end: string;
  kind: "individual" | "coletiva";
  source: string;
  acquisitionStart: string | null;
  acquisitionEnd: string | null;
  note: string;
}

export function ManualVacationHistory({ employee, today, existing, onClose, onSave }: {
  employee: { id: string; name: string; matricula: string | null; data_admissao: string | null };
  today: string;
  existing: { start: string; end: string }[];
  onClose: () => void;
  onSave: (entry: ManualHistoryPayload) => Promise<void>;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState<"individual" | "coletiva">("individual");
  const [source, setSource] = useState("");
  const [acquisitionStart, setAcquisitionStart] = useState("");
  const [acquisitionEnd, setAcquisitionEnd] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const validation = validatePastVacation({ start, end, kind, source, acquisitionStart, acquisitionEnd, admission: employee.data_admissao, existing, today });

  const field = (label: string, value: string, setter: (v: string) => void, type: "date" | "text" = "date") => (
    <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#374151" }}>
      {label}
      <input aria-label={label} type={type} value={value} onChange={(e) => setter(e.target.value)}
        style={{ height: 40, border: "1px solid #cbd5e1", borderRadius: 8, padding: "0 10px" }} />
    </label>
  );

  async function save() {
    if (saving || validation.errors.length) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ start, end, kind, source: source.trim(), acquisitionStart: acquisitionStart || null,
        acquisitionEnd: acquisitionEnd || null, note: note.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gravar o histórico.");
    } finally { setSaving(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Registrar férias já gozadas"
      style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: "18px 18px 0 0", padding: 22, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "#0A0F2C" }}>Registrar férias já gozadas</strong>
          <button aria-label="Fechar histórico" type="button" onClick={onClose} disabled={saving}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#475569" }}>{employee.name} · Mat. {employee.matricula || "—"}</p>
        <p style={{ fontSize: 12, padding: 10, background: "#fffbeb", color: "#92400e", borderRadius: 8 }}>
          Este lançamento não homologa saldo nem altera o status do funcionário. Se souber apenas a última saída, registre-a e deixe o período aquisitivo em branco; o RH poderá conciliar depois.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {field("Início do gozo", start, setStart)}
          {field("Fim do gozo", end, setEnd)}
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Tipo
          <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as "individual" | "coletiva")}
            style={{ height: 40, border: "1px solid #cbd5e1", borderRadius: 8 }}>
            <option value="individual">Individual</option><option value="coletiva">Coletiva</option>
          </select>
        </label>
        {field("Origem da informação", source, setSource, "text")}
        <p style={{ fontSize: 11, color: "#64748b" }}>Ex.: recibo assinado, documento do RH ou confirmação identificada.</p>
        <p style={{ fontSize: 12, fontWeight: 700 }}>Período aquisitivo (se conhecido)</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {field("Aquisitivo início", acquisitionStart, setAcquisitionStart)}
          {field("Aquisitivo fim", acquisitionEnd, setAcquisitionEnd)}
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Observação
          <textarea aria-label="Observação" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }} />
        </label>
        {start && end && validation.days > 0 && <p style={{ fontSize: 12 }}>{validation.days} dias corridos informados</p>}
        {start && end && validation.errors.map((message) => <p key={message} role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>{message}</p>)}
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        <button type="button" disabled={saving || validation.errors.length > 0} onClick={save}
          style={{ height: 44, border: 0, borderRadius: 10, color: "white", background: saving || validation.errors.length ? "#94a3b8" : "#0055AA", fontWeight: 700 }}>
          {saving ? "Salvando..." : "Salvar histórico"}
        </button>
      </div>
    </div>
  );
}
