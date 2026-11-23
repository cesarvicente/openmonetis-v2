import {
  defaultInboxRuleAction,
  type InboxRuleAction,
  type InboxRuleConditionField,
  type InboxRuleTransactionType,
  inboxRuleConditionFields,
  inboxRuleMaximumConditions,
  inboxRuleNumericConditionOperators,
  inboxRuleTextConditionOperators,
  inboxRuleTransactionTypes,
} from "@openmonetis/domain/inbox-rules";
import { type PaymentMethod, paymentMethods } from "@openmonetis/domain/transactions";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import {
  type CreateInboxRuleInput,
  CreateInboxRuleInputSchema,
  type InboxRuleOutput,
  type ReplaceInboxRuleInput,
  ReplaceInboxRuleInputSchema,
} from "@openmonetis/validators/inbox-rules";
import type { PersonOutput } from "@openmonetis/validators/people";
import { useForm } from "@tanstack/react-form";
import { CheckCircle2, Circle, CircleOff, Info, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { EntityOption } from "@/features/transactions/components/transaction-entity-option";
import { PaymentMethodOption } from "@/features/transactions/components/transaction-payment-method-option";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { cn } from "@/lib/utils";
import {
  getInboxRuleFormErrorMessage,
  inboxRuleActionOptions,
  inboxRuleAmountOperatorLabels,
  inboxRuleFieldLabels,
  inboxRuleTextOperatorLabels,
  inboxRuleTransactionTypeLabels,
} from "../inbox-rules.presentation";

type EditableCondition = {
  formKey: string;
  field: InboxRuleConditionField;
  operator: string;
  value: string;
};

export function InboxRuleForm({
  accounts,
  cards,
  categories,
  people,
  rule,
  onCancel,
  onSubmit,
}: {
  accounts: AccountOutput[];
  cards: CardOutput[];
  categories: CategoryOutput[];
  people: PersonOutput[];
  rule: InboxRuleOutput | null;
  onCancel: () => void;
  onSubmit: (input: CreateInboxRuleInput | ReplaceInboxRuleInput) => Promise<void>;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      name: rule?.name ?? "",
      priority: String(rule?.priority ?? 100),
      isActive: rule?.isActive ?? true,
      matchMode: rule?.matchMode ?? ("all" as const),
      conditions: (rule?.conditions.map((condition) => ({
        formKey: crypto.randomUUID(),
        field: condition.field,
        operator: condition.operator,
        value: String(condition.value),
      })) ?? [createEmptyCondition()]) as EditableCondition[],
      action: (rule?.action ?? defaultInboxRuleAction) as InboxRuleAction,
      transactionType: (rule?.transactionType ?? "none") as InboxRuleTransactionType | "none",
      categoryId: rule?.category?.id ?? "none",
      personId: rule?.person?.id ?? "none",
      paymentMethod: (rule?.paymentMethod ?? "none") as PaymentMethod | "none",
      cardId: rule?.card?.id ?? "",
      accountId: rule?.account?.id ?? "",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setError(null);
      const fills = value.action === "fill";
      const candidate = {
        name: value.name,
        priority: Number(value.priority),
        isActive: value.isActive,
        matchMode: value.matchMode,
        conditions: value.conditions.map((condition) =>
          condition.field === "parsedAmount"
            ? {
                field: condition.field,
                operator: condition.operator,
                value: Number(condition.value.replace(",", ".")),
              }
            : {
                field: condition.field,
                operator: condition.operator,
                value: condition.value,
              },
        ),
        action: value.action,
        transactionType: !fills || value.transactionType === "none" ? null : value.transactionType,
        categoryId: !fills || value.categoryId === "none" ? null : value.categoryId,
        personId: !fills || value.personId === "none" ? null : value.personId,
        paymentMethod: !fills || value.paymentMethod === "none" ? null : value.paymentMethod,
        cardId: fills && value.paymentMethod === "credit_card" ? value.cardId || null : null,
        accountId:
          fills && value.paymentMethod !== "none" && value.paymentMethod !== "credit_card"
            ? value.accountId || null
            : null,
        ...(rule ? { expectedVersion: rule.version } : {}),
      };
      const parsed = (rule ? ReplaceInboxRuleInputSchema : CreateInboxRuleInputSchema).safeParse(
        candidate,
      );
      if (!parsed.success) {
        showInvalidFormToast();
        setError(getInboxRuleFormErrorMessage(parsed.error.issues));
        return;
      }
      try {
        await onSubmit(parsed.data);
        toast.success(rule ? "Regra atualizada" : "Regra criada");
      } catch {
        setError("Não foi possível salvar a regra.");
        toast.error("Não foi possível salvar a regra.");
      }
    },
  });

  return (
    <form
      data-mobile-page-form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <form.Field name="name">
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-name`}>Nome da regra</Label>
              <Input
                id={`${id}-name`}
                maxLength={120}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Ex.: Compras no iFood"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="priority">
          {(field) => (
            <div className="grid gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`${id}-priority`}>Ordem de aplicação</Label>
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Informações sobre a ordem de aplicação"
                    render={
                      <button
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        type="button"
                      />
                    }
                  >
                    <Info aria-hidden="true" className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Números menores são aplicados primeiro.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id={`${id}-priority`}
                inputMode="numeric"
                max={9999}
                min={0}
                onChange={(event) => field.handleChange(event.target.value)}
                type="number"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="matchMode">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-match-mode`}>Aplicar quando</Label>
            <Select
              onValueChange={(value) => value && field.handleChange(value)}
              value={field.state.value}
            >
              <SelectTrigger className="w-full" id={`${id}-match-mode`}>
                <SelectValue>
                  {field.state.value === "all"
                    ? "Todas as condições coincidirem"
                    : "Qualquer condição coincidir"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as condições coincidirem</SelectItem>
                <SelectItem value="any">Qualquer condição coincidir</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field mode="array" name="conditions">
        {(conditionsField) => (
          <fieldset className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <legend className="font-medium text-sm tracking-tight">Condições</legend>
              <Button
                disabled={conditionsField.state.value.length >= inboxRuleMaximumConditions}
                onClick={() => conditionsField.pushValue(createEmptyCondition())}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" /> Adicionar
              </Button>
            </div>
            {conditionsField.state.value.map((condition, index) => {
              const numeric = condition.field === "parsedAmount";
              return (
                <div
                  className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                  key={condition.formKey}
                >
                  <form.Field name={`conditions[${index}].field`}>
                    {(field) => (
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-condition-${index}-field`}>Campo</Label>
                        <Select
                          onValueChange={(value) => {
                            if (!value) return;
                            field.handleChange(value);
                            form.setFieldValue(
                              `conditions[${index}].operator`,
                              value === "parsedAmount" ? "equals" : "contains",
                            );
                          }}
                          value={field.state.value}
                        >
                          <SelectTrigger className="w-full" id={`${id}-condition-${index}-field`}>
                            <SelectValue>{inboxRuleFieldLabels[field.state.value]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {inboxRuleConditionFields.map((item) => (
                              <SelectItem key={item} value={item}>
                                {inboxRuleFieldLabels[item]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>
                  <form.Field name={`conditions[${index}].operator`}>
                    {(field) => (
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-condition-${index}-operator`}>Operador</Label>
                        <Select
                          onValueChange={(value) => value && field.handleChange(value)}
                          value={field.state.value}
                        >
                          <SelectTrigger
                            className="w-full"
                            id={`${id}-condition-${index}-operator`}
                          >
                            <SelectValue>{getOperatorLabel(field.state.value)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(numeric
                              ? inboxRuleNumericConditionOperators
                              : inboxRuleTextConditionOperators
                            ).map((operator) => (
                              <SelectItem key={operator} value={operator}>
                                {getOperatorLabel(operator)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>
                  <form.Field name={`conditions[${index}].value`}>
                    {(field) => (
                      <div className="grid gap-1.5 sm:col-span-2">
                        <Label htmlFor={`${id}-condition-${index}-value`}>Valor</Label>
                        <Input
                          id={`${id}-condition-${index}-value`}
                          inputMode={numeric ? "decimal" : undefined}
                          maxLength={numeric ? undefined : 500}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={numeric ? "0,00" : "Texto a identificar"}
                          type="text"
                          value={field.state.value}
                        />
                      </div>
                    )}
                  </form.Field>
                  <Button
                    aria-label={`Remover condição ${index + 1}`}
                    disabled={conditionsField.state.value.length === 1}
                    onClick={() => conditionsField.removeValue(index)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </fieldset>
        )}
      </form.Field>

      <form.Field name="action">
        {(field) => (
          <fieldset className="grid gap-3">
            <legend className="mb-3 font-medium text-sm tracking-tight">Ação</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {inboxRuleActionOptions.map((option) => {
                const selected = field.state.value === option.value;
                const Icon = selected ? CheckCircle2 : Circle;
                return (
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-brand-strong/40 hover:bg-accent/50 has-focus-visible:ring-2 has-focus-visible:ring-ring",
                      selected && "border-brand-strong bg-brand/5",
                    )}
                    key={option.value}
                  >
                    <input
                      checked={selected}
                      className="sr-only"
                      name={`${id}-action`}
                      onBlur={field.handleBlur}
                      onChange={() => field.handleChange(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        selected ? "text-brand-strong" : "text-muted-foreground",
                      )}
                    />
                    <span className="grid gap-0.5">
                      <span className="font-medium text-sm">{option.label}</span>
                      <span className="text-muted-foreground text-xs">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.values.action}>
        {(action) =>
          action === "discard" ? (
            <p className="text-muted-foreground text-xs">
              O descarte vale para as capturas que chegarem depois de salvar a regra, mesmo que
              outra regra também coincida. Você pode restaurá-las em Descartados.
            </p>
          ) : (
            <fieldset className="grid gap-3">
              <legend className="font-medium text-sm tracking-tight">Preencher</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="transactionType">
                  {(field) => (
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${id}-transaction-type`}>Tipo de transação</Label>
                      <Select
                        onValueChange={(value) => {
                          if (!value) return;
                          field.handleChange(value);
                          const nextType = value === "none" ? "expense" : value;
                          const category = categories.find(
                            (item) => item.id === form.getFieldValue("categoryId"),
                          );
                          if (category && category.type !== nextType) {
                            form.setFieldValue("categoryId", "none");
                          }
                        }}
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full" id={`${id}-transaction-type`}>
                          <SelectValue>
                            {inboxRuleTransactionTypeLabels[field.state.value]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(["none", ...inboxRuleTransactionTypes] as const).map((type) => (
                            <SelectItem key={type} value={type}>
                              {inboxRuleTransactionTypeLabels[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
                <form.Subscribe
                  selector={(state) =>
                    state.values.transactionType === "none"
                      ? "expense"
                      : state.values.transactionType
                  }
                >
                  {(categoryType) => (
                    <form.Field name="categoryId">
                      {(field) => (
                        <div className="grid gap-1.5">
                          <Label htmlFor={`${id}-category`}>Categoria</Label>
                          <CategoryPicker
                            categories={categories.filter(
                              (category) => category.type === categoryType,
                            )}
                            emptyIcon={
                              <CircleOff
                                aria-hidden="true"
                                className="size-4 shrink-0 text-muted-foreground"
                              />
                            }
                            emptyLabel="Não preencher"
                            id={`${id}-category`}
                            onChange={(categoryId) => field.handleChange(categoryId || "none")}
                            placeholder="Não preencher"
                            value={field.state.value === "none" ? "" : field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </form.Subscribe>
                <form.Field name="personId">
                  {(field) => (
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${id}-person`}>Pessoa</Label>
                      <Select
                        onValueChange={(value) => value && field.handleChange(value)}
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full" id={`${id}-person`}>
                          <SelectValue>
                            <PersonOption
                              person={people.find((person) => person.id === field.state.value)}
                            />
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <PersonOption />
                          </SelectItem>
                          {people
                            .filter((person) => person.status === "active")
                            .map((person) => (
                              <SelectItem key={person.id} value={person.id}>
                                <PersonOption person={person} />
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
                <form.Field name="paymentMethod">
                  {(field) => (
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${id}-payment-method`}>Forma de pagamento</Label>
                      <Select
                        onValueChange={(value) => {
                          if (!value) return;
                          field.handleChange(value);
                          form.setFieldValue("cardId", "");
                          form.setFieldValue("accountId", "");
                        }}
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full" id={`${id}-payment-method`}>
                          <SelectValue>
                            {field.state.value === "none" ? (
                              <NotFilledOption />
                            ) : (
                              <PaymentMethodOption method={field.state.value as PaymentMethod} />
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <NotFilledOption />
                          </SelectItem>
                          {paymentMethods.map((method) => (
                            <SelectItem key={method} value={method}>
                              <PaymentMethodOption method={method} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
                <form.Subscribe selector={(state) => state.values.paymentMethod}>
                  {(paymentMethod) =>
                    paymentMethod === "none" ? null : paymentMethod === "credit_card" ? (
                      <form.Field name="cardId">
                        {(field) => (
                          <div className="grid gap-1.5">
                            <Label htmlFor={`${id}-card`}>Cartão</Label>
                            <Select
                              onValueChange={(value) =>
                                field.handleChange(!value || value === "none" ? "" : value)
                              }
                              value={field.state.value || "none"}
                            >
                              <SelectTrigger className="w-full" id={`${id}-card`}>
                                <SelectValue>
                                  {field.state.value ? (
                                    <EntityOption
                                      entity={cards.find((card) => card.id === field.state.value)}
                                    />
                                  ) : (
                                    <NotFilledOption />
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  <NotFilledOption />
                                </SelectItem>
                                {cards
                                  .filter(
                                    (card) =>
                                      card.status === "active" || card.id === field.state.value,
                                  )
                                  .map((card) => (
                                    <SelectItem key={card.id} value={card.id}>
                                      <EntityOption entity={card} />
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                    ) : (
                      <form.Field name="accountId">
                        {(field) => (
                          <div className="grid gap-1.5">
                            <Label htmlFor={`${id}-account`}>Conta</Label>
                            <Select
                              onValueChange={(value) =>
                                field.handleChange(!value || value === "none" ? "" : value)
                              }
                              value={field.state.value || "none"}
                            >
                              <SelectTrigger className="w-full" id={`${id}-account`}>
                                <SelectValue>
                                  {field.state.value ? (
                                    <EntityOption
                                      entity={accounts.find(
                                        (account) => account.id === field.state.value,
                                      )}
                                    />
                                  ) : (
                                    <NotFilledOption />
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  <NotFilledOption />
                                </SelectItem>
                                {accounts
                                  .filter(
                                    (account) =>
                                      !account.isArchived || account.id === field.state.value,
                                  )
                                  .map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                      <EntityOption entity={account} />
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                    )
                  }
                </form.Subscribe>
              </div>
              <p className="text-muted-foreground text-xs">
                Escolha ao menos um campo. Se mais de uma regra coincidir, o menor número de
                prioridade preenche primeiro cada campo.
              </p>
            </fieldset>
          )
        }
      </form.Subscribe>

      <form.Field name="isActive">
        {(field) => (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor={`${id}-active`}>Regra ativa</Label>
              <p className="mt-1 text-muted-foreground text-xs">
                Regras inativas ficam salvas, mas não são aplicadas.
              </p>
            </div>
            <Switch
              checked={field.state.value}
              id={`${id}-active`}
              onCheckedChange={field.handleChange}
            />
          </div>
        )}
      </form.Field>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <div data-mobile-form-actions className="grid grid-cols-2 gap-2 [&>*]:w-full">
            <Button
              data-mobile-cancel
              disabled={submitting}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? "Salvando..." : rule ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function createEmptyCondition(): EditableCondition {
  return {
    formKey: crypto.randomUUID(),
    field: "originalText",
    operator: "contains",
    value: "",
  };
}

function getOperatorLabel(operator: string) {
  return (
    inboxRuleAmountOperatorLabels[operator as keyof typeof inboxRuleAmountOperatorLabels] ??
    inboxRuleTextOperatorLabels[operator as keyof typeof inboxRuleTextOperatorLabels]
  );
}

function NotFilledOption() {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <CircleOff aria-hidden="true" className="size-4 text-muted-foreground" />
      <span>Não preencher</span>
    </span>
  );
}

function PersonOption({ person }: { person?: PersonOutput }) {
  if (!person) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <CircleOff aria-hidden="true" className="size-3.5" />
        </span>
        <span>Não preencher</span>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        <AvatarImage alt={`Avatar de ${person.name}`} src={person.avatarUrl ?? undefined} />
        <AvatarFallback>{getPersonInitials(person.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{person.name}</span>
    </span>
  );
}

function getPersonInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}
