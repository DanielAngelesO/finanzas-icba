import { describe, expect, it } from "vitest";
import { makeTransaction } from "../test/fixtures";
import { getIncomeGroup } from "./income-groups";

describe("getIncomeGroup", () => {
  it("clasifica ingresos de diezmos por categoría", () => {
    expect(getIncomeGroup(makeTransaction({ type: "INGRESO", category: "Diezmos" }))).toBe(
      "DIEZMOS",
    );
  });

  it("clasifica ingresos de ofrendas por categoría, ignorando acentos y plural", () => {
    expect(getIncomeGroup(makeTransaction({ type: "INGRESO", category: "Ofrenda" }))).toBe(
      "OFRENDAS",
    );
    expect(getIncomeGroup(makeTransaction({ type: "INGRESO", category: "OFRENDAS" }))).toBe(
      "OFRENDAS",
    );
  });

  it("reconoce el grupo desde la subcategoría", () => {
    expect(
      getIncomeGroup(
        makeTransaction({ type: "INGRESO", category: "Aportes", subcategory: "Diezmo" }),
      ),
    ).toBe("DIEZMOS");
  });

  it("prioriza ofrendas sobre diezmos cuando ambas coinciden", () => {
    expect(
      getIncomeGroup(
        makeTransaction({ type: "INGRESO", category: "Diezmos", subcategory: "Ofrendas" }),
      ),
    ).toBe("OFRENDAS");
  });

  it("devuelve OTROS para otros ingresos", () => {
    expect(
      getIncomeGroup(makeTransaction({ type: "INGRESO", category: "Alquileres" })),
    ).toBe("OTROS");
  });

  it("devuelve null para egresos y transferencias", () => {
    expect(getIncomeGroup(makeTransaction({ type: "EGRESO", category: "Diezmos" }))).toBeNull();
    expect(
      getIncomeGroup(makeTransaction({ type: "TRANSFERENCIA", category: "Ofrendas" })),
    ).toBeNull();
  });
});
