import { describe, expect, it } from "vitest";
import type { TransactionCatalogItem } from "../../../domain/transaction";
import {
  isCashAccount,
  isOfferingCategory,
  resolveDefaultAccount,
  resolveDefaultPaymentMethod,
  resolveMembershipDonor,
} from "./transaction-defaults";

const item = (name: string, active = true): TransactionCatalogItem => ({
  id: `id-${name}`,
  name,
  active,
  order: 1,
});

describe("resolveDefaultAccount", () => {
  const accounts = [item("Cuenta Interbank"), item("Caja Chica"), item("BCP Soles")];

  it("usa Caja Chica para ingresos", () => {
    expect(resolveDefaultAccount(accounts, "INGRESO")?.name).toBe("Caja Chica");
  });

  it("usa Cuenta Interbank para egresos", () => {
    expect(resolveDefaultAccount(accounts, "EGRESO")?.name).toBe("Cuenta Interbank");
  });

  it("tolera acentos y mayúsculas en el catálogo", () => {
    const accented = [item("caja CHICA parroquial")];
    expect(resolveDefaultAccount(accented, "INGRESO")?.name).toBe("caja CHICA parroquial");
  });

  it("cae al primer activo cuando no hay coincidencia", () => {
    const others = [item("Vieja", false), item("Yape"), item("Plin")];
    expect(resolveDefaultAccount(others, "INGRESO")?.name).toBe("Yape");
  });

  it("para transferencia toma el primer activo", () => {
    expect(resolveDefaultAccount(accounts, "TRANSFERENCIA")?.name).toBe("Cuenta Interbank");
  });
});

describe("resolveDefaultPaymentMethod", () => {
  const methods = [item("Transferencia"), item("Efectivo"), item("Tarjeta")];

  it("es Efectivo cuando la cuenta es Caja Chica", () => {
    expect(resolveDefaultPaymentMethod(methods, "Caja Chica")?.name).toBe("Efectivo");
  });

  it("es Transferencia para cualquier otra cuenta", () => {
    expect(resolveDefaultPaymentMethod(methods, "Cuenta Interbank")?.name).toBe("Transferencia");
  });

  it("cae al primer activo cuando falta el método", () => {
    expect(resolveDefaultPaymentMethod([item("Otro")], "Cuenta X")?.name).toBe("Otro");
  });
});

describe("isCashAccount / isOfferingCategory", () => {
  it("detecta Caja Chica", () => {
    expect(isCashAccount("Caja Chica ICBA")).toBe(true);
    expect(isCashAccount("Cuenta Interbank")).toBe(false);
    expect(isCashAccount(null)).toBe(false);
  });

  it("detecta ofrenda en singular y plural", () => {
    expect(isOfferingCategory("Ofrenda")).toBe(true);
    expect(isOfferingCategory("Ofrendas")).toBe(true);
    expect(isOfferingCategory("Diezmos")).toBe(false);
  });
});

describe("resolveMembershipDonor", () => {
  it("usa el donante del catálogo cuando existe", () => {
    const donor = resolveMembershipDonor([item("Membresía general")]);
    expect(donor.name).toBe("Membresía general");
  });

  it("crea uno local cuando no está en el catálogo", () => {
    const donor = resolveMembershipDonor([item("Anónimo")]);
    expect(donor.name).toBe("Membresía");
    expect(donor.id).toContain("membresia");
  });
});
