import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ProgramadorNote } from "@/components/ProgramadorNote";

export function ProgramadorNoteEditor({ label, note, onSave, disabled }: {
  label: string; note?: string; onSave: (text: string) => Promise<void>; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!open) setDraft(note || ""); }, [note, open]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try { await onSave(draft); setOpen(false); }
    catch (cause) { setError((cause as Error).message || "Falha ao salvar observação"); }
    finally { setSaving(false); }
  };
  return <>
    <span className="inline-flex items-center gap-1">
      <ProgramadorNote text={note} label={label} />
      <button type="button" disabled={disabled} className="text-primary hover:underline disabled:opacity-50"
        aria-label={`${note ? "Editar" : "Adicionar"} observação de ${label}`} onClick={() => { setError(""); setDraft(note || ""); setOpen(true); }}>
        {note ? "Editar observação" : "Observação"}
      </button>
    </span>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Observação operacional · {label}</DialogTitle>
          <DialogDescription>Visível para quem acessa o Programador, inclusive na apresentação. Não inclua dados sensíveis de RH.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Textarea aria-label={`Observação operacional de ${label}`} maxLength={1000} value={draft} onChange={e => setDraft(e.target.value)} rows={4} />
          <p className="text-xs text-muted-foreground">{draft.length}/1000 · Deixe vazio para remover a indicação; o histórico permanece registrado.</p>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar observação"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
