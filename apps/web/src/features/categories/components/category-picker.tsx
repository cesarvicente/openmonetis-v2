import type { CategoryOutput } from "@openmonetis/validators/categories";
import { ChevronDown, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
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
import { getCategoryLabel, getCategoryPickerGroups } from "../categories.presentation";
import { CategoryIcon } from "../category-icons";

/** Seletor pesquisável de categoria, compartilhado pelos formulários que escolhem uma categoria. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  onCreate,
  emptyIcon,
  emptyLabel = "Sem categoria",
  placeholder = "Selecione",
  id,
  disabled,
  invalid,
}: {
  categories: CategoryOutput[];
  value: string;
  onChange: (id: string) => void;
  /** Sem `onCreate`, o seletor não oferece a criação de categorias. */
  onCreate?: () => void;
  emptyIcon?: ReactNode;
  emptyLabel?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = categories.find((category) => category.id === value);
  const groups = getCategoryPickerGroups(categories, search);
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
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Categoria: ${selected ? `${getCategoryLabel(selected)}${selected.parentId ? "" : " — categoria principal"}` : placeholder}`}
            aria-invalid={invalid}
            title={selected ? getCategoryLabel(selected) : undefined}
            disabled={disabled}
            className="w-full justify-start overflow-hidden font-normal"
          />
        }
      >
        {selected ? (
          <CategoryIcon aria-hidden="true" className="size-4 shrink-0" name={selected.icon} />
        ) : (
          emptyIcon
        )}
        <span className="min-w-0 flex-1 truncate text-left">
          {selected?.name ?? placeholder}
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
        <Command shouldFilter={false}>
          <CommandInput
            className="text-base md:text-sm"
            value={search}
            onValueChange={setSearch}
            aria-label="Buscar categoria ou subcategoria"
            placeholder="Buscar categoria ou subcategoria"
          />
          <CommandList data-category-picker-list>
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            {search.trim() ? null : (
              <CommandGroup className="pb-0">
                <CommandItem value="none" data-checked={!value} onSelect={() => choose("")}>
                  {emptyIcon}
                  {emptyLabel}
                </CommandItem>
              </CommandGroup>
            )}
            {groups.map(({ parent, children, parentMatches }) => (
              // O cabeçalho fixo exige que o grupo não crie a própria área de rolagem.
              <CommandGroup className="overflow-visible py-0 last:pb-1" key={parent.id}>
                {parentMatches ? (
                  <CommandItem
                    className="sticky top-0 z-10 min-h-11 bg-popover md:min-h-9"
                    value={parent.id}
                    data-checked={parent.id === value}
                    onSelect={() => choose(parent.id)}
                  >
                    <CategoryIcon aria-hidden="true" className="size-4" name={parent.icon} />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate">{parent.name}</span>
                      <span className="text-muted-foreground text-xs">Categoria principal</span>
                    </span>
                  </CommandItem>
                ) : (
                  <div className="sticky top-0 z-10 flex items-center gap-2 bg-popover px-2 py-1.5 text-muted-foreground text-sm">
                    <CategoryIcon className="size-4 shrink-0" name={parent.icon} />
                    <span className="truncate">{parent.name}</span>
                  </div>
                )}
                {children.map((category) => (
                  <CommandItem
                    // A margem evita que a rolagem pelo teclado esconda o item atrás do cabeçalho.
                    className="min-h-11 scroll-mt-14 pl-8 md:min-h-9"
                    key={category.id}
                    value={category.id}
                    aria-label={getCategoryLabel(category)}
                    data-checked={category.id === value}
                    onSelect={() => choose(category.id)}
                  >
                    <CategoryIcon aria-hidden="true" className="size-4" name={category.icon} />
                    <span className="truncate">{category.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <p className="px-2 py-1 text-muted-foreground text-xs">
            Selecionar a categoria principal registra o lançamento diretamente nela.
          </p>
          {onCreate ? (
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
          ) : null}
        </div>
      </MobilePickerContent>
    </MobilePicker>
  );
}
