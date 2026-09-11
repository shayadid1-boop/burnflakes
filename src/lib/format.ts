const nis = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
const nis2 = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n: number | string | null | undefined) => nis.format(Number(n ?? 0));
export const money2 = (n: number | string | null | undefined) => nis2.format(Number(n ?? 0));
export const num = (n: number | string | null | undefined) => new Intl.NumberFormat("he-IL").format(Number(n ?? 0));
