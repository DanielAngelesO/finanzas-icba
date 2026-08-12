import type { Transaction } from "../../domain/transaction";
import type { TransactionValidationIssue } from "../../domain/diagnostics";

const reviewPeriods = [
  "202509",
  "202510",
  "202511",
  "202512",
  "202601",
  "202602",
  "202603",
  "202604",
  "202605",
  "202606",
  "202607",
  "202608",
] as const;

const monthDate = (period: string, day: number): Date =>
  new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, day, 12));

const createTransaction = (transaction: Transaction): Transaction => transaction;

const createPeriodTransactions = (period: string, index: number): Transaction[] => {
  const serviceReference = index === 4 || index === 8 ? "REV-SERVICIO-COMUN" : `REV-${period}-SERV`;
  const cashReference = index % 3 === 0 ? null : `REV-${period}-CAJA`;
  const cashMethod = index % 2 === 0 ? "Efectivo" : "Transferencia";
  const status = index % 4 === 0 ? "Pendiente" : "Confirmado";

  return [
    createTransaction({
      id: `REV-${period}-IN-01`,
      date: monthDate(period, 3),
      type: "INGRESO",
      account: "Cuenta corriente",
      category: "Ofrendas",
      subcategory: "Culto dominical",
      description: "Ofrenda dominical de revisión",
      responsible: "Equipo de tesorería",
      donorOrProvider: null,
      paymentMethod: "Transferencia",
      referenceOrReceipt: `REV-${period}-IN-01`,
      amount: 900 + index * 25,
      status: "Confirmado",
      period,
      notes: "Dato sintético",
    }),
    createTransaction({
      id: `REV-${period}-IN-02`,
      date: monthDate(period, 10),
      type: "INGRESO",
      account: "Cuenta corriente",
      category: "Diezmos",
      subcategory: "Diezmos",
      description: "Aporte mensual de revisión",
      responsible: "Equipo de tesorería",
      donorOrProvider: "Familias ICBA",
      paymentMethod: "Transferencia",
      referenceOrReceipt: `REV-${period}-IN-02`,
      amount: 1_350 + index * 45,
      status: "Confirmado",
      period,
      notes: null,
    }),
    createTransaction({
      id: `REV-${period}-IN-03`,
      date: monthDate(period, 18),
      type: "INGRESO",
      account: "Cuenta corriente",
      category: "Otros ingresos",
      subcategory: "Actividad comunitaria",
      description: "Actividad comunitaria de revisión",
      responsible: "Administración",
      donorOrProvider: "Actividad comunitaria",
      paymentMethod: "Yape",
      referenceOrReceipt: `REV-${period}-IN-03`,
      amount: 480 + index * 10,
      status: "Confirmado",
      period,
      notes: null,
    }),
    createTransaction({
      id: `REV-${period}-OUT-01`,
      date: monthDate(period, 5),
      type: "EGRESO",
      account: "Cuenta corriente",
      category: "Salarios y Honorarios",
      subcategory: "Honorarios",
      description: "Honorarios de apoyo ministerial",
      responsible: "Administración",
      donorOrProvider: "Servicios ministeriales",
      paymentMethod: "Transferencia",
      referenceOrReceipt: `REV-${period}-SAL`,
      amount: 700 + index * 30,
      status,
      period,
      notes: null,
    }),
    createTransaction({
      id: `REV-${period}-OUT-02`,
      date: monthDate(period, 12),
      type: "EGRESO",
      account: "Cuenta corriente",
      category: "Servicios",
      subcategory: "Luz y agua",
      description: "Servicios básicos de revisión",
      responsible: "Administración",
      donorOrProvider: "Servicios públicos",
      paymentMethod: "Transferencia",
      referenceOrReceipt: serviceReference,
      amount: 420 + index * 12,
      status: "Confirmado",
      period,
      notes: null,
    }),
    createTransaction({
      id: `REV-${period}-OUT-03`,
      date: monthDate(period, 20),
      type: "EGRESO",
      account: "Caja chica",
      category: "Materiales",
      subcategory: "Papelería",
      description: "Materiales de oficina de revisión",
      responsible: "Secretaría",
      donorOrProvider: "Librería Central",
      paymentMethod: "Tarjeta",
      referenceOrReceipt: `REV-${period}-MAT`,
      amount: 180 + index * 7,
      status: "Confirmado",
      period,
      notes: null,
    }),
    createTransaction({
      id: `REV-${period}-OUT-04`,
      date: monthDate(period, 25),
      type: "EGRESO",
      account: "Caja chica",
      category: "Operación",
      subcategory: "Caja chica",
      description: "Compra menor para operación",
      responsible: "Secretaría",
      donorOrProvider: "Comercio local",
      paymentMethod: cashMethod,
      referenceOrReceipt: cashReference,
      amount: 90 + index * 5,
      status: "Confirmado",
      period,
      notes: "Revisar comprobante en modo de prueba",
    }),
  ];
};

export const createReviewTransactions = (): Transaction[] =>
  reviewPeriods.flatMap((period, index) => createPeriodTransactions(period, index));

export const reviewDataQualityIssues: TransactionValidationIssue[] = [
  {
    code: "INVALID_REQUIRED_VALUE",
    severity: "warning",
    message: "Fila sintética con una nota pendiente de completar.",
    rowNumber: 85,
    field: "Notas",
  },
  {
    code: "INVALID_AMOUNT",
    severity: "error",
    message: "Fila sintética reservada para comprobar el estado de error.",
    rowNumber: 86,
    field: "Monto",
  },
];
