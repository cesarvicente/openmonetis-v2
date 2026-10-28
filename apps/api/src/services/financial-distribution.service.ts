import {
  calculateFinancialDistribution,
  compareFinancialDistribution,
  getPreviousDistributionPeriod,
} from "@openmonetis/domain/financial-distribution";
import { getPeriodEndDate } from "@openmonetis/domain/transactions";
import type { ListFinancialDistributionQuery } from "@openmonetis/validators/financial-distribution";
import type { CategoryTrendsRepository } from "./category-trends.service";

export type FinancialDistributionRepository = CategoryTrendsRepository;

export function createFinancialDistributionService(repository: FinancialDistributionRepository) {
  return {
    async list(userId: string, query: ListFinancialDistributionQuery) {
      const previousPeriod = getPreviousDistributionPeriod(query.period);
      const [categories, actualEntries, recurringRules] = await Promise.all([
        repository.listCategoriesForUser(userId),
        repository.listActualEntriesForUser(
          userId,
          previousPeriod,
          query.period,
          [],
          query.personScope,
        ),
        repository.listRecurringRulesForUser(
          userId,
          getPeriodEndDate(query.period),
          [],
          query.personScope,
        ),
      ]);
      const calculate = (period: string) =>
        calculateFinancialDistribution({
          mode: query.mode,
          period,
          categories,
          actualEntries,
          recurringRules,
        });
      const current = calculate(query.period);
      const previous = calculate(previousPeriod);
      return { ...current, ...compareFinancialDistribution(current, previous) };
    },
  };
}

export type FinancialDistributionService = ReturnType<typeof createFinancialDistributionService>;
