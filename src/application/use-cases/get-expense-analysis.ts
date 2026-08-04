import type {
  ExpenseAnalysisCriteria,
  ExpenseAnalysisReport,
  ExpenseAnalysisFilters,
  ExpenseBreakdownItem,
  ExpenseCapabilities,
  ExpenseDetailCriteria,
  ExpenseFacets,
  ExpensePageSize,
  ExpensePagination,
  ExpenseRange,
  ExpenseReviewSignal,
  ExpenseReviewSignalSummary,
  ExpenseSummary,
  ExpenseTrendPoint,
} from "../../domain/expense-analysis";
import { defaultExpenseAnalysisCriteria, expensePageSizes } from "../../domain/expense-analysis";
import type { Transaction } from "../../domain/transaction";
import type { TransactionRepository } from "../ports/transaction-repository";

const periodPattern = /^\d{6}$/;
const salariesAndFeesCategory = "salarios y honorarios";
const cashPaymentMethods = new Set(["efectivo", "cash"]);
const maximumCategories = 8;
const maximumSubcategories = 8;
const maximumProviders = 10;
const maximumPaymentMethods = 8;

const collator = new Intl.Collator("es-PE", { sensitivity: "base", numeric: true });

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " y ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-PE");

const isValidPeriod = (period: string | null): period is string => {
  if (!period || !periodPattern.test(period)) return false;
  const month = Number(period.slice(4, 6));
  return month >= 1 && month <= 12;
};

const shiftPeriod = (period: string, months: number): string => {
  const year = Number(period.slice(0, 4));
  const monthIndex = Number(period.slice(4, 6)) - 1 + months;
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return String(date.getUTCFullYear()) + String(date.getUTCMonth() + 1).padStart(2, "0");
};

const getPeriods = (fromPeriod: string, toPeriod: string): string[] => {
  const periods: string[] = [];
  let current = fromPeriod;
  while (current <= toPeriod) {
    periods.push(current);
    current = shiftPeriod(current, 1);
  }
  return periods;
};

const sumAmounts = (transactions: Transaction[]): number =>
  transactions.reduce((total, transaction) => total + transaction.amount, 0);

const isSalaryAndFeesExpense = (transaction: Transaction): boolean =>
  transaction.type === "EGRESO" && normalizeText(transaction.category) === salariesAndFeesCategory;

const isCashPayment = (transaction: Transaction): boolean =>
  cashPaymentMethods.has(normalizeText(transaction.paymentMethod));

const getCapabilities = (
  inspection: Awaited<ReturnType<TransactionRepository["inspect"]>>,
): ExpenseCapabilities => {
  const missingOptionalColumn = (field: string): boolean =>
    inspection.issues.some(
      (issue) => issue.code === "MISSING_OPTIONAL_COLUMN" && issue.field === field,
    );
  return {
    hasSubcategory: !missingOptionalColumn("Subcategoría"),
    hasProvider: !missingOptionalColumn("Donante / Proveedor"),
    hasReferenceOrReceipt: !missingOptionalColumn("Referencia / Comprobante"),
  };
};

const resolveRange = (
  availablePeriods: string[],
  filters: ExpenseAnalysisFilters,
): ExpenseRange | null => {
  const latestPeriod = availablePeriods[0];
  if (!latestPeriod) return null;

  const requestedFromPeriod = filters.fromPeriod;
  const requestedToPeriod = filters.toPeriod;
  const toPeriod = isValidPeriod(requestedToPeriod) ? requestedToPeriod : latestPeriod;
  const fromPeriod = isValidPeriod(requestedFromPeriod)
    ? requestedFromPeriod
    : shiftPeriod(toPeriod, -11);

  if (fromPeriod > toPeriod) {
    const defaultToPeriod = latestPeriod;
    const defaultFromPeriod = shiftPeriod(defaultToPeriod, -11);
    const defaultPeriods = getPeriods(defaultFromPeriod, defaultToPeriod);
    return {
      fromPeriod: defaultFromPeriod,
      toPeriod: defaultToPeriod,
      periods: defaultPeriods,
      comparisonFromPeriod: shiftPeriod(defaultFromPeriod, -defaultPeriods.length),
      comparisonToPeriod: shiftPeriod(defaultFromPeriod, -1),
    };
  }

  const periods = getPeriods(fromPeriod, toPeriod);
  return {
    fromPeriod,
    toPeriod,
    periods,
    comparisonFromPeriod: shiftPeriod(fromPeriod, -periods.length),
    comparisonToPeriod: shiftPeriod(fromPeriod, -1),
  };
};

