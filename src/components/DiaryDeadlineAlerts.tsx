import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDiaryDeadlineAlerts, type DiaryDeadlineAlerts } from "@/hooks/useDiaryDeadlineAlerts";
import {
  compactRanges,
  expiryLabel,
  formatDayBR,
  type ExpiringDay,
  type FleetAlert,
} from "@/lib/diaryDeadlineAlerts";

function launchEquipmentUrl(f: FleetAlert, date: string) {
  const q = new URLSearchParams({ frota: f.fleet, data: date });
  if (f.equipmentType) q.set("tipo", f.equipmentType);
  return `/equipamentos/diario?${q.toString()}`;
}

function AlertsBody({ alerts, compact = false }: { alerts: DiaryDeadlineAlerts; compact?: boolean }) {
  const navigate = useNavigate();
  const { equipment, rdo } = alerts;

  const expiringFleets = equipment.filter((f) => f.expiring.length > 0);
  const blockedFleets = equipment
    .map((f) => ({ ...f, blocked: f.blocked.filter((b) => !b.unlocked) }))
    .filter((f) => f.blocked.length > 0);
  const unlockedFleets = equipment
    .map((f) => ({ ...f, blocked: f.blocked.filter((b) => b.unlocked) }))
    .filter((f) => f.blocked.length > 0);

  return (
    <div className="space-y-3">
      {(expiringFleets.length > 0 || rdo.length > 0) && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <Clock className="w-4 h-4 shrink-0" /> Prazo de lançamento vencendo
          </p>
          <p className="text-xs text-amber-900/80">
            O diário só pode ser lançado até 72h depois (hoje + 2 dias anteriores). Se o dia não teve serviço, lance
            como Folga/Disposição. Depois do prazo, o lançamento entra como retroativo (com justificativa).
          </p>
          {expiringFleets.map((f) => (
            <div key={f.fleet} className="text-xs text-amber-950 space-y-1">
              <p className="font-semibold">Diário de Equipamento — {f.fleet}</p>
              {f.expiring.map((e) => (
                <div key={e.date} className="flex items-center justify-between gap-2">
                  <span>
                    Dia <b>{formatDayBR(e.date)}</b> — {expiryLabel(e.daysLeft)}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(launchEquipmentUrl(f, e.date))}>
                    Lançar agora
                  </Button>
                </div>
              ))}
            </div>
          ))}
          {rdo.length > 0 && (
            <div className="text-xs text-amber-950 space-y-1">
              <p className="font-semibold">RDO (dias úteis)</p>
              {rdo.map((e: ExpiringDay) => (
                <div key={e.date} className="flex items-center justify-between gap-2">
                  <span>
                    Dia <b>{formatDayBR(e.date)}</b> — {expiryLabel(e.daysLeft)}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/obras/rdo?data=${e.date}`)}>
                    Lançar RDO
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {blockedFleets.length > 0 && (
        <section className="rounded-xl border border-orange-300 bg-orange-50 p-3 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-orange-900">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Dias sem diário (últimos 10 dias)
          </p>
          <p className="text-xs text-orange-900/80">
            Estes dias passaram do prazo de 72h. Você ainda pode lançar como retroativo, informando o motivo. Se o equipamento
            não trabalhou, lance como Folga/Disposição.
          </p>
          {blockedFleets.map((f) => (
            <div key={f.fleet} className="text-xs text-orange-950">
              <p className="font-semibold">{f.fleet}</p>
              <p>
                {f.blocked.length} {f.blocked.length === 1 ? "dia" : "dias"} sem diário:{" "}
                {compactRanges(f.blocked.map((b) => b.date)).join(", ")}
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => navigate(launchEquipmentUrl(f, f.blocked[0].date))}>
                Lançar retroativo
              </Button>
            </div>
          ))}
        </section>
      )}

      {!compact && unlockedFleets.length > 0 && (
        <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 space-y-1">
          <p className="text-sm font-bold text-emerald-900">Liberados pelo administrador — pode lançar</p>
          {unlockedFleets.map((f) => (
            <div key={f.fleet} className="flex items-center justify-between gap-2 text-xs text-emerald-950">
              <span>
                {f.fleet}: {compactRanges(f.blocked.map((b) => b.date)).join(", ")}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => navigate(launchEquipmentUrl(f, f.blocked[0].date))}
              >
                Lançar
              </Button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Faixa recolhível para Home / WF Equipamentos. Some quando não há pendência. */
export function DiaryDeadlineBanner() {
  const alerts = useDiaryDeadlineAlerts();
  const { hasAny, loading } = alerts;
  const [open, setOpen] = useState(true);
  if (loading || !hasAny) return null;
  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        className="w-full flex items-center justify-between rounded-xl border border-amber-400 bg-amber-100 px-3 py-2 text-left text-sm font-bold text-amber-950"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Você tem lançamentos pendentes
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <AlertsBody alerts={alerts} />}
    </div>
  );
}

const SESSION_KEY = "wf_diary_deadline_popup_seen";

/** Popup ao abrir o formulário (uma vez por sessão do navegador). */
export function DiaryDeadlineDialog({ enabled = true }: { enabled?: boolean }) {
  const alerts = useDiaryDeadlineAlerts();
  const { hasAny, loading } = alerts;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || loading || !hasAny) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* sessionStorage indisponível: mostra mesmo assim */
    }
    setOpen(true);
  }, [enabled, loading, hasAny]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atenção aos seus lançamentos</DialogTitle>
          <DialogDescription>Confira abaixo o que está vencendo ou ficou sem lançar.</DialogDescription>
        </DialogHeader>
        <AlertsBody alerts={alerts} compact />
        <Button onClick={() => setOpen(false)}>Entendi</Button>
      </DialogContent>
    </Dialog>
  );
}
