import {
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import { useForm } from "@tanstack/react-form";
import { useHydrated } from "@tanstack/react-router";
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PeriodRangeValue = { startPeriod: string; endPeriod: string };

type PeriodRangePickerProps = {
  value: PeriodRangeValue;
  onChange: (value: PeriodRangeValue) => void;
  schema: z.ZodType<PeriodRangeValue, PeriodRangeValue>;
  maxMonths: number;
};

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function formatPeriod(period: string) {
  return formatDateInBrazil(periodToSafeInstant(period), {
    month: "short",
    year: "numeric",
  })
    .replace(" de ", "/")
    .replaceAll(".", "");
}

function toPeriod(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function periodToMonthNumber(period: string) {
  const [year = 0, month = 1] = period.split("-").map(Number);
  return year * 12 + month - 1;
}

function countMonths(range: PeriodRangeValue) {
  return periodToMonthNumber(range.endPeriod) - periodToMonthNumber(range.startPeriod) + 1;
}

function shiftPeriod(period: string, months: number) {
  const total = periodToMonthNumber(period) + months;
  return toPeriod(Math.floor(total / 12), total % 12);
}

function buildPresets(maxMonths: number) {
  const current = getCurrentPeriodInBrazil();
  const currentYear = Number(current.slice(0, 4));
  return [
    { label: "3 meses", range: { startPeriod: shiftPeriod(current, -2), endPeriod: current } },
    { label: "6 meses", range: { startPeriod: shiftPeriod(current, -5), endPeriod: current } },
    { label: "12 meses", range: { startPeriod: shiftPeriod(current, -11), endPeriod: current } },
    { label: "Este ano", range: { startPeriod: toPeriod(currentYear, 0), endPeriod: current } },
    {
      label: "Ano passado",
      range: {
        startPeriod: toPeriod(currentYear - 1, 0),
        endPeriod: toPeriod(currentYear - 1, 11),
      },
    },
  ].filter((preset) => countMonths(preset.range) <= maxMonths);
}

export function PeriodRangePicker(props: PeriodRangePickerProps) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={!hydrated}
        render={<Button type="button" variant="ghost" className="h-10 max-w-full" />}
      >
        <CalendarRange aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="font-normal text-muted-foreground">Período:</span>
        <span className="tabular-nums">
          {formatPeriod(props.value.startPeriod)} – {formatPeriod(props.value.endPeriod)}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Escolher período"
        className="w-72 max-w-[calc(100vw-2rem)]"
      >
        {open ? (
          <PeriodRangeForm
            key={`${props.value.startPeriod}:${props.value.endPeriod}`}
            {...props}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function PeriodRangeForm({
  value,
  onChange,
  schema,
  maxMonths,
  onClose,
}: PeriodRangePickerProps & {
  onClose: () => void;
}) {
  const id = useId();
  const [visibleYear, setVisibleYear] = useState(Number(value.endPeriod.slice(0, 4)));
  // Início já escolhido, aguardando o fim do intervalo.
  const [anchor, setAnchor] = useState<string | null>(null);
  const presets = buildPresets(maxMonths);
  const form = useForm({
    defaultValues: { startPeriod: value.startPeriod, endPeriod: value.endPeriod },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value: range }) => {
      onChange(range);
      onClose();
    },
  });

  function setRange(range: PeriodRangeValue) {
    form.setFieldValue("startPeriod", range.startPeriod);
    form.setFieldValue("endPeriod", range.endPeriod);
  }

  function selectPreset(range: PeriodRangeValue) {
    setAnchor(null);
    setRange(range);
    setVisibleYear(Number(range.endPeriod.slice(0, 4)));
  }

  function selectMonth(period: string) {
    if (anchor === null) {
      setAnchor(period);
      setRange({ startPeriod: period, endPeriod: period });
      return;
    }
    const [startPeriod, endPeriod] = anchor <= period ? [anchor, period] : [period, anchor];
    setAnchor(null);
    setRange({ startPeriod, endPeriod });
  }

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <p id={`${id}-hint`} className="sr-only">
        Clique no primeiro mês e depois no último, com até {maxMonths} meses.
      </p>

      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              size="xs"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => selectPreset(preset.range)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}

      <form.Subscribe selector={(state) => state.values}>
        {(range) => (
          <div className="grid gap-1">
            <div className="flex items-center justify-between">
              <Button
                aria-label="Ano anterior"
                onClick={() => setVisibleYear((year) => year - 1)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="font-medium text-sm tabular-nums">{visibleYear}</span>
              <Button
                aria-label="Próximo ano"
                onClick={() => setVisibleYear((year) => year + 1)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {MONTH_LABELS.map((label, index) => {
                const period = toPeriod(visibleYear, index);
                const isEdge = period === range.startPeriod || period === range.endPeriod;
                const inRange = period > range.startPeriod && period < range.endPeriod;
                const exceedsLimit =
                  anchor !== null &&
                  Math.abs(periodToMonthNumber(period) - periodToMonthNumber(anchor)) + 1 >
                    maxMonths;
                return (
                  <Button
                    key={period}
                    type="button"
                    aria-pressed={isEdge}
                    aria-label={formatPeriod(period)}
                    disabled={exceedsLimit}
                    onClick={() => selectMonth(period)}
                    size="sm"
                    variant={isEdge ? "default" : "ghost"}
                    className={cn("font-normal", inRange && "bg-accent")}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </form.Subscribe>

      <form.Subscribe selector={(state) => [state.values, state.isValid, state.canSubmit] as const}>
        {([range, isValid, canSubmit]) => {
          const months = countMonths(range);
          return (
            <div className="flex items-center justify-between gap-3">
              <p
                id={`${id}-error`}
                role="status"
                className={cn(
                  "min-w-0 text-xs tabular-nums",
                  isValid ? "text-muted-foreground" : "text-destructive",
                )}
              >
                {isValid
                  ? `${months} ${months === 1 ? "mês" : "meses"}`
                  : `Máximo de ${maxMonths} meses.`}
              </p>
              <Button type="submit" size="sm" disabled={!canSubmit || anchor !== null}>
                Aplicar
              </Button>
            </div>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
