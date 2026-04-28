import { useEffect, useRef, useState } from "react";

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  lastSync: string | null;
}

export default function OfflineIndicator({
  isOnline,
  pendingCount,
  syncing,
  lastSync,
}: OfflineIndicatorProps) {
  const [showSynced, setShowSynced] = useState(false);
  const prevSyncing = useRef(syncing);

  useEffect(() => {
    const justFinishedSync = prevSyncing.current && !syncing;
    prevSyncing.current = syncing;

    if (justFinishedSync && isOnline && pendingCount === 0) {
      setShowSynced(true);
      const timer = window.setTimeout(() => setShowSynced(false), 3000);
      return () => window.clearTimeout(timer);
    }

    if (!isOnline || syncing || pendingCount > 0) {
      setShowSynced(false);
    }

    return undefined;
  }, [isOnline, pendingCount, syncing, lastSync]);

  if (!(!isOnline || syncing || pendingCount > 0 || showSynced)) {
    return null;
  }

  let label = "🟢 Sincronizado";
  let bgClass = "bg-emerald-600";

  if (!isOnline) {
    label = `🔴 Offline — ${pendingCount} lançamentos pendentes`;
    bgClass = "bg-red-600";
  } else if (syncing) {
    label = "🟡 Sincronizando...";
    bgClass = "bg-amber-500";
  } else if (pendingCount > 0) {
    label = `🟡 ${pendingCount} lançamentos pendentes`;
    bgClass = "bg-amber-500";
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[70] flex justify-center px-3 py-2 pointer-events-none">
      <div className={`${bgClass} text-white text-sm font-semibold rounded-full px-4 py-2 shadow-lg`}>
        {label}
      </div>
    </div>
  );
}
