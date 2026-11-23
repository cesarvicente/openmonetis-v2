import { bootstrapIconCatalog } from "./bootstrap-icons.catalog";
import {
  bootstrapIconModifiers,
  bootstrapIconPhrases,
  bootstrapIconWords,
} from "./bootstrap-icons.translations";
import { bootstrapIconPrefix, generalIconGroup } from "./category-icons.constants";

/** Categorias do Bootstrap Icons, na ordem em que aparecem depois de "Geral". */
const bootstrapIconGroupLabels = {
  commerce: "Comércio",
  "real-world": "Mundo real",
  transportation: "Transporte",
  travel: "Viagem",
  buildings: "Construções",
  medical: "Saúde",
  people: "Pessoas",
  entertainment: "Entretenimento",
  love: "Amor",
  tools: "Ferramentas",
  security: "Segurança",
  weather: "Clima",
  devices: "Dispositivos",
  communications: "Comunicação",
  "date-and-time": "Data e hora",
  "files-and-folders": "Arquivos e pastas",
  media: "Mídia",
  geo: "Mapas e lugares",
  graphics: "Design e imagem",
  data: "Gráficos e dados",
  emoji: "Emojis",
  hands: "Mãos",
  clouds: "Nuvens",
  apps: "Aplicativos",
  brand: "Marcas",
  badges: "Selos",
  "alerts-warnings-and-signs": "Alertas e placas",
  shapes: "Formas",
  arrows: "Setas",
  "shape-arrows": "Setas em formas",
  "box-arrows": "Setas em caixas",
  chevrons: "Divisas",
  carets: "Indicadores de seta",
  controls: "Controles",
  "sort-and-filter": "Ordenação e filtro",
  typography: "Tipografia",
  layout: "Layout",
  "ui-and-keyboard": "Interface e teclado",
  bootstrap: "Bootstrap",
  miscellaneous: "Diversos",
} as const;

export const categoryIconGroups = [
  generalIconGroup,
  ...Object.entries(bootstrapIconGroupLabels).map(([value, label]) => ({ value, label })),
];

export type CategoryIconOption = {
  value: string;
  label: string;
  /** Nome original em inglês, também pesquisável. */
  englishName: string;
  groups: string[];
  searchWords: string[];
};

export type CategoryIconSection = {
  value: string;
  label: string;
  options: CategoryIconOption[];
};

export function createCategoryIconLibrary(
  generalOptions: ReadonlyArray<{ value: string; label: string }>,
): CategoryIconOption[] {
  return [
    ...generalOptions.map(({ label, value }) =>
      createOption({ value, name: value, label, groups: [generalIconGroup.value], tags: [] }),
    ),
    ...bootstrapIconCatalog
      .trim()
      .split("\n")
      .map((line) => {
        const [name, groups, tags] = line.split(";") as [string, string, string];
        return createOption({
          value: `${bootstrapIconPrefix}${name}`,
          name,
          label: getBootstrapIconLabel(name),
          groups: groups.split(","),
          tags: tags ? tags.split(",") : [],
        });
      }),
  ];
}

/** Nome em português montado a partir do nome original, por exemplo `key-fill` → "Chave (preenchido)". */
export function getBootstrapIconLabel(name: string) {
  const filled = name.endsWith("-fill");
  const tokens = (filled ? name.slice(0, -"-fill".length) : name).split("-");
  const parts: string[] = [];
  for (let index = 0; index < tokens.length; ) {
    const phrase = findPhrase(tokens, index);
    if (phrase) {
      parts.push(phrase.translations[0] as string);
      index += phrase.length;
      continue;
    }
    const token = tokens[index] as string;
    const modifier = index > 0 ? bootstrapIconModifiers.get(token)?.[0] : undefined;
    parts.push(modifier ?? translateWord(token));
    index += 1;
  }
  const label = `${parts.join(" ")}${filled ? " (preenchido)" : ""}`;
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

/**
 * Agrupa os ícones por categoria. Na pesquisa, cada palavra digitada precisa iniciar alguma palavra
 * do ícone em português ou em inglês, e os resultados mais próximos vêm primeiro.
 */
export function getCategoryIconSections(
  options: CategoryIconOption[],
  { group, search }: { group: string | null; search: string },
): CategoryIconSection[] {
  const query = normalizeIconText(search);
  const sections = categoryIconGroups.flatMap(({ value, label }) => {
    if (group && group !== value) return [];
    const matches = options.flatMap((option) => {
      const inGroup = group ? option.groups.includes(value) : option.groups[0] === value;
      const score = inGroup ? getSearchScore(option, query) : null;
      return score === null ? [] : [{ option, score }];
    });
    if (matches.length === 0) return [];
    matches.sort((left, right) => left.score - right.score);
    return [
      {
        value,
        label,
        options: matches.map(({ option }) => option),
        bestScore: matches[0]?.score ?? 0,
      },
    ];
  });
  return sections
    .sort((left, right) => left.bestScore - right.bestScore)
    .map(({ bestScore: _bestScore, ...section }) => section);
}

function getSearchScore(option: CategoryIconOption, query: string) {
  if (!query) return 0;
  const words = query.split(" ");
  if (!words.every((word) => option.searchWords.some((candidate) => candidate.startsWith(word)))) {
    return null;
  }
  const names = [normalizeIconText(option.label), normalizeIconText(option.englishName)];
  if (names.includes(query)) return 0;
  if (names.some((name) => `${name} `.startsWith(`${query} `))) return 1;
  if (names.some((name) => name.startsWith(query))) return 2;
  return 3;
}

function createOption({
  groups,
  label,
  name,
  tags,
  value,
}: {
  groups: string[];
  label: string;
  name: string;
  tags: string[];
  value: string;
}): CategoryIconOption {
  const tokens = name.split("-");
  const groupLabels = categoryIconGroups
    .filter((group) => groups.includes(group.value))
    .map((group) => group.label);
  const terms = [
    label,
    name,
    ...tags,
    ...groups,
    ...groupLabels,
    ...tokens.flatMap((_token, index) => findPhrase(tokens, index)?.translations ?? []),
    ...[...tokens, ...tags.flatMap((tag) => tag.split(/[^a-z0-9]+/))].flatMap(getTranslations),
  ];
  return {
    value,
    label,
    englishName: name,
    groups,
    searchWords: [...new Set(terms.flatMap((term) => normalizeIconText(term).split(" ")))].filter(
      Boolean,
    ),
  };
}

function findPhrase(tokens: string[], start: number) {
  for (let length = tokens.length - start; length > 0; length -= 1) {
    const translations = bootstrapIconPhrases.get(tokens.slice(start, start + length).join("-"));
    if (translations) return { length, translations };
  }
  return null;
}

/** Variações numeradas, como `cart4`, usam a tradução da palavra sem o número. */
function splitVariant(token: string) {
  const match = /^([a-z]+)(\d+)$/.exec(token);
  return match && bootstrapIconWords.has(match[1] as string)
    ? { word: match[1] as string, variant: match[2] as string }
    : null;
}

function getTranslations(token: string) {
  const variant = splitVariant(token);
  return bootstrapIconWords.get(token) ?? bootstrapIconWords.get(variant?.word ?? "") ?? [];
}

function translateWord(token: string) {
  const translation = bootstrapIconWords.get(token)?.[0];
  if (translation) return translation;
  const variant = splitVariant(token);
  return variant ? `${bootstrapIconWords.get(variant.word)?.[0]} ${variant.variant}` : token;
}

function normalizeIconText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
