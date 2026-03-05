import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  icon: React.ReactNode;
}

interface RdoStepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export default function RdoStepIndicator({ steps, currentStep }: RdoStepIndicatorProps) {
  return (
    <div className="flex items-center justify-between gap-1 px-2 py-4">
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary text-primary-foreground ring-4 ring-primary/30 scale-110",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="w-5 h-5" /> : i + 1}
            </div>
            <span className={cn(
              "text-[10px] text-center leading-tight max-w-[60px]",
              active ? "text-primary font-semibold" : "text-muted-foreground"
            )}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
