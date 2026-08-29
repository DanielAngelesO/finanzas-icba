import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { groupLogicalTransactions } from "../../../domain/logical-transaction";
import type { LogicalTransaction, Transaction } from "../../../domain/transaction";
import { makeTransaction } from "../../../test/fixtures";
import { formatPreviewDate } from "../../formatters";
import { TransactionList } from "./transaction-list";

afterEach(cleanup);

const single = (overrides: Partial<Transaction>): LogicalTransaction => {
  const [logical] = groupLogicalTransactions([makeTransaction(overrides)]);
  if (!logical) throw new Error("No se creó la transacción lógica de prueba.");
  return logical;
};

const renderList = (transactions: LogicalTransaction[]) =>
  render(<TransactionList transactions={transactions} onOpen={() => {}} />);

describe("TransactionList — tabla de escritorio", () => {
  it("muestra el donante en el preview de un diezmo", () => {
    renderList([
      single({
        transactionId: "TX-DIEZMO",
        type: "INGRESO",
        category: "Diezmos",
        description: "Diezmo mensual",
        donorOrProvider: "Juan Pérez",
      }),
    ]);

    const table = screen.getByRole("table", { name: "Movimientos encontrados" });
    expect(within(table).getByText("Juan Pérez")).toBeInTheDocument();
    expect(within(table).getByText("Diezmos")).toBeInTheDocument();
  });

  it("expone en columnas cada campo que el usuario registró", () => {
    renderList([
      single({
        transactionId: "TX-COMPLETA",
        type: "EGRESO",
        account: "Cuenta Interbank",
        category: "Servicios",
        subcategory: "Luz",
        description: "Recibo de agosto",
        donorOrProvider: "Enel",
        paymentMethod: "Transferencia",
        referenceOrReceipt: "F001-123",
        notes: "Pagado con cargo automático",
      }),
    ]);

    const table = screen.getByRole("table", { name: "Movimientos encontrados" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers).toEqual([
      "Fecha",
      "Tipo",
      "Categoría / Subcategoría",
      "Donante / Proveedor",
      "Cuenta / Pago",
      "Monto",
      "Descripción / Comprobante",
    ]);

    const row = within(table).getAllByRole("row")[1];
    if (!row) throw new Error("La tabla no renderizó la fila de la transacción.");
    ["Servicios", "Luz", "Enel", "Cuenta Interbank", "Transferencia", "F001-123"].forEach(
      (value) => {
        expect(within(row).getByText(value)).toBeInTheDocument();
      },
    );
    expect(within(row).getByRole("button", { name: /Recibo de agosto/ })).toBeInTheDocument();
    expect(within(row).getByText(/Tiene notas: Pagado con cargo automático/)).toBeInTheDocument();
  });

  it("marca con guion los campos que no aplican a una transferencia", () => {
    renderList([
      single({
        transactionId: "TX-SIN-DATOS",
        type: "EGRESO",
        category: "Servicios",
        description: null,
        subcategory: null,
        referenceOrReceipt: null,
      }),
    ]);

    const table = screen.getByRole("table", { name: "Movimientos encontrados" });
    const row = within(table).getAllByRole("row")[1];
    if (!row) throw new Error("La tabla no renderizó la fila de la transacción.");
    expect(within(row).getByRole("button", { name: /Sin descripción/ })).toBeInTheDocument();
    expect(within(row).getAllByText("—")).toHaveLength(1);
  });

  it("muestra la fecha de preview de la ofrenda en la fila móvil, con la cuenta al final", () => {
    const transaction = single({
      transactionId: "TX-OFRENDA-MOVIL",
      type: "INGRESO",
      category: "Ofrendas",
      description: "Ofrenda dominical",
      account: "Caja",
    });
    renderList([transaction]);

    const mobileRow = screen.getByRole("button", { name: /Ingreso: Ofrenda dominical/ });
    const meta = mobileRow.querySelector(".transaction-row-meta");
    expect(meta?.textContent).toContain(formatPreviewDate(transaction.date));
    // La cuenta aparece después de la fecha de preview.
    expect(meta?.textContent?.trim().endsWith("Caja")).toBe(true);
  });

  it("no duplica la categoría cuando ya es el concepto", () => {
    renderList([
      single({
        transactionId: "TX-EGRESO",
        type: "EGRESO",
        category: "Servicios",
        description: null,
      }),
    ]);

    const table = screen.getByRole("table", { name: "Movimientos encontrados" });
    expect(within(table).getAllByText("Servicios")).toHaveLength(1);
  });
});
