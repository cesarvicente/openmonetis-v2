import { findAccountByIdForUser } from "./repositories/accounts.repository";
import { findCardByIdForUser } from "./repositories/cards.repository";
import {
  findCategoryByIdForUser,
  findSystemCategoryByNameForUser,
  listCategoriesByIdsForUser,
  listCategoryFamilyIdsForUser,
} from "./repositories/categories.repository";
import { dueDateRulesRepository } from "./repositories/due-date-rules.repository";
import { externalExpensesRepository } from "./repositories/external-expenses.repository";
import * as partialPaymentsRepository from "./repositories/partial-payments.repository";
import {
  findAdminPersonByUserId,
  findPersonByIdForUser,
  listPeopleByIdsForUser,
} from "./repositories/people.repository";
import { transitionRecurringRuleForUser } from "./repositories/recurring-transactions.repository";
import { listTagsByIdsForUser } from "./repositories/tags.repository";
import * as transactionsRepository from "./repositories/transactions.repository";
import type { createAccountsService } from "./services/accounts.service";
import type { createAttachmentsService } from "./services/attachments.service";
import { synchronizeRecurringExternalExpenses } from "./services/external-expenses.service";
import type { InvoicesService } from "./services/invoices.service";
import { createTransactionsService } from "./services/transactions.service";

/** Wires the transactions service to its repositories; shared by the API and the workers. */
export function createDefaultTransactionsService(
  accountsService: ReturnType<typeof createAccountsService>,
  attachmentsService: ReturnType<typeof createAttachmentsService>,
  invoicesService?: Pick<InvoicesService, "listOverdue">,
) {
  return createTransactionsService(
    {
      ...transactionsRepository,
      ...partialPaymentsRepository,
      dueDateRules: dueDateRulesRepository,
      listOverdueInvoices: invoicesService?.listOverdue,
      transitionRecurringRuleForUser,
      findAccountByIdForUser,
      findAdminPersonByUserId,
      findCardByIdForUser,
      findCategoryByIdForUser,
      findPersonByIdForUser,
      findSystemCategoryByNameForUser,
      getAccountBalanceSnapshotForUser: accountsService.getBalanceSnapshot,
      listCategoriesByIdsForUser,
      listCategoryFamilyIdsForUser,
      listTagsByIdsForUser,
      listPeopleByIdsForUser,
    },
    attachmentsService,
    {
      synchronize: (ownerUserId, period) =>
        synchronizeRecurringExternalExpenses(externalExpensesRepository, { ownerUserId, period }),
    },
  );
}
