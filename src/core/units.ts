// Quantities are stored in inches raised to their dimension: a length is
// inches, an area square inches, a volume cubic inches. A plain number has
// dimension 0. Everything converts through these base units.

export type Dim = 0 | 1 | 2 | 3;

export interface Qty {
  v: number;
  d: Dim;
}

export const MM_PER_IN = 25.4;

/** Inches per unit, for every length unit the parser accepts. */
export const LENGTH_UNITS: Record<string, number> = {
  in: 1,
  '"': 1,
  ft: 12,
  "'": 12,
  yd: 36,
  mm: 1 / MM_PER_IN,
  cm: 10 / MM_PER_IN,
  m: 1000 / MM_PER_IN,
};

export const SQIN_PER = {
  sqin: 1,
  sqft: 144,
  sqyd: 1296,
  m2: (1000 / MM_PER_IN) ** 2,
  square: 14400, // roofing square, 100 sq ft
};

export const CUIN_PER = {
  cuin: 1,
  cuft: 1728,
  cuyd: 46656,
  m3: (1000 / MM_PER_IN) ** 3,
  gal: 231, // US liquid gallon
  l: 61.0237440947323,
};

export const qty = (v: number, d: Dim = 0): Qty => ({ v, d });
export const inches = (v: number): Qty => ({ v, d: 1 });
export const feet = (v: number): Qty => ({ v: v * 12, d: 1 });

export const toFeet = (q: Qty) => q.v / 12;
export const toSqFt = (q: Qty) => q.v / SQIN_PER.sqft;
export const toCuFt = (q: Qty) => q.v / CUIN_PER.cuft;
export const toCuYd = (q: Qty) => q.v / CUIN_PER.cuyd;

export const DEG = Math.PI / 180;