const matchesAnalysisFilters = (
  transaction: Transaction,
  filters: ExpenseAnalysisFilters,
  range: Pick<ExpenseRange, "fromPeriod" | "toPeriod">,
): boolean =>
  transaction.type === "EGRESO" &&
  transaction.period >= range.fromPeriod &&
  transaction.period <= range.toPeriod &&
  (!filters.account || transaction.account === filters.account) &&
  (!filters.category || transaction.category === filters.category) &&
  (!filters.subcategory || transaction.subcategory === filters.subcategory) &&
  (!filters.provider || transaction.donorOrProvider === filters.provider) &&
  (!filters.responsible || transaction.responsible === filters.responsible) &&
  (!filters.paymentMethod || transaction.paymentMethod === filters.paymentMethod) &&
  (!filters.status || transaction.status === filters.status) &&
  (!filters.excludeSalariesAndFees || !isSalaryAndFeesExpense(transaction));

const getFacets = (
  transactions: Transaction[],
  capabilities: ExpenseCapabilities,
): ExpenseFacets => {
  const sortValues = (values: Iterable<string>): string[] =>
    [...new Set(values)].sort(collator.compare);
  return {
    accounts: sortValues(transactions.map((transaction) => transaction.account)),
    categories: sortValues(transactions.map((transaction) => transaction.category)),
    subcategories: capabilities.hasSubcategory
      ? sortValues(
          transactions.flatMap((transaction) =>
            transaction.subcategory === null ? [] : [transaction.subcategory],
          ),
        )
      : [],
    providers: capabilities.hasProvider
      ? sortValues(
          transactions.flatMap((transaction) =>
            transaction.donorOrProvider === null ? [] : [transaction.donorOrProvider],
          ),
        )
      : [],
    responsibles: sortValues(transactions.map((transaction) => transaction.responsible)),
    paymentMethods: sortValues(transactions.map((transaction) => transaction.paymentMethod)),
    statuses: sortValues(transactions.map((transaction) => transaction.status)),
  };
};

interface BreakdownValue {
  label: string;
  amount: number;
  transactionCount: number;
}

const getBreakdown = (
  transactions: Transaction[],
  getValue: (transaction: Transaction) => string | null,
  maximumValues: number,
  missingLabel: string | null,
): ExpenseBreakdownItem[] => {
  const byValue = new Map<string, BreakdownValue>();
  let missingAmount = 0;
  let missingTransactionCount = 0;

  for (const transaction of transactions) {
    const value = getValue(transaction);
    if (value === null) {
      missingAmount += transaction.amount;
      missingTransactionCount += 1;
      continue;
    }
    const current = byValue.get(value) ?? { label: value, amount: 0, transactionCount: 0 };
    byValue.set(value, {
      label: current.label,
      amount: current.amount + transaction.amount,
      transactionCount: current.transactionCount + 1,
    });
  }

  const total = sumAmounts(transactions);
  const createItem = (
    kind: ExpenseBreakdownItem["kind"],
    value: string | null,
    item: BreakdownValue,
  ): ExpenseBreakdownItem => ({
    kind,
    label: item.label,
    value,
    amount: item.amount,
    transactionCount: item.transactionCount,
    share: total === 0 ? 0 : item.amount / total,
  });

  const ordered = [...byValue.entries()].sort(
    ([leftValue, left], [rightValue, right]) =>
      right.amount - left.amount || collator.compare(leftValue, rightValue),
  );
  const visible = ordered.slice(0, maximumValues);
  const remaining = ordered.slice(maximumValues).reduce(
    (totalValue, [, item]) => ({
      label: "Otros",
      amount: totalValue.amount + item.amount,
      transactionCount: totalValue.transactionCount + item.transactionCount,
    }),
    { label: "Otros", amount: 0, transactionCount: 0 },
  );
  const result = visible.map(([value, item]) => createItem("value", value, item));
  if (missingTransactionCount > 0) {
    result.push(
      createItem("missing", null, {
        label: missingLabel ?? "Sin información",
        amount: missingAmount,
        transactionCount: missingTransactionCount,
      }),
    );
  }
  if (remaining.amount > 0) result.push(createItem("other", null, remaining));
  return result;
};

