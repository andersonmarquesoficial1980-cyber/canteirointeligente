import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText } from "lucide-react";

type Props = { text?: string | null; label: string };

/** Read-only meeting marker: hover/focus for desktop, click for touch devices. */
export function ProgramadorNote({ text, label }: Props) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  if (!text?.trim()) return null;
  return <span className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button ref={button} type="button" aria-label={`Observação de ${label}`} aria-expanded={open} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={() => setOpen(true)} className="inline-flex rounded p-0.5 text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <MessageSquareText aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
    {open && button.current && createPortal(<span role="tooltip"
      style={{ position: "fixed", top: button.current.getBoundingClientRect().top > 120 ? button.current.getBoundingClientRect().top - 6 : button.current.getBoundingClientRect().bottom + 6,
        left: Math.max(8, Math.min(button.current.getBoundingClientRect().left, window.innerWidth - 328)),
        transform: button.current.getBoundingClientRect().top > 120 ? "translateY(-100%)" : undefined }}
      className="z-[100] w-max max-w-[min(80vw,320px)] whitespace-pre-wrap rounded-md border border-border bg-card p-2 text-left text-xs font-normal text-foreground shadow-lg">{text}</span>, document.body)}
  </span>;
}
