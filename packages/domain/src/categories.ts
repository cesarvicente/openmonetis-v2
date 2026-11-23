export const categoryTypes = ["income", "expense"] as const;
export type CategoryType = (typeof categoryTypes)[number];
export const internalTransferCategoryName = "Transferência interna";
export const invoicePaymentCategoryName = "Pagamentos de fatura";
export const balanceAdjustmentCategoryName = "Ajuste de saldo";
export const invoiceAdjustmentCategoryName = "Ajustes de fatura";
export const yieldCategoryName = "Rendimentos";
export const reimbursementCategoryName = "Reembolso";
export const otherExpenseCategoryName = "Outras despesas";
export const otherIncomeCategoryName = "Outras receitas";

export type CategoryCreateDraft = {
  userId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  isSystem: boolean;
  parentId?: string | null;
};

/** Categoria criada para novos usuários; a subcategoria aponta a principal pelo nome, ainda sem ID. */
export type DefaultCategoryDraft = Omit<CategoryCreateDraft, "parentId"> & {
  parentName: string | null;
};

export type CategoryHierarchyNode = {
  id: string;
  type: CategoryType;
  parentId?: string | null;
  isSystem: boolean;
};

export class CategoryConstraintError extends Error {
  constructor(
    public readonly code:
      | "category_invalid_parent"
      | "category_has_children"
      | "category_name_conflict"
      | "category_in_use",
  ) {
    super(code);
  }
}

export function assertCategoryHierarchy(input: {
  id?: string;
  type: CategoryType;
  parentId: string | null;
  categories: readonly CategoryHierarchyNode[];
}) {
  const children = input.categories.filter(
    (category) => category.parentId === input.id && input.id !== undefined,
  );
  if (
    children.length &&
    (input.parentId !== null || children.some((child) => child.type !== input.type))
  ) {
    throw new CategoryConstraintError("category_has_children");
  }
  if (!input.parentId) return;
  const parent = input.categories.find((category) => category.id === input.parentId);
  if (
    !parent ||
    parent.id === input.id ||
    parent.parentId ||
    parent.isSystem ||
    parent.type !== input.type
  ) {
    throw new CategoryConstraintError("category_invalid_parent");
  }
}

export function expandCategoryIds(
  categories: readonly Pick<CategoryHierarchyNode, "id" | "parentId">[],
  selectedIds: readonly string[],
) {
  const selected = new Set(selectedIds);
  return [
    ...new Set([
      ...selectedIds,
      ...categories
        .filter((category) => category.parentId && selected.has(category.parentId))
        .map((category) => category.id),
    ]),
  ];
}

export function createCategoryDraft(
  input: Omit<CategoryCreateDraft, "isSystem">,
): CategoryCreateDraft {
  return {
    ...input,
    name: input.name.trim(),
    icon: input.icon?.trim() || null,
    isSystem: false,
  };
}

export function canChangeCategoryType(input: {
  currentType: CategoryType;
  nextType: CategoryType;
  hasFinancialReferences: boolean;
}) {
  return input.currentType === input.nextType || !input.hasFinancialReferences;
}

