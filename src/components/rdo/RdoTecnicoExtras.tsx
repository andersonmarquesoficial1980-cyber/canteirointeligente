import { Star } from "lucide-react";
import type { TechnicalExtrasForm } from "@/lib/rdoTecnicoExtras";

const labelCls = "block text-xs font-semibold text-muted-foreground mb-1";
const inputCls = "w-full h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";
const areaCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none";
export const sectionCls = "rounded-2xl bg-white border border-border p-4 space-y-4";

type Set = (field: string, value: unknown) => void;

function SimNao({ label, hint, value, onChange }: { label: string; hint?: string; value: "" | "sim" | "nao"; onChange: (v: "sim" | "nao") => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground -mt-0.5 mb-1.5">{hint}</p>}
      <div className="flex gap-3">
        {(["sim", "nao"] as const).map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${value === opt ? "bg-primary text-white border-primary" : "bg-background text-foreground border-border"}`}
          >{opt === "sim" ? "Sim" : "Não"}</button>
        ))}
      </div>
    </div>
  );
}

function Estrelas({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground -mt-0.5 mb-1.5">{hint}</p>}
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`} aria-pressed={value >= n}
            onClick={() => onChange(value === n ? 0 : n)} className="p-1 active:scale-95 transition-transform">
            <Star className={`w-8 h-8 ${value >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50"}`} />
          </button>
        ))}
        <span className="ml-2 text-xs font-semibold text-muted-foreground">{value ? `${value}/5` : "Sem nota"}</span>
      </div>
    </div>
  );
}

/** Retrabalho + nº do ofício (dentro da seção Produção). */
export function RetrabalhoFields({ form, set }: { form: { retrabalho: boolean; retrabalho_oficio: string }; set: Set }) {
  return (
    <>
      <div>
        <label className={labelCls}>Este serviço é retrabalho?</label>
        <div className="flex gap-3">
          {[true, false].map(opt => (
            <button key={String(opt)} type="button"
              onClick={() => { set("retrabalho", opt); if (!opt) set("retrabalho_oficio", ""); }}
              className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${form.retrabalho === opt ? "bg-primary text-white border-primary" : "bg-background text-foreground border-border"}`}
            >{opt ? "Sim" : "Não"}</button>
          ))}
        </div>
      </div>
      {form.retrabalho && (
        <div>
          <label className={labelCls}>Número do ofício *</label>
          <input value={form.retrabalho_oficio} onChange={e => set("retrabalho_oficio", e.target.value)} placeholder="Ex: 123/2026" className={inputCls} />
        </div>
      )}
    </>
  );
}

/** Caminhão basculante (exceto massa) — quantidade inteira. */
export function CaminhoesBasculanteField({ value, set }: { value: string; set: Set }) {
  return (
    <div>
      <label className={labelCls}>Caminhão Basculante (Exceto Massa) — quantidade</label>
      <input type="number" inputMode="numeric" min={0} step={1} value={value} onChange={e => set("qtd_caminhoes_basculante", e.target.value)} placeholder="0" className={inputCls} />
    </div>
  );
}

/** Seção "Apoio e Qualidade na Obra": autorização, sinalização e controle tecnológico. */
export function ApoioObraSection({ form, set }: { form: TechnicalExtrasForm; set: Set }) {
  return (
    <div className={sectionCls}>
      <h2 className="text-sm font-bold text-foreground">Apoio e Qualidade na Obra</h2>

      <SimNao label="A autorização para iniciar os trabalhos ocorreu dentro do horário previsto?" value={form.autorizacao_no_horario}
        onChange={v => { set("autorizacao_no_horario", v); if (v === "sim") set("autorizacao_atraso_detalhe", ""); }} />
      {form.autorizacao_no_horario === "nao" && (
        <div>
          <label className={labelCls}>Detalhes do atraso na autorização *</label>
          <textarea value={form.autorizacao_atraso_detalhe} onChange={e => set("autorizacao_atraso_detalhe", e.target.value)} rows={3}
            placeholder="Informe o horário previsto, o horário real e o motivo..." className={areaCls} />
        </div>
      )}

      <div className="border-t border-border" />

      <SimNao label="Equipe de sinalização presente na obra no horário programado?" value={form.sinalizacao_presente}
        onChange={v => { set("sinalizacao_presente", v); if (v === "nao") set("sinalizacao_nota", 0); }} />
      {form.sinalizacao_presente === "sim" && (
        <Estrelas label="Nível de qualidade, planejamento e disponibilidade da equipe de sinalização *"
          hint="5 estrelas = trabalho perfeito em qualidade, pontualidade, comunicação com a obra e velocidade na pintura."
          value={form.sinalizacao_nota} onChange={n => set("sinalizacao_nota", n)} />
      )}

      <div className="border-t border-border" />

      <SimNao label="Equipe de controle tecnológico esteve presente e no horário na obra hoje?" value={form.controle_tecnologico_presente}
        onChange={v => set("controle_tecnologico_presente", v)} />

      <div className="border-t border-border" />

      <Estrelas label="Qualidade da sinalização vertical (balizadores e placas) hoje *"
        value={form.sinalizacao_vertical_nota} onChange={n => set("sinalizacao_vertical_nota", n)} />
    </div>
  );
}
