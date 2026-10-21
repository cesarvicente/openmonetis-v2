import { CalendarDays, X } from "lucide-react";
import { useId, useState } from "react";
import { MobileDatePicker } from "@/components/forms/mobile-date-picker";
import { SettingsSection } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatDueDate } from "../due-date-rules.presentation";
import type { useDueDateRulesForm } from "../useDueDateRulesForm";
import { DueDateRulesHolidays } from "./due-date-rules-holidays";
export function DueDateRulesCalendar({
  form,
  disabled,
}: {
  form: ReturnType<typeof useDueDateRulesForm>["form"];
  disabled: boolean;
}) {
  const id = useId();
  const [holiday, setHoliday] = useState("");
  return (
    <SettingsSection
      icon={CalendarDays}
      title="Calendário"
      description="Dias úteis: segunda a sexta, exceto os feriados considerados."
    >
      <div className="grid gap-4">
        <form.Field name="calendar.includeNationalHolidays">
          {(field) => (
            <div className="grid min-w-0 gap-3">
              <Label htmlFor={`${id}-national`}>
                <Checkbox
                  id={`${id}-national`}
                  checked={field.state.value}
                  disabled={disabled}
                  onCheckedChange={(value) => field.handleChange(value === true)}
                />
                Considerar feriados nacionais
              </Label>
              <DueDateRulesHolidays included={field.state.value} />
            </div>
          )}
        </form.Field>
        <p className="text-muted-foreground text-xs">
          Feriados adicionais valem somente para a data e o ano informados.
        </p>
        <form.Field name="calendar.holidays">
          {(field) => (
            <div className="grid gap-3">
              <Label htmlFor={`${id}-holiday`}>Feriados adicionais</Label>
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <MobileDatePicker
                  className="min-w-0 [&>span]:truncate"
                  id={`${id}-holiday`}
                  value={holiday}
                  onChange={setHoliday}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    disabled ||
                    !holiday ||
                    field.state.value.includes(holiday) ||
                    field.state.value.length >= 366
                  }
                  onClick={() => {
                    field.handleChange([...field.state.value, holiday].sort());
                    setHoliday("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                {field.state.value.map((date) => (
                  <Button
                    key={date}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={disabled}
                    onClick={() =>
                      field.handleChange(field.state.value.filter((value) => value !== date))
                    }
                    aria-label={`Remover feriado ${formatDueDate(date)}`}
                  >
                    {formatDueDate(date)}
                    <X aria-hidden="true" className="size-3" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </form.Field>
      </div>
    </SettingsSection>
  );
}