const defaultCategoryDefinitions: Array<{
  name: string;
  type: CategoryType;
  icon: string;
  isSystem?: boolean;
  children?: Array<{ name: string; icon: string }>;
}> = [
  {
    name: balanceAdjustmentCategoryName,
    type: "expense",
    icon: "circle-dollar-sign",
    isSystem: true,
  },
  {
    name: "Alimentação",
    type: "expense",
    icon: "utensils",
    children: [
      { name: "Restaurantes", icon: "restaurant" },
      { name: "Delivery", icon: "bike" },
    ],
  },
  {
    name: "Mercado",
    type: "expense",
    icon: "shopping-basket",
    children: [
      { name: "Açougue", icon: "beef" },
      { name: "Adega", icon: "wine" },
      { name: "Depósito", icon: "bi-box-seam" },
      { name: "Padaria", icon: "croissant" },
      { name: "Sacolão", icon: "carrot" },
    ],
  },
  {
    name: "Moradia",
    type: "expense",
    icon: "home",
    children: [
      { name: "Aluguel", icon: "key" },
      { name: "Condomínio", icon: "building" },
      { name: "Manutenção", icon: "wrench" },
      { name: "Móveis", icon: "sofa" },
      { name: "Reforma", icon: "paint-roller" },
      { name: "Utensílios Casa", icon: "cooking-pot" },
    ],
  },
  {
    name: "Contas",
    type: "expense",
    icon: "bi-receipt-cutoff",
    children: [
      { name: "Água", icon: "droplets" },
      { name: "Energia", icon: "zap" },
      { name: "Gás", icon: "flame" },
      { name: "Internet", icon: "wifi" },
    ],
  },
  {
    name: "Transporte",
    type: "expense",
    icon: "bus",
    children: [
      { name: "Transporte Público", icon: "bi-train-front" },
      { name: "Uber", icon: "bi-taxi-front" },
    ],
  },
  {
    name: "Carro | Moto",
    type: "expense",
    icon: "car",
    children: [
      { name: "Acessórios e Peças", icon: "bi-nut" },
      { name: "Combustível", icon: "bi-fuel-pump" },
      { name: "Documentos", icon: "bi-file-earmark-text" },
      { name: "Estacionamento", icon: "bi-p-circle" },
      { name: "Limpeza", icon: "bi-bucket" },
      { name: "Manutenção", icon: "wrench" },
      { name: "Multas", icon: "bi-exclamation-triangle" },
      { name: "Pedágio", icon: "bi-signpost-split" },
      { name: "Seguro", icon: "bi-shield-check" },
    ],
  },
  {
    name: "Saúde",
    type: "expense",
    icon: "heart-pulse",
    children: [
      { name: "Academia", icon: "dumbbell" },
      { name: "Consulta", icon: "bi-clipboard2-pulse" },
      { name: "Dentista", icon: "bi-emoji-smile" },
      { name: "Exames", icon: "bi-file-earmark-medical" },
      { name: "Higiene", icon: "bath" },
      { name: "Plano de Saúde", icon: "bi-shield-plus" },
      { name: "Remédios", icon: "pill" },
    ],
  },
  {
    name: "Educação",
    type: "expense",
    icon: "book-open",
    children: [
      { name: "Cursos", icon: "bi-mortarboard" },
      { name: "Livros", icon: "bi-book" },
    ],
  },
  { name: "Lazer", type: "expense", icon: "bi-ticket-perforated" },
  {
    name: "Planos e Assinaturas",
    type: "expense",
    icon: "bi-calendar2-check",
    children: [
      { name: "Celular", icon: "bi-phone" },
      { name: "Marketplace", icon: "bi-shop" },
      { name: "Música", icon: "bi-music-note-beamed" },
      { name: "Software e IA", icon: "bi-robot" },
      { name: "Streaming", icon: "bi-collection-play" },
    ],
  },
  {
    name: "Eletrônicos e Tecnologia",
    type: "expense",
    icon: "monitor",
    children: [
      { name: "Hardware PC", icon: "bi-motherboard" },
      { name: "Jogos", icon: "bi-joystick" },
      { name: "Periféricos", icon: "bi-keyboard" },
      { name: "Software", icon: "bi-window-stack" },
      { name: "Videogames | Acessórios", icon: "gamepad" },
    ],
  },
  {
    name: "Pets",
    type: "expense",
    icon: "paw-print",
    children: [
      { name: "Banho e Tosa", icon: "bi-scissors" },
      { name: "Brinquedos", icon: "toy-brick" },
      { name: "Ração", icon: "bone" },
      { name: "Remédios", icon: "pill" },
      { name: "Veterinário", icon: "hospital" },
    ],
  },
  {
    name: "Pagamentos",
    type: "expense",
    icon: "bi-cash-coin",
    children: [
      { name: "Documentos", icon: "bi-file-earmark-text" },
      { name: "Empréstimo", icon: "bi-cash-stack" },
      { name: "Impostos e Tributos", icon: "bi-bank" },
      { name: "Investimentos", icon: "bi-graph-up-arrow" },
      { name: "LIS", icon: "bi-credit-card" },
      { name: "Taxas", icon: "bi-percent" },
    ],
  },
  { name: "Terceiros", type: "expense", icon: "users" },
  {
    name: "Vestuário",
    type: "expense",
    icon: "shirt",
    children: [
      { name: "Acessórios", icon: "bi-watch" },
      { name: "Bermudas e Shorts", icon: "shorts" },
      { name: "Blusas e Casacos", icon: "jacket" },
      { name: "Bolsas e Mochilas", icon: "bi-backpack" },
      { name: "Bonés", icon: "cap" },
      { name: "Calças", icon: "trousers" },
      { name: "Camisas", icon: "dress-shirt" },
      { name: "Camisetas", icon: "shirt" },
      { name: "Meias", icon: "sock" },
      { name: "Roupas Íntimas", icon: "underwear" },
      { name: "Sapatos e Sandálias", icon: "footprints" },
      { name: "Tênis", icon: "sneaker" },
      { name: "Vestidos e Saias", icon: "dress" },
    ],
  },
  { name: "Viagem", type: "expense", icon: "plane" },
  { name: "Presentes", type: "expense", icon: "gift" },
  { name: invoicePaymentCategoryName, type: "expense", icon: "receipt", isSystem: true },
  {
    name: invoiceAdjustmentCategoryName,
    type: "expense",
    icon: "receipt-text",
    isSystem: true,
  },
  { name: otherExpenseCategoryName, type: "expense", icon: "more-horizontal" },
  { name: "Salário", type: "income", icon: "wallet" },
  { name: "Freelance", type: "income", icon: "briefcase" },
  { name: yieldCategoryName, type: "income", icon: "trending-up" },
  { name: "Investimentos", type: "income", icon: "chart" },
  { name: "Vendas", type: "income", icon: "store" },
  { name: "Prêmios", type: "income", icon: "medal" },
  { name: reimbursementCategoryName, type: "income", icon: "refresh-cw", isSystem: true },
  { name: "Aluguel recebido", type: "income", icon: "building" },
  { name: otherIncomeCategoryName, type: "income", icon: "more-horizontal" },
  {
    name: balanceAdjustmentCategoryName,
    type: "income",
    icon: "circle-dollar-sign",
    isSystem: true,
  },
  {
    name: internalTransferCategoryName,
    type: "income",
    icon: "arrow-left-right",
    isSystem: true,
  },
];

export function createDefaultCategoryDrafts(userId: string): DefaultCategoryDraft[] {
  return defaultCategoryDefinitions.flatMap(({ children = [], ...category }) => [
    { ...category, userId, isSystem: category.isSystem ?? false, parentName: null },
    ...children.map((child) => ({
      ...child,
      userId,
      type: category.type,
      isSystem: false,
      parentName: category.name,
    })),
  ]);
}
