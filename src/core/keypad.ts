// What each calculator key does to the expression string. Kept apart from
// the UI so the entry rules can be tested: 5 ft 7 in 3 ⁄ 8 builds 5' 7" 3/8,
// which the parser reads as 5' 7 3/8".

export type Key =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.'
  | 'ft' | 'in' | 'yd' | 'm' | 'cm' | 'mm'
  | 'frac' | '+' | '-' | '×' | '÷' | '(' | ')'
  | 'back' | 'clear';

const OPS = ['+', '-', '×', '÷'];
const UNIT_TEXT: Record<string, string> = { ft: "'", in: '"', yd: 'yd', m: 'm', cm: 'cm', mm: 'mm' };
const UNIT_RE = /('|"|yd|mm|cm|m)$/;

/** True when the expression ends in a minus that is a sign, not a subtraction. */
function isSign(e: string) {
  if (!e.endsWith('-')) return false;
  const before = e.slice(0, -1).replace(/\s+$/, '');
  return !before || before.endsWith('(') || OPS.includes(before.slice(-1));
}

/** The number currently being typed at the end, e.g. "12", "3/8", "1.5". */
function currentNumber(e: string) {
  return /[0-9./]*$/.exec(e)![0];
}

export function applyKey(expr: string, key: Key): string {
  const e = expr.replace(/\s+$/, '');
  const tail = e.slice(-1);
  const endsWithOp = OPS.includes(tail);
  const endsWithUnit = UNIT_RE.test(e);

  if (key === 'clear') return '';

  if (key === 'back') {
    if (!e) return '';
    const unit = /(yd|mm|cm|m)$/.exec(e);
    const cut = unit ? e.slice(0, -unit[0].length) : e.slice(0, -1);
    return cut.replace(/\s+$/, '');
  }

  if (/^[0-9]$/.test(key)) {
    if (endsWithUnit) return `${e} ${key}`;
    if (tail === ')') return `${e} × ${key}`;
    if (endsWithOp) return isSign(e) ? e + key : `${e} ${key}`;
    return e + key;
  }

  if (key === '.') {
    const n = currentNumber(e);
    if (n.includes('.') || n.includes('/')) return e;
    if (endsWithUnit) return `${e} 0.`;
    if (tail === ')') return `${e} × 0.`;
    if (endsWithOp) return isSign(e) ? e + '0.' : `${e} 0.`;
    return e + (n ? '.' : '0.');
  }

  if (key === 'frac') {
    const n = currentNumber(e);
    if (!/^[0-9]+$/.test(n)) return e;
    return e + '/';
  }

  if (key in UNIT_TEXT) {
    // a unit needs a finished number in front of it; pressing a different
    // unit straight away swaps the one just entered
    if (endsWithUnit) return e.replace(UNIT_RE, UNIT_TEXT[key]);
    if (!/[0-9]$/.test(e)) return e;
    return e + UNIT_TEXT[key];
  }

  if (OPS.includes(key)) {
    if (!e || tail === '(') return key === '-' ? e + '-' : e;
    if (endsWithOp) {
      // minus after × or ÷ is a negative sign; otherwise the new operator
      // replaces whatever operators are at the end
      if (key === '-' && (tail === '×' || tail === '÷')) return `${e} -`;
      const stripped = e.replace(/[\s+\-×÷]+$/, '');
      if (!stripped || stripped.endsWith('(')) return key === '-' ? stripped + '-' : stripped;
      return `${stripped} ${key}`;
    }
    if (/[./]$/.test(e)) return e;
    return `${e} ${key}`;
  }

  if (key === '(') {
    if (!e || endsWithOp || tail === '(') return endsWithOp ? `${e} (` : e + '(';
    return `${e} × (`;
  }

  if (key === ')') {
    const open = (e.match(/\(/g) || []).length - (e.match(/\)/g) || []).length;
    if (open <= 0 || endsWithOp || tail === '(' || /[./]$/.test(e)) return e;
    return e + ')';
  }

  return e;
}
