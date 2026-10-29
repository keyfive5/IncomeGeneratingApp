// Parser and evaluator for tape-measure arithmetic:
//
//   5' 7 3/8" + 2' 11 5/16"      12' × 14' × 4"      400 sqft ÷ 32
//
// "/" is the fraction bar and only joins two whole numbers; "÷" divides.
// Adjacent measures add, so 5' 7 3/8" is one quantity, and a bare number
// straight after feet means inches (5' 7 is 5' 7").

import { CUIN_PER, LENGTH_UNITS, SQIN_PER, type Dim, type Qty } from './units.ts';

export class CalcError extends Error {}

type Tok =
  | { t: 'num'; v: number; int: boolean }
  | { t: 'frac'; v: number }
  | { t: 'unit'; u: string; f: number; d: Dim }
  | { t: 'op'; v: '+' | '-' | '*' | '/' }
  | { t: '(' }
  | { t: ')' };

const UNIT_WORDS: [string, number, Dim][] = [
  // longest first so "sqft" is not read as "s" + "qft"
  ['sqft', SQIN_PER.sqft, 2],
  ['sqin', SQIN_PER.sqin, 2],
  ['sqyd', SQIN_PER.sqyd, 2],
  ['sqm', SQIN_PER.m2, 2],
  ['ft²', SQIN_PER.sqft, 2],
  ['in²', SQIN_PER.sqin, 2],
  ['yd²', SQIN_PER.sqyd, 2],
  ['m²', SQIN_PER.m2, 2],
  ['cuft', CUIN_PER.cuft, 3],
  ['cuin', CUIN_PER.cuin, 3],
  ['cuyd', CUIN_PER.cuyd, 3],
  ['ft³', CUIN_PER.cuft, 3],
  ['in³', CUIN_PER.cuin, 3],
  ['yd³', CUIN_PER.cuyd, 3],
  ['m³', CUIN_PER.m3, 3],
  ['ft', LENGTH_UNITS.ft, 1],
  ['in', LENGTH_UNITS.in, 1],
  ['yd', LENGTH_UNITS.yd, 1],
  ['mm', LENGTH_UNITS.mm, 1],
  ['cm', LENGTH_UNITS.cm, 1],
  ['m', LENGTH_UNITS.m, 1],
];

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/[′’‘`]/g, "'").replace(/[″“”]/g, '"').replace(/⁄/g, '/');
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const raw = s.slice(i, j).replace(/,/g, '');
      if ((raw.match(/\./g) || []).length > 1 || raw === '.') throw new CalcError(`"${raw}" is not a number`);
      // a fraction: digits "/" digits with no spaces around the bar
      if (s[j] === '/' && /[0-9]/.test(s[j + 1] ?? '') && !raw.includes('.')) {
        let k = j + 1;
        while (k < s.length && /[0-9]/.test(s[k])) k++;
        const den = Number(s.slice(j + 1, k));
        if (den === 0) throw new CalcError('A fraction cannot have 0 on the bottom');
        out.push({ t: 'frac', v: Number(raw) / den });
        i = k;
        continue;
      }
      out.push({ t: 'num', v: Number(raw), int: !raw.includes('.') });
      i = j;
      continue;
    }
    if (c === "'") {
      out.push({ t: 'unit', u: 'ft', f: 12, d: 1 });
      i++;
      continue;
    }
    if (c === '"') {
      out.push({ t: 'unit', u: 'in', f: 1, d: 1 });
      i++;
      continue;
    }
    if (c === '+') {
      out.push({ t: 'op', v: '+' });
      i++;
      continue;
    }
    if (c === '-' || c === '−' || c === '–') {
      out.push({ t: 'op', v: '-' });
      i++;
      continue;
    }
    if (c === '*' || c === '×' || c === '·') {
      out.push({ t: 'op', v: '*' });
      i++;
      continue;
    }
    if (c === '÷') {
      out.push({ t: 'op', v: '/' });
      i++;
      continue;
    }
    if (c === '/') throw new CalcError('Use ÷ to divide; / only writes a fraction like 3/8');
    if (c === '(' || c === ')') {
      out.push({ t: c });
      i++;
      continue;
    }
    const rest = s.slice(i).toLowerCase();
    const word = UNIT_WORDS.find(([w]) => rest.startsWith(w) && !/[a-z]/.test(rest[w.length] ?? ''));
    if (word) {
      out.push({ t: 'unit', u: word[0], f: word[1], d: word[2] });
      i += word[0].length;
      continue;
    }
    if ((c === 'x' || c === 'X') && !/[a-z]/i.test(s[i + 1] ?? '')) {
      out.push({ t: 'op', v: '*' });
      i++;
      continue;
    }
    throw new CalcError(`Unexpected "${c}"`);
  }
  return out;
}

export interface EvalOptions {
  /** What a bare number means when added to or subtracted from a length. */
  bareLengthUnit?: number; // inches per bare unit, default 1 (inches)
}

class Parser {
  i = 0;
  toks: Tok[];
  opts: EvalOptions;
  constructor(toks: Tok[], opts: EvalOptions) {
    this.toks = toks;
    this.opts = opts;
  }

  peek() {
    return this.toks[this.i];
  }

  parse(): Qty {
    if (!this.toks.length) throw new CalcError('Nothing to calculate');
    const q = this.expr();
    if (this.i < this.toks.length) {
      const t = this.peek();
      throw new CalcError(t.t === 'num' || t.t === 'frac' ? 'Missing an operator between numbers' : 'Unexpected ' + (t.t === ')' ? '")"' : 'input'));
    }
    return q;
  }

  expr(): Qty {
    let left = this.term();
    for (;;) {
      const t = this.peek();
      if (t?.t !== 'op' || (t.v !== '+' && t.v !== '-')) return left;
      this.i++;
      const right = this.term();
      left = this.addSub(left, right, t.v === '-' ? -1 : 1);
    }
  }

  addSub(a: Qty, b: Qty, sign: 1 | -1): Qty {
    if (a.d === b.d) return { v: a.v + sign * b.v, d: a.d };
    const bare = this.opts.bareLengthUnit ?? 1;
    if (a.d === 0 && b.d === 1) return { v: a.v * bare + sign * b.v, d: 1 };
    if (a.d === 1 && b.d === 0) return { v: a.v + sign * b.v * bare, d: 1 };
    throw new CalcError(`Can't ${sign > 0 ? 'add' : 'subtract'} ${DIM_NAME[b.d]} ${sign > 0 ? 'to' : 'from'} ${DIM_NAME[a.d]}`);
  }

  term(): Qty {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t?.t !== 'op' || (t.v !== '*' && t.v !== '/')) return left;
      this.i++;
      const right = this.unary();
      if (t.v === '*') {
        const d = left.d + right.d;
        if (d > 3) throw new CalcError('That would be more than a volume');
        left = { v: left.v * right.v, d: d as Dim };
      } else {
        const d = left.d - right.d;
        if (d < 0) throw new CalcError(`Can't divide ${DIM_NAME[left.d]} by ${DIM_NAME[right.d]}`);
        if (Math.abs(right.v) < 1e-12) throw new CalcError("Can't divide by zero");
        left = { v: left.v / right.v, d: d as Dim };
      }
    }
  }

  unary(): Qty {
    const t = this.peek();
    if (t?.t === 'op' && t.v === '-') {
      this.i++;
      const q = this.unary();
      return { v: -q.v, d: q.d };
    }
    if (t?.t === 'op' && t.v === '+') {
      this.i++;
      return this.unary();
    }
    return this.primary();
  }

  primary(): Qty {
    const t = this.peek();
    if (!t) throw new CalcError('Unfinished expression');
    if (t.t === '(') {
      this.i++;
      const q = this.expr();
      if (this.peek()?.t !== ')') throw new CalcError('Missing ")"');
      this.i++;
      return q;
    }
    if (t.t === 'num' || t.t === 'frac') return this.quantity();
    if (t.t === 'unit') throw new CalcError(`"${t.u}" needs a number in front of it`);
    throw new CalcError('Unfinished expression');
  }

  /** One or more adjacent measures: 5' 7 3/8" or 1m 20cm. */
  quantity(): Qty {
    const first = this.measure();
    if (!first.unit) return { v: first.value, d: 0 };
    let total = first.value * first.unit.f;
    let last = first.unit;
    const d = first.unit.d;
    while (d === 1) {
      const t = this.peek();
      if (t?.t !== 'num' && t?.t !== 'frac') break;
      const m = this.measure();
      if (!m.unit) {
        if (last.u === 'ft') {
          // 5' 7 means 5' 7"
          total += m.value;
          last = { u: 'in', f: 1, d: 1 };
          continue;
        }
        if (last.u === 'in' && m.fracOnly) {
          // 7" 3/8 — keyed the way a construction calculator takes it
          total += m.value;
          last = { u: 'frac', f: 0, d: 1 };
          continue;
        }
        throw new CalcError('Missing an operator between numbers');
      }
      if (m.unit.d !== 1 || m.unit.f >= last.f) throw new CalcError('Missing an operator between measurements');
      total += m.value * m.unit.f;
      last = m.unit;
    }
    return { v: total, d };
  }

  measure(): { value: number; fracOnly?: boolean; unit?: { u: string; f: number; d: Dim } } {
    const t = this.peek()!;
    let value: number;
    const fracOnly = t.t === 'frac';
    if (t.t === 'num') {
      this.i++;
      value = t.v;
      const n = this.peek();
      if (n?.t === 'frac') {
        if (!t.int) throw new CalcError('A decimal cannot be followed by a fraction');
        this.i++;
        value += n.v;
      }
    } else if (t.t === 'frac') {
      this.i++;
      value = t.v;
    } else throw new CalcError('Expected a number');
    const u = this.peek();
    if (u?.t === 'unit') {
      this.i++;
      return { value, fracOnly, unit: u };
    }
    return { value, fracOnly };
  }
}

