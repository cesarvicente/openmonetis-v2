import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { type UIEvent, useDeferredValue, useMemo, useState } from "react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { categoryIconLibraryQueryOptions } from "../categories.queries";
import type {
  CategoryIconOption,
  CategoryIconSection,
  getCategoryIconSections,
} from "../category-icon-library";
import { CategoryIcon, categoryIconOptions } from "../category-icons";
import { bootstrapIconPrefix } from "../category-icons.constants";

type CategoryIconLibrary = {
  groups: Array<{ value: string; label: string }>;
  options: CategoryIconOption[];
  getSections: typeof getCategoryIconSections;
};

/** Ícones renderizados por vez; a rolagem carrega os próximos. */
const iconsPerStep = 240;

export function CategoryIconPicker({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (icon: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const library = useQuery({
    ...categoryIconLibraryQueryOptions(),
    enabled: open || value.startsWith(bootstrapIconPrefix),
  });
  const selectedLabel =
    categoryIconOptions.find((option) => option.value === value)?.label ??
    library.data?.options.find((option) => option.value === value)?.label;

  return (
    <>
      <button
        className="flex min-h-9 w-full items-center gap-2 rounded-md border border-input bg-popover px-2.5 py-1.5 text-left shadow-xs transition-[color,box-shadow] hover:border-brand-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        id={id}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="grid size-8 place-items-center rounded-full bg-muted/30 text-brand-strong">
          <CategoryIcon name={value} />
        </span>
        <span className="grid">
          <span className="text-sm font-medium">{selectedLabel ?? "Selecionar ícone"}</span>
          <span className="text-muted-foreground text-xs">Clique para trocar o ícone</span>
        </span>
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent guarded mobileLayout="sheet" className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Escolher ícone</DialogTitle>
            <DialogDescription>
              Pesquise em português ou inglês, ou filtre por categoria.
            </DialogDescription>
          </DialogHeader>
          {library.data ? (
            <IconBrowser
              library={library.data}
              onSelect={(icon) => {
                onChange(icon);
                setOpen(false);
              }}
              value={value}
            />
          ) : library.isError ? (
            <p className="py-10 text-center text-muted-foreground text-sm">
              Não foi possível carregar os ícones.
            </p>
          ) : (
            <div aria-label="Carregando ícones" className="grid gap-3" role="status">
              <Skeleton className="h-9" />
              <Skeleton className="h-96" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function IconBrowser({
  library,
  onSelect,
  value,
}: {
  library: CategoryIconLibrary;
  onSelect: (icon: string) => void;
  value: string;
}) {
  const mobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const sections = useMemo(
    () =>
      library.getSections(library.options, {
        group: group === "all" ? null : group,
        search: deferredSearch,
      }),
    [deferredSearch, group, library],
  );
  const groupLabel =
    library.groups.find((option) => option.value === group)?.label ?? "Todas as categorias";

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Pesquisar ícone"
            autoFocus={!mobile}
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar ícone (ex.: chave ou key)"
            value={search}
          />
        </div>
        <Select onValueChange={(next) => next && setGroup(next)} value={group}>
          <SelectTrigger aria-label="Categoria de ícones" className="w-full">
            <SelectValue>{groupLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {library.groups.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <IconSections
        key={`${group}:${deferredSearch}`}
        onSelect={onSelect}
        sections={sections}
        value={value}
      />
    </>
  );
}

function IconSections({
  onSelect,
  sections,
  value,
}: {
  onSelect: (icon: string) => void;
  sections: CategoryIconSection[];
  value: string;
}) {
  const [limit, setLimit] = useState(iconsPerStep);
  const total = sections.reduce((sum, section) => sum + section.options.length, 0);
  const visible = limitSections(sections, limit);

  function loadMore(event: UIEvent<HTMLDivElement>) {
    const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
    if (limit < total && scrollHeight - scrollTop - clientHeight < clientHeight) {
      setLimit(limit + iconsPerStep);
    }
  }

  return (
    <div
      className="grid h-96 content-start gap-4 overflow-y-auto pr-1"
      data-mobile-form-body
      onScroll={loadMore}
    >
      {total === 0 ? (
        <p className="py-10 text-center text-muted-foreground text-sm">Nenhum ícone encontrado.</p>
      ) : null}
      {visible.map((section) => (
        <section className="grid gap-2" key={section.value}>
          <h3 className="sticky top-0 z-10 bg-popover py-1 font-medium text-muted-foreground text-xs">
            {section.label} · {section.total}
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2">
            {section.options.map((option) => (
              <button
                aria-label={option.label}
                aria-pressed={option.value === value}
                className={cn(
                  "grid size-11 place-items-center rounded-md border border-input bg-popover text-muted-foreground shadow-xs transition-[color,box-shadow] hover:border-brand-strong hover:text-brand-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  option.value === value && "border-brand-strong bg-brand/10 text-brand-strong",
                )}
                key={option.value}
                onClick={() => onSelect(option.value)}
                title={`${option.label} · ${option.englishName}`}
                type="button"
              >
                <CategoryIcon name={option.value} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function limitSections(sections: CategoryIconSection[], limit: number) {
  let remaining = limit;
  return sections.flatMap((section) => {
    if (remaining <= 0) return [];
    const options = section.options.slice(0, remaining);
    remaining -= options.length;
    return [{ ...section, options, total: section.options.length }];
  });
}
