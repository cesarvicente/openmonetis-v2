import { useId } from "react";
import { cn } from "@/lib/utils";

/** Escolha de um número pequeno de espaços, como colunas ou linhas do mosaico. */
export function DashboardSpanPicker({
  className,
  context,
  disabled,
  label,
  max,
  min,
  onChange,
  value,
}: {
  className?: string;
  /** Complementa o rótulo para leitores de tela quando há vários seletores iguais. */
  context?: string;
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  const name = useId();
  const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <fieldset className={cn("flex min-w-0 items-center gap-2", className)} disabled={disabled}>
      <legend className="sr-only">{context ? `${label} de ${context}` : label}</legend>
      <span aria-hidden="true" className="text-muted-foreground text-xs">
        {label}
      </span>
      <div className="flex rounded-md bg-muted p-0.5">
        {options.map((option) => (
          <label
            className="relative grid h-7 min-w-8 cursor-pointer place-items-center rounded-sm font-medium text-muted-foreground text-xs tabular-nums transition-colors hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-3 has-focus-visible:ring-ring/50 max-md:h-11 max-md:min-w-11"
            key={option}
          >
            <input
              checked={option === value}
              className="absolute inset-0 cursor-pointer opacity-0"
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
