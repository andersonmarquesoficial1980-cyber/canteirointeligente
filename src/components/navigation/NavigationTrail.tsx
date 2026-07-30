import { ChevronRight } from "lucide-react";
import { NavigationTrailItem } from "@/hooks/useNavigationTrail";

interface NavigationTrailProps {
  trail: NavigationTrailItem[];
  onSelect: (path: string) => void;
  className?: string;
}

export function NavigationTrail({ trail, onSelect, className }: NavigationTrailProps) {
  if (!trail || trail.length === 0) return null;

  return (
    <div className={className || ""}>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/35">
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;
          return (
            <div key={item.path} className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onSelect(item.path)}
                className={[
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                  isLast
                    ? "bg-white/30 text-white border border-white/40"
                    : "bg-white/15 text-white/90 border border-white/20 hover:bg-white/25",
                ].join(" ")}
              >
                {item.label}
              </button>
              {!isLast && <ChevronRight className="w-3.5 h-3.5 text-white/70" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
