import { describe, expect, it } from "vitest";
import { defaultExpenseAnalysisCriteria } from "../domain/expense-analysis";
import { createReviewServices } from "./services";

describe("createReviewServices", () => {
  it("expone los doce períodos sintéticos y suficiente volumen para paginar", async () => {
    const services = createReviewServices();

    await expect(services.transactions.getAvailablePeriods()).resolves.toEqual([
      "202608",
      "202607",
      "202606",
      "202605",
      "202604",
      "202603",
      "202602",
      "202601",
      "202512",
      "202511",
      "202510",
      "202509",
    ]);

    const transactions = await services.transactions.findAll();
    expect(transactions).toHaveLength(96);
    expect(transactions.filter((transaction) => transaction.type === "TRANSFERENCIA")).toHaveLength(
      12,
    );
  });

  it("incluye señales de revisión y problemas de calidad deterministas", async () => {
    const services = createReviewServices();
    const report = await services.expenses.execute(defaultExpenseAnalysisCriteria);
    const inspection = await services.dataSource.inspect();

    expect(report.pagination.total).toBeGreaterThan(20);
    expect(report.signals["missing-reference"].transactionCount).toBeGreaterThan(0);
    expect(report.signals["cash-payment"].transactionCount).toBeGreaterThan(0);
    expect(report.signals["duplicate-reference"].groupCount).toBeGreaterThan(0);
    expect(report.capabilities).toEqual({
      hasSubcategory: true,
      hasProvider: true,
      hasReferenceOrReceipt: true,
    });
    expect(inspection.issues.map((issue) => issue.severity)).toEqual(["warning", "error"]);
    expect(inspection.invalidTransactionCount).toBe(1);
  });
});
