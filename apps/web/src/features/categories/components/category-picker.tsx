import type { CategoryOutput } from "@openmonetis/validators/categories";
import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import {
  MobilePicker,
  MobilePickerContent,
  MobilePickerTrigger,
} from "@/components/forms/mobile-picker";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getCategoryLabel, sortCategoryOptions } from "../categories.presentation";
import { CategoryIcon } from "../category-icons";

export function CategoryPicker({
  categories,
  value,
  onChange,
  onCreate,
  disabled,
  invalid,
}: {
  categories: CategoryOutput[];
  value: string;
  onChange: (id: string) => void;
  onCreate: () => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = categories.find((category) => category.id === value);
  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }
  return (
    <MobilePicker
      open={open}
      onOpenChange={(next) => {
        if (next) setSearch("");
        setOpen(next);
      }}
    >
      <MobilePickerTrigger
        data-slot="category-picker-trigger"
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Categoria: ${selected ? `${getCategoryLabel(selected)}${selected.parentId ? "" : " — categoria principal"}` : "Selecione"}`}
            aria-invalid={invalid}
            disabled={disabled}
            className="w-full justify-start overflow-hidden font-normal"
          />
        }
      >
        {selected ? (
          <CategoryIcon aria-hidden="true" className="size-4 shrink-0" name={selected.icon} />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-left">
          {selected ? getCategoryLabel(selected) : "Selecione"}
          {selected && !selected.parentId ? (
            <span className="text-muted-foreground"> — categoria principal</span>
          ) : null}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </MobilePickerTrigger>
      <MobilePickerContent
        title="Categoria"
        align="start"
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
      >
        <Command>
          <CommandInput
            className="text-base md:text-sm"
            value={search}
            onValueChange={setSearch}
            aria-label="Buscar categoria ou subcategoria"
            placeholder="Buscar categoria ou subcategoria"
          />
          <CommandList>
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Sem categoria" data-checked={!value} onSelect={() => choose("")}>
                Sem categoria
              </CommandItem>
              {sortCategoryOptions(categories).map((category) => (
                <CommandItem
                  className={category.parentId ? "min-h-11 pl-6 md:min-h-9" : "min-h-11 md:min-h-9"}
                  key={category.id}
                  value={`${getCategoryLabel(category)} ${category.parentId ? "subcategoria" : "categoria principal"} ${category.id}`}
                  data-checked={category.id === value}
                  onSelect={() => choose(category.id)}
                >
                  <CategoryIcon aria-hidden="true" className="size-4" name={category.icon} />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate">{getCategoryLabel(category)}</span>
                    {!category.parentId ? (
                      <span className="text-muted-foreground text-xs">Categoria principal</span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <p className="px-2 pb-2 text-muted-foreground text-xs">
            Selecionar a categoria principal registra o lançamento diretamente nela.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Criar categoria…
          </Button>
        </div>
      </MobilePickerContent>
    </MobilePicker>
  );
}