const getDuplicateReferenceTransactions = (transactions: Transaction[]): Transaction[] => {
  const byReference = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (transaction.referenceOrReceipt === null) continue;
    const reference = normalizeText(transaction.referenceOrReceipt);
    if (!reference) continue;
    const matches = byReference.get(reference) ?? [];
    matches.push(transaction);
    byReference.set(reference, matches);
  }
  return [...byReference.values()].flatMap((matches) => (matches.length > 1 ? matches : []));
};

const getDuplicateReferenceGroupCount = (transactions: Transaction[]): number => {
  const references = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.referenceOrReceipt === null) continue;
    const reference = normalizeText(transaction.referenceOrReceipt);
    if (reference) references.set(reference, (references.get(reference) ?? 0) + 1);
  }
  return [...references.values()].filter((count) => count > 1).length;
};

const getSignals = (
  transactions: Transaction[],
  capabilities: ExpenseCapabilities,
): Record<ExpenseReviewSignal, ExpenseReviewSignalSummary> => {
  const missingReference = capabilities.hasReferenceOrReceipt
    ? transactions.filter((transaction) => transaction.referenceOrReceipt === null)
    : [];
  const cashPayment = transactions.filter(isCashPayment);
  const duplicateReference = capabilities.hasReferenceOrReceipt
    ? getDuplicateReferenceTransactions(transactions)
    : [];

  const createSignal = (
    signal: ExpenseReviewSignal,
    matches: Transaction[],
    available: boolean,
    groupCount = 0,
  ): ExpenseReviewSignalSummary => ({
    signal,
    available,
    amount: sumAmounts(matches),
    transactionCount: matches.length,
    groupCount,
  });

  return {
    "missing-reference": createSignal(
      "missing-reference",
      missingReference,
      capabilities.hasReferenceOrReceipt,
    ),
    "cash-payment": createSignal("cash-payment", cashPayment, true),
    "duplicate-reference": createSignal(
      "duplicate-reference",
      duplicateReference,
      capabilities.hasReferenceOrReceipt,
      capabilities.hasReferenceOrReceipt ? getDuplicateReferenceGroupCount(transactions) : 0,
    ),
  };
};

const getSignalTransactions = (
  signal: ExpenseReviewSignal | null,
  transactions: Transaction[],
  capabilities: ExpenseCapabilities,
): Transaction[] => {
  if (!signal) return transactions;
  if (signal === "missing-reference") {
    return capabilities.hasReferenceOrReceipt
      ? transactions.filter((transaction) => transaction.referenceOrReceipt === null)
      : [];
  }
  if (signal === "cash-payment") return transactions.filter(isCashPayment);
  return capabilities.hasReferenceOrReceipt ? getDuplicateReferenceTransactions(transactions) : [];
};

const matchesSearch = (transaction: Transaction, search: string): boolean => {
  if (!search) return true;
  return [
    transaction.id,
    transaction.description,
    transaction.category,
    transaction.subcategory,
    transaction.account,
    transaction.responsible,
    transaction.donorOrProvider,
    transaction.paymentMethod,
    transaction.referenceOrReceipt,
    transaction.status,
  ].some((value) => value !== null && normalizeText(value).includes(search));
};

const compareTransactions = (
  left: Transaction,
  right: Transaction,
  sort: ExpenseDetailCriteria["sort"],
): number => {
  const byNewestFirst = (): number =>
    right.date.getTime() - left.date.getTime() || collator.compare(left.id, right.id);
  if (sort === "date-desc") return byNewestFirst();
  if (sort === "date-asc") {
    return left.date.getTime() - right.date.getTime() || collator.compare(left.id, right.id);
  }
  if (sort === "amount-desc") return right.amount - left.amount || byNewestFirst();
  return left.amount - right.amount || byNewestFirst();
};

