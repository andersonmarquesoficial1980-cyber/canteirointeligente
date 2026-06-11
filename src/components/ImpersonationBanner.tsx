import { getImpersonationState, stopImpersonation } from "@/hooks/useImpersonation";
import { useState } from "react";

export function ImpersonationBanner() {
  const state = getImpersonationState();
  const [loading, setLoading] = useState(false);

  if (!state?.active) return null;

  const handleStop = async () => {
    setLoading(true);
    await stopImpersonation();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black flex items-center justify-between px-4 py-2 text-sm font-medium shadow-lg">
      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span>Visualizando como: <strong>{state.targetName}</strong> ({state.targetEmail})</span>
      </div>
      <button
        onClick={handleStop}
        disabled={loading}
        className="flex items-center gap-1.5 bg-black/20 hover:bg-black/30 px-3 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-60"
      >
        {loading ? (
          <span className="w-3 h-3 inline-block animate-spin border-2 border-black border-t-transparent rounded-full" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        )}
        Voltar para Admin
      </button>
    </div>
  );
}
