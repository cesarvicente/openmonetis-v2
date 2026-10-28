import type { CategoryTrendRecurringRule } from "@openmonetis/domain/category-trends";
import {
  type CommitmentSingleEntry,
  calculateCommitments,
  countCommitmentMonths,
} from "@openmonetis/domain/commitments";
import type { InstallmentReportRow } from "@openmonetis/domain/installments";
import { getPeriodEndDate } from "@openmonetis/domain/transactions";
import type { CommitmentsOutput, ListCommitmentsQuery } from "@openmonetis/validators/commitments";

export type CommitmentsRepository = {
  listInstallmentRowsForUser(userId: string): Promise<InstallmentReportRow[]>;
  listRecurringRulesForUser(userId: string, periodEnd: Date): Promise<CategoryTrendRecurringRule[]>;
  listSingleEntriesForUser(
    userId: string,
    startPeriod: string,
    endPeriod: string,
  ): Promise<CommitmentSingleEntry[]>;
};

export function createCommitmentsService(repository: CommitmentsRepository) {
  return {
    async list(userId: string, query: ListCommitmentsQuery): Promise<CommitmentsOutput> {
      const { startPeriod, endPeriod } = query;
      const [installmentRows, recurringRules, singleEntries] = await Promise.all([
        repository.listInstallmentRowsForUser(userId),
        repository.listRecurringRulesForUser(userId, getPeriodEndDate(endPeriod)),
        repository.listSingleEntriesForUser(userId, startPeriod, endPeriod),
      ]);
      return calculateCommitments({
        period: startPeriod,
        months: countCommitmentMonths(startPeriod, endPeriod),
        installmentRows,
        recurringRules,
        singleEntries,
      });
    },
  };
}

export type CommitmentsService = ReturnType<typeof createCommitmentsService>;
