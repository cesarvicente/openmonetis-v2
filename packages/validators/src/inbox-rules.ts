import { z } from "@hono/zod-openapi";
import {
  defaultInboxRuleAction,
  inboxRuleActions,
  inboxRuleAppliedFields,
  inboxRuleConditionValueMaximumLength,
  inboxRuleFillsAnyField,
  inboxRuleMatchModes,
  inboxRuleMaximumConditions,
  inboxRuleNameMaximumLength,
  inboxRuleNumericConditionOperators,
  inboxRulePriorityMaximum,
  inboxRulePriorityMinimum,
  inboxRuleTextConditionFields,
  inboxRuleTextConditionOperators,
  inboxRuleTransactionTypes,
  isValidInboxRuleDiscard,
  isValidInboxRulePaymentTarget,
} from "@openmonetis/domain/inbox-rules";
import { paymentMethods } from "@openmonetis/domain/transactions";

const InboxRuleNameSchema = z.string().trim().min(1).max(inboxRuleNameMaximumLength);
const InboxRulePrioritySchema = z
  .number()
  .int()
  .min(inboxRulePriorityMinimum)
  .max(inboxRulePriorityMaximum);

const InboxRuleTextConditionSchema = z
  .object({
    field: z.enum(inboxRuleTextConditionFields),
    operator: z.enum(inboxRuleTextConditionOperators),
    value: z.string().trim().min(1).max(inboxRuleConditionValueMaximumLength),
  })
  .strict();

const InboxRuleAmountConditionSchema = z
  .object({
    field: z.literal("parsedAmount"),
    operator: z.enum(inboxRuleNumericConditionOperators),
    value: z.number().positive().max(999_999_999.99),
  })
  .strict();

export const InboxRuleConditionSchema = z
  .union([InboxRuleTextConditionSchema, InboxRuleAmountConditionSchema])
  .openapi("InboxRuleCondition");

const InboxRuleEditableFieldsSchema = z
  .object({
    name: InboxRuleNameSchema,
    priority: InboxRulePrioritySchema,
    isActive: z.boolean(),
    matchMode: z.enum(inboxRuleMatchModes),
    conditions: z.array(InboxRuleConditionSchema).min(1).max(inboxRuleMaximumConditions),
    action: z.enum(inboxRuleActions).default(defaultInboxRuleAction).openapi({
      description:
        "fill suggests fields in the review; discard discards matching captures as they arrive.",
    }),
    transactionType: z.enum(inboxRuleTransactionTypes).nullable().default(null).openapi({
      description: "Suggested transaction type; null keeps the default (expense).",
    }),
    categoryId: z.uuid().nullable(),
    personId: z.uuid().nullable(),
    paymentMethod: z.enum(paymentMethods).nullable().default(null),
    cardId: z.uuid().nullable().default(null),
    accountId: z.uuid().nullable().default(null),
  })
  .strict()
  .refine((input) => input.action === "discard" || inboxRuleFillsAnyField(input), {
    message: "At least one action is required",
  })
  .refine(isValidInboxRuleDiscard, {
    message: "Discard rules cannot fill transaction fields",
    path: ["action"],
  })
  .refine(isValidInboxRulePaymentTarget, {
    message: "Only credit card rules can fill a card and only other payment methods an account",
    path: ["paymentMethod"],
  });

export const CreateInboxRuleInputSchema =
  InboxRuleEditableFieldsSchema.openapi("CreateInboxRuleInput");

export const ReplaceInboxRuleInputSchema = InboxRuleEditableFieldsSchema.safeExtend({
  expectedVersion: z.number().int().positive(),
}).openapi("ReplaceInboxRuleInput");

export const SetInboxRuleActiveInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    isActive: z.boolean(),
  })
  .strict()
  .openapi("SetInboxRuleActiveInput");

export const InboxRuleParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("InboxRuleParams");

export const InboxRuleSuggestionParamsSchema = z
  .object({
    inboxItemId: z.uuid().openapi({ param: { name: "inboxItemId", in: "path" } }),
  })
  .openapi("InboxRuleSuggestionParams");

export const DeleteInboxRuleQuerySchema = z
  .object({ expectedVersion: z.coerce.number().int().positive() })
  .openapi("DeleteInboxRuleQuery");

const InboxRuleTargetOutputSchema = z.object({ id: z.uuid(), name: z.string() });

export const InboxRuleOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    priority: z.number().int(),
    isActive: z.boolean(),
    matchMode: z.enum(inboxRuleMatchModes),
    conditions: z.array(InboxRuleConditionSchema),
    action: z.enum(inboxRuleActions),
    transactionType: z.enum(inboxRuleTransactionTypes).nullable(),
    category: InboxRuleTargetOutputSchema.nullable(),
    person: InboxRuleTargetOutputSchema.nullable(),
    paymentMethod: z.enum(paymentMethods).nullable(),
    card: InboxRuleTargetOutputSchema.nullable(),
    account: InboxRuleTargetOutputSchema.nullable(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("InboxRule");

export const InboxRulesListOutputSchema = z
  .object({
    items: z.array(InboxRuleOutputSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("InboxRulesList");

export const InboxRuleSuggestionOutputSchema = z
  .object({
    transactionType: z.enum(inboxRuleTransactionTypes).nullable(),
    categoryId: z.uuid().nullable(),
    personId: z.uuid().nullable(),
    paymentMethod: z.enum(paymentMethods).nullable(),
    cardId: z.uuid().nullable(),
    accountId: z.uuid().nullable(),
    appliedRules: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        fields: z.array(z.enum(inboxRuleAppliedFields)).min(1),
      }),
    ),
  })
  .openapi("InboxRuleSuggestion");

export type InboxRuleCondition = z.infer<typeof InboxRuleConditionSchema>;
export type CreateInboxRuleInput = z.infer<typeof CreateInboxRuleInputSchema>;
export type ReplaceInboxRuleInput = z.infer<typeof ReplaceInboxRuleInputSchema>;
export type SetInboxRuleActiveInput = z.infer<typeof SetInboxRuleActiveInputSchema>;
export type InboxRuleOutput = z.infer<typeof InboxRuleOutputSchema>;
export type InboxRulesListOutput = z.infer<typeof InboxRulesListOutputSchema>;
export type InboxRuleSuggestionOutput = z.infer<typeof InboxRuleSuggestionOutputSchema>;
