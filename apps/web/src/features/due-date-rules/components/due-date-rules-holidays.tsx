import { getCurrentYearInBrazil } from "@openmonetis/shared/date-time";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDueDate, nationalHolidayLabels } from "../due-date-rules.presentation";
import { dueDateRuleHolidaysQueryOptions } from "../due-date-rules.queries";

export function DueDateRulesHolidays({ included }: { included: boolean }) {
  const [year, setYear] = useState(getCurrentYearInBrazil);
  const holidays = useQuery(dueDateRuleHolidaysQueryOptions(year));
  return (
    <details className="group min-w-0 rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 font-medium text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span>
          {included
            ? "Feriados nacionais considerados"
            : "Feriados nacionais disponíveis (desativados)"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="grid gap-4 border-t px-4 py-4">
        <nav
          aria-label="Navegação por ano dos feriados nacionais"
          className="flex w-fit items-center gap-1 rounded-lg border bg-background p-1 shadow-xs"
        >
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={year <= 2000}
            aria-label="Ano anterior"
            onClick={() => setYear(year - 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <span
            className="min-w-14 text-center font-medium text-sm tabular-nums"
            aria-live="polite"
          >
            {year}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={year >= 2100}
            aria-label="Próximo ano"
            onClick={() => setYear(year + 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </nav>
        {holidays.isPending ? (
          <p className="text-muted-foreground text-sm">Carregando feriados…</p>
        ) : holidays.isError ? (
          <div className="grid justify-items-start gap-2">
            <p role="alert" className="text-destructive text-sm">
              Não foi possível carregar os feriados.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void holidays.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {holidays.data.items.map((holiday) => (
              <li
                key={holiday.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-3 border-b py-2 text-sm last:border-b-0"
              >
                <time className="text-muted-foreground tabular-nums" dateTime={holiday.date}>
                  {formatDueDate(holiday.date)}
                </time>
                <span className="wrap-break-word">{nationalHolidayLabels[holiday.id]}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t pt-3 text-muted-foreground text-xs leading-relaxed">
          Esta é a lista usada no cálculo. Carnaval, Sexta-feira Santa e Corpus Christi não estão
          incluídos automaticamente; adicione essas datas se desejar considerá-las.
        </p>
      </div>
    </details>
  );
}
