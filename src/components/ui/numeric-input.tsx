/**
 * NumericInput — Input numérico pt-BR
 * - Aceita vírgula como separador decimal
 * - Bloqueia espaço, letras e caracteres especiais
 * - Não permite duas vírgulas/pontos
 * - Usa onValueChange para retornar o número parseado
 */
import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { numericKeyHandler } from "@/lib/fmt";

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  /** Callback com o valor numérico parseado (null se vazio) */
  onValueChange?: (value: number | null) => void;
  /** Callback com a string digitada (para controle de state de display) */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, onValueChange, onChange, onKeyDown, ...props }, ref) => {
    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
      const raw = e.target.value;
      // Passa a string pro onChange normal (para o react-hook-form ou state local)
      onChange?.(e);
      // Parseia e emite o número
      if (onValueChange) {
        if (raw === "" || raw === "," || raw === ".") {
          onValueChange(null);
        } else {
          const parsed = parseFloat(raw.replace(",", "."));
          onValueChange(isNaN(parsed) ? null : parsed);
        }
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      numericKeyHandler(e);
      onKeyDown?.(e);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";
