import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TransactionActor, TransactionCatalogs } from "../../../domain/transaction";
import { TransactionEditorSheet } from "./transaction-editor-sheet";

afterEach(cleanup);

const actor: TransactionActor = { email: "tesorero@icba.pe", displayName: "Tesorería" };

const catalogs: TransactionCatalogs = {
  accounts: [
    { id: "acc-interbank", name: "Cuenta Interbank", active: true, order: 1 },
    { id: "acc-caja", name: "Caja Chica", active: true, order: 2 },
    { id: "acc-bcp", name: "BCP Soles", active: true, order: 3 },
  ],
  categories: [
    { id: "cat-ofrenda", name: "Ofrenda", active: true, order: 1, type: "INGRESO" },
    { id: "cat-diezmo", name: "Diezmos", active: true, order: 2, type: "INGRESO" },
    { id: "cat-servicios", name: "Servicios", active: true, order: 3, type: "EGRESO" },
  ],
  subcategories: [],
  thirdParties: [
    { id: "tp-membresia", name: "Membresía", active: true, role: "DONANTE" },
    { id: "tp-proveedor", name: "Proveedor X", active: true, role: "PROVEEDOR" },
  ],
  paymentMethods: [
    { id: "pm-transferencia", name: "Transferencia", active: true, order: 1 },
    { id: "pm-efectivo", name: "Efectivo", active: true, order: 2 },
  ],
  writeCapability: { status: "enabled", reason: null },
};

const renderEditor = (initialType: "INGRESO" | "EGRESO" | "TRANSFERENCIA" = "INGRESO") =>
  render(
    <TransactionEditorSheet
      open
      mode="create"
      initialType={initialType}
      transaction={null}
      catalogs={catalogs}
      actor={actor}
      onClose={vi.fn()}
      onSave={vi.fn().mockResolvedValue(undefined)}
    />,
  );

const currentValue = (label: string): string => {
  const trigger = screen.getByRole("button", { name: new RegExp(label) });
  return trigger.textContent ?? "";
};

describe("TransactionEditorSheet — defaults e interacción", () => {
  it("arranca en Ingreso con Caja Chica y ofrenda con donante Membresía", () => {
    renderEditor("INGRESO");
    expect(screen.getByLabelText("Ingreso")).toBeChecked();
    expect(currentValue("Cuenta")).toContain("Caja Chica");
    expect(currentValue("Categoría")).toContain("Ofrenda");
    expect(currentValue("Donante")).toContain("Membresía");
  });

  it("bloquea el tipo de pago en Efectivo cuando la cuenta es Caja Chica", () => {
    renderEditor("INGRESO");
    expect(screen.getByText("Caja Chica siempre paga en efectivo.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tipo de pago/ })).not.toBeInTheDocument();
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
  });

  it("al cambiar a una cuenta que no es Caja Chica ofrece el selector con Transferencia", async () => {
    const user = userEvent.setup();
    renderEditor("INGRESO");

    await user.click(screen.getByRole("button", { name: /Cuenta/ }));
    const dialog = screen.getByRole("dialog", { name: "Cuenta" });
    await user.click(within(dialog).getByRole("button", { name: /BCP Soles/ }));

    expect(screen.getByRole("button", { name: /Tipo de pago/ })).toHaveTextContent("Transferencia");
  });

  it("usa Cuenta Interbank y Transferencia al iniciar como Egreso", () => {
    renderEditor("EGRESO");
    expect(currentValue("Cuenta")).toContain("Cuenta Interbank");
    expect(screen.getByRole("button", { name: /Tipo de pago/ })).toHaveTextContent("Transferencia");
  });

  it("re-siembra la cuenta por defecto al alternar el tipo de transacción", async () => {
    const user = userEvent.setup();
    renderEditor("INGRESO");
    expect(currentValue("Cuenta")).toContain("Caja Chica");

    await user.click(screen.getByLabelText("Egreso"));
    expect(currentValue("Cuenta")).toContain("Cuenta Interbank");

    await user.click(screen.getByLabelText("Ingreso"));
    expect(currentValue("Cuenta")).toContain("Caja Chica");
  });

  it("autocompleta el donante con Membresía al elegir una categoría de ofrenda", async () => {
    const user = userEvent.setup();
    renderEditor("INGRESO");

    // Cambiamos a Diezmos y limpiamos el donante.
    await user.click(screen.getByRole("button", { name: /Categoría/ }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Categoría" })).getByRole("button", {
        name: /Diezmos/,
      }),
    );
    expect(currentValue("Donante")).toContain("Membresía");

    await user.click(screen.getByRole("button", { name: /Donante/ }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Donante" })).getByRole("button", {
        name: "Sin especificar",
      }),
    );
    expect(currentValue("Donante")).toContain("Seleccionar");

    await user.click(screen.getByRole("button", { name: /Categoría/ }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Categoría" })).getByRole("button", {
        name: /Ofrenda/,
      }),
    );
    expect(currentValue("Donante")).toContain("Membresía");
  });

  it("muestra la fecha de hoy por defecto", () => {
    renderEditor("INGRESO");
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    expect(screen.getByLabelText(/Fecha/)).toHaveValue(today);
  });
});