const getPageSize = (pageSize: ExpensePageSize): ExpensePageSize =>
  expensePageSizes.find((size) => size === pageSize) ??
  defaultExpenseAnalysisCriteria.detail.pageSize;

const getPagination = (
  total: number,
  page: number,
  pageSize: ExpensePageSize,
): ExpensePagination => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(Math.max(1, Math.trunc(page)), totalPages);
  const firstResult = total === 0 ? 0 : (normalizedPage - 1) * pageSize + 1;
  const lastResult = total === 0 ? 0 : Math.min(normalizedPage * pageSize, total);
  return {
    total,
    page: normalizedPage,
    pageSize,
    totalPages,
    firstResult,
    lastResult,
  };
};

const getDataCutoff = (transactions: Transaction[]): Date | null =>
  transactions.reduce<Date | null>(
    (latest, transaction) =>
      latest === null || transaction.date.getTime() > latest.getTime() ? transaction.date : latest,
    null,
  );

export class GetExpenseAnalysisUseCase {
  public constructor(private readonly repository: TransactionRepository) {}

  public async execute(
    criteria: ExpenseAnalysisCriteria = defaultExpenseAnalysisCriteria,
  ): Promise<ExpenseAnalysisReport> {
    const inspection = await this.repository.inspect();
    const capabilities = getCapabilities(inspection);
    const allExpenses = inspection.transactions.filter(
      (transaction) => transaction.type === "EGRESO",
    );
    const availablePeriods = [
      ...new Set(inspection.transactions.map((transaction) => transaction.period)),
    ]
      .sort()
      .reverse();
    const range = resolveRange(availablePeriods, criteria.analysis);
    const facets = getFacets(allExpenses, capabilities);
    const emptySummary: ExpenseSummary = {
      totalAmount: 0,
      transactionCount: 0,
      averageMonthlyAmount: 0,
      previousAmount: 0,
      changeRate: null,
      salariesAndFeesAmount: 0,
      salariesAndFeesShare: 0,
      documentedAmount: capabilities.hasReferenceOrReceipt ? 0 : null,
      documentedShare: capabilities.hasReferenceOrReceipt ? 0 : null,
      leadingProvider: null,
      leadingProviderShare: null,
    };
    const emptyPagination = getPagination(
      0,
      criteria.detail.page,
      getPageSize(criteria.detail.pageSize),
    );
    const emptySignals = getSignals([], capabilities);

    if (!range) {
      return {
        availablePeriods,
        range: null,
        summary: emptySummary,
        trend: [],
        categories: [],
        subcategories: [],
        providers: [],
        paymentMethods: [],
        signals: emptySignals,
        facets,
        capabilities,
        transactions: [],
        pagination: emptyPagination,
        dataQuality: {
          totalDataRowCount: inspection.totalDataRowCount,
          validTransactionCount: inspection.validTransactionCount,
          invalidTransactionCount: inspection.invalidTransactionCount,
        },
        dataCutoff: null,
        inspectedAt: inspection.inspectedAt,
      };
    }

    const selectedTransactions = allExpenses.filter((transaction) =>
      matchesAnalysisFilters(transaction, criteria.analysis, range),
    );
    const comparisonRange = {
      fromPeriod: range.comparisonFromPeriod,
      toPeriod: range.comparisonToPeriod,
    };
    const comparisonTransactions = allExpenses.filter((transaction) =>
      matchesAnalysisFilters(transaction, criteria.analysis, comparisonRange),
    );
    const totalAmount = sumAmounts(selectedTransactions);
    const previousAmount = sumAmounts(comparisonTransactions);
    const salariesAndFeesAmount = sumAmounts(selectedTransactions.filter(isSalaryAndFeesExpense));
    const documentedAmount = capabilities.hasReferenceOrReceipt
      ? sumAmounts(
          selectedTransactions.filter((transaction) => transaction.referenceOrReceipt !== null),
        )
      : null;
    const providers = capabilities.hasProvider
      ? getBreakdown(
          selectedTransactions,
          (transaction) => transaction.donorOrProvider,
          maximumProviders,
          "Sin proveedor registrado",
        )
      : [];
    const leadingProvider = providers.find((provider) => provider.kind === "value") ?? null;
    const summary: ExpenseSummary = {
      totalAmount,
      transactionCount: selectedTransactions.length,
      averageMonthlyAmount: totalAmount / range.periods.length,
      previousAmount,
      changeRate: previousAmount === 0 ? null : (totalAmount - previousAmount) / previousAmount,
      salariesAndFeesAmount,
      salariesAndFeesShare: totalAmount === 0 ? 0 : salariesAndFeesAmount / totalAmount,
      documentedAmount,
      documentedShare:
        documentedAmount === null || totalAmount === 0
          ? documentedAmount === null
            ? null
            : 0
          : documentedAmount / totalAmount,
      leadingProvider: leadingProvider?.label ?? null,
      leadingProviderShare: leadingProvider?.share ?? null,
    };

    const selectedByPeriod = new Map<string, Transaction[]>();
    const comparisonByPeriod = new Map<string, Transaction[]>();
    for (const transaction of selectedTransactions) {
      const periodTransactions = selectedByPeriod.get(transaction.period) ?? [];
      periodTransactions.push(transaction);
      selectedByPeriod.set(transaction.period, periodTransactions);
    }
    for (const transaction of comparisonTransactions) {
      const periodTransactions = comparisonByPeriod.get(transaction.period) ?? [];
      periodTransactions.push(transaction);
      comparisonByPeriod.set(transaction.period, periodTransactions);
    }
    const trend: ExpenseTrendPoint[] = range.periods.map((period, index) => {
      const current = selectedByPeriod.get(period) ?? [];
      const comparisonPeriod = shiftPeriod(range.comparisonFromPeriod, index);
      const salaries = sumAmounts(current.filter(isSalaryAndFeesExpense));
      const amount = sumAmounts(current);
      return {
        period,
        comparisonPeriod,
        amount,
        comparisonAmount: sumAmounts(comparisonByPeriod.get(comparisonPeriod) ?? []),
        salariesAndFeesAmount: salaries,
        otherExpensesAmount: amount - salaries,
        transactionCount: current.length,
      };
    });
    const categories = getBreakdown(
      selectedTransactions,
      (transaction) => transaction.category,
      maximumCategories,
      null,
    );
    const subcategories = capabilities.hasSubcategory
      ? getBreakdown(
          selectedTransactions,
          (transaction) => transaction.subcategory,
          maximumSubcategories,
          "Sin subcategoría",
        )
      : [];
    const paymentMethods = getBreakdown(
      selectedTransactions,
      (transaction) => transaction.paymentMethod,
      maximumPaymentMethods,
      null,
    );
    const signals = getSignals(selectedTransactions, capabilities);
    const signalTransactions = getSignalTransactions(
      criteria.detail.signal,
      selectedTransactions,
      capabilities,
    );
    const normalizedSearch = normalizeText(criteria.detail.search);
    const sortedDetailTransactions = signalTransactions
      .filter((transaction) => matchesSearch(transaction, normalizedSearch))
      .sort((left, right) => compareTransactions(left, right, criteria.detail.sort));
    const pagination = getPagination(
      sortedDetailTransactions.length,
      criteria.detail.page,
      getPageSize(criteria.detail.pageSize),
    );
    const start = (pagination.page - 1) * pagination.pageSize;

    return {
      availablePeriods,
      range,
      summary,
      trend,
      categories,
      subcategories,
      providers,
      paymentMethods,
      signals,
      facets,
      capabilities,
      transactions: sortedDetailTransactions.slice(start, start + pagination.pageSize),
      pagination,
      dataQuality: {
        totalDataRowCount: inspection.totalDataRowCount,
        validTransactionCount: inspection.validTransactionCount,
        invalidTransactionCount: inspection.invalidTransactionCount,
      },
      dataCutoff: getDataCutoff(selectedTransactions),
      inspectedAt: inspection.inspectedAt,
    };
  }
}
