import type { RecurringTransactionsSearch } from "@openmonetis/validators/recurring-transactions";
import { Search } from "lucide-react";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Input } from "@/components/ui/input";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";

const statusLabels = {
  active: "Ativas",
  paused: "Pausadas",
  ended: "Encerradas",
  all: "Todas as situações",
} as const;
export function RecurringTransactionsFilters({
  search,
  onChange,
}: {
  search: RecurringTransactionsSearch;
  onChange: (patch: Partial<RecurringTransactionsSearch>) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
      <Select
        value={search.status}
        onValueChange={(value) => {
          if (value && value in statusLabels)
            onChange({ status: value as RecurringTransactionsSearch["status"] });
        }}
      >
        <SelectTrigger aria-label="Situação das recorrências" className="w-full sm:w-44">
          <SelectValue>{statusLabels[search.status]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(statusLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={search.paymentMethod}
        onValueChange={(value) => {
          if (value === "all" || (value && value in paymentMethodLabels))
            onChange({ paymentMethod: value as RecurringTransactionsSearch["paymentMethod"] });
        }}
      >
        <SelectTrigger aria-label="Meio de pagamento ou recebimento" className="w-full sm:w-44">
          <SelectValue>
            {search.paymentMethod === "all"
              ? "Todos os meios"
              : paymentMethodLabels[search.paymentMethod]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os meios</SelectItem>
          {Object.entries(paymentMethodLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative min-w-0">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Buscar lançamentos recorrentes"
          className="w-full pl-9"
          placeholder="Buscar descrição, conta ou categoria"
          value={search.q}
          maxLength={160}
          onChange={(event) => onChange({ q: event.target.value })}
        />
      </div>
    </div>
  );
}