/**
 * The expression as it should read on screen: keyed entry like 7" 3/8 is
 * shown the way it is written on a tape, 7 3/8".
 */
export function prettyExpr(src: string): string {
  return src.replace(/(\d+)" (\d+\/\d+)(?![\d"'/])/g, '$1 $2"').replace(/\*/g, '×').replace(/-/g, '−');
}

const DIM_NAME = ['a plain number', 'a length', 'an area', 'a volume'];

export function evaluate(src: string, opts: EvalOptions = {}): Qty {
  return new Parser(tokenize(src), opts).parse();
}

/** Like evaluate, but never throws: for live previews while typing. */
export function tryEvaluate(src: string, opts: EvalOptions = {}): Qty | null {
  try {
    const q = evaluate(src, opts);
    return isFinite(q.v) ? q : null;
  } catch {
    return null;
  }
}

/**
 * Reads a solver input as a length. A bare number is taken in `bareUnit`
 * inches-per-unit (12 for a field labelled in feet).
 */
export function parseLength(src: string, bareUnit = 1): number | null {
  const q = tryEvaluate(src, { bareLengthUnit: bareUnit });
  if (!q) return null;
  if (q.d === 1) return q.v;
  if (q.d === 0) return q.v * bareUnit;
  return null;
}

export function parseNumber(src: string): number | null {
  const q = tryEvaluate(src);
  return q && q.d === 0 ? q.v : null;
}
