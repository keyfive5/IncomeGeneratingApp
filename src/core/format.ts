import { CUIN_PER, MM_PER_IN, SQIN_PER, type Qty } from './units.ts';

export type Precision = 2 | 4 | 8 | 16 | 32 | 64;

/**
 * A length read off a tape: feet, whole inches and a reduced fraction, plus
 * which way it was rounded. Carpenters call a hair over a mark "strong" and a
 * hair under it "scant".
 */
export interface TapeParts {
  neg: boolean;
  ft: number;
  inch: number;
  num: number;
  den: number;
  dir: 'exact' | 'strong' | 'scant';
}

const EPS = 1e-9;

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function tapeParts(totalInches: number, precision: Precision = 16, feet = true): TapeParts {
  const neg = totalInches < -EPS;
  const abs = Math.abs(totalInches);
  const ticks = Math.round(abs * precision);
  const rounded = ticks / precision;
  const diff = abs - rounded;
  const dir = Math.abs(diff) < 1e-7 ? 'exact' : diff > 0 ? 'strong' : 'scant';
  const wholeInches = Math.floor(ticks / precision);
  let n = ticks - wholeInches * precision;
  let d: number = precision;
  if (n) {
    const g = gcd(n, d);
    n /= g;
    d /= g;
  }
  const ft = feet ? Math.floor(wholeInches / 12) : 0;
  const inch = feet ? wholeInches - ft * 12 : wholeInches;
  return { neg: neg && ticks > 0, ft, inch, num: n, den: n ? d : 1, dir };
}

export function fracString(p: Pick<TapeParts, 'num' | 'den'>): string {
  return p.num ? `${p.num}/${p.den}` : '';
}

/** 12' 7 3/8" — the format printed on every tape measure. */
export function formatFtIn(totalInches: number, precision: Precision = 16): string {
  const p = tapeParts(totalInches, precision, true);
  const inchPart = [p.inch || (!p.num ? '0' : ''), fracString(p)].filter(Boolean).join(' ');
  const body = p.ft ? `${p.ft}' ${inchPart}"` : `${inchPart}"`;
  return (p.neg ? '−' : '') + body;
}

/** 151 3/8" — inches and fractions with no feet, for cut lists and layout. */
export function formatIn(totalInches: number, precision: Precision = 16): string {
  const p = tapeParts(totalInches, precision, false);
  const body = [p.inch || (!p.num ? '0' : ''), fracString(p)].filter(Boolean).join(' ');
  return (p.neg ? '−' : '') + body + '"';
}

export function fmtNum(x: number, maxDp = 3, minDp = 0): string {
  if (!isFinite(x)) return '—';
  const r = Number(x.toFixed(maxDp));
  return r.toLocaleString('en-US', { minimumFractionDigits: minDp, maximumFractionDigits: maxDp });
}

export interface Reading {
  label: string;
  value: string;
}

/** Every useful reading of a quantity, primary first. */
export function readings(q: Qty, precision: Precision = 16): Reading[] {
  switch (q.d) {
    case 0:
      return [{ label: '', value: fmtNum(q.v, 6) }];
    case 1:
      return [
        { label: 'ft-in', value: formatFtIn(q.v, precision) },
        { label: 'inches', value: formatIn(q.v, precision) },
        { label: 'decimal in', value: fmtNum(q.v, 4) + '"' },
        { label: 'decimal ft', value: fmtNum(q.v / 12, 4) + "'" },
        { label: 'yards', value: fmtNum(q.v / 36, 4) + ' yd' },
        { label: 'mm', value: fmtNum(q.v * MM_PER_IN, 1) + ' mm' },
        { label: 'meters', value: fmtNum((q.v * MM_PER_IN) / 1000, 4) + ' m' },
      ];
    case 2:
      return [
        { label: 'sq ft', value: fmtNum(q.v / SQIN_PER.sqft, 2) + ' ft²' },
        { label: 'sq in', value: fmtNum(q.v, 2) + ' in²' },
        { label: 'sq yd', value: fmtNum(q.v / SQIN_PER.sqyd, 3) + ' yd²' },
        { label: 'sq m', value: fmtNum(q.v / SQIN_PER.m2, 3) + ' m²' },
        { label: 'roof squares', value: fmtNum(q.v / SQIN_PER.square, 2) },
      ];
    case 3:
      return [
        { label: 'cu yd', value: fmtNum(q.v / CUIN_PER.cuyd, 3) + ' yd³' },
        { label: 'cu ft', value: fmtNum(q.v / CUIN_PER.cuft, 2) + ' ft³' },
        { label: 'cu in', value: fmtNum(q.v, 1) + ' in³' },
        { label: 'cu m', value: fmtNum(q.v / CUIN_PER.m3, 3) + ' m³' },
        { label: 'US gal', value: fmtNum(q.v / CUIN_PER.gal, 2) + ' gal' },
      ];
  }
}

export function primary(q: Qty, precision: Precision = 16): string {
  return readings(q, precision)[0].value;
}
