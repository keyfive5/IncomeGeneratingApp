// Parser, formatting and every solver against hand-checked jobsite numbers.
import { describe, eq, ok, report } from './harness.mjs';
import { evaluate, tryEvaluate, parseLength, CalcError } from '../src/core/expr.ts';
import { formatFtIn, formatIn, tapeParts, readings } from '../src/core/format.ts';
import { SOLVERS, solverById, runSolver } from '../src/core/solvers.ts';

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const throws = (src) => {
  try {
    evaluate(src);
    return false;
  } catch (e) {
    return e instanceof CalcError;
  }
};
const out = (id, values, p = 16) => {
  const s = solverById(id);
  const r = runSolver(s, { ...s.example, ...values }, p);
  if (typeof r === 'string') throw new Error(`${id}: ${r}`);
  return Object.fromEntries(r.outputs.map((o) => [o.label, o.value]));
};

describe('parsing tape measurements', () => {
  eq(evaluate(`5' 7 3/8"`), { v: 67.375, d: 1 }, `5' 7 3/8"`);
  eq(evaluate(`5'7"`), { v: 67, d: 1 }, `5'7"`);
  eq(evaluate(`5' 7`), { v: 67, d: 1 }, 'bare number after feet is inches');
  eq(evaluate(`3/8"`), { v: 0.375, d: 1 }, 'fraction alone');
  eq(evaluate(`7 3/8`), { v: 7.375, d: 0 }, 'mixed number without unit');
  eq(evaluate(`5.5'`), { v: 66, d: 1 }, 'decimal feet');
  ok(near(evaluate('1m 20cm').v, 1200 / 25.4), 'metric run-on');
  ok(near(evaluate('1200mm').v, 47.244094488), 'mm');
  eq(evaluate('2 yd').v, 72, 'yards');
  eq(evaluate(`5′ 7″`), { v: 67, d: 1 }, 'prime marks');
  eq(evaluate('12 ft 6 in'), { v: 150, d: 1 }, 'unit words');
});

describe('arithmetic', () => {
  const sum = evaluate(`5' 7 3/8" + 2' 11 5/16"`);
  eq(sum, { v: 102.6875, d: 1 }, 'add feet-inch-fractions');
  eq(formatFtIn(sum.v), `8' 6 11/16"`, 'formatted sum');
  eq(evaluate(`10' - 3 1/2"`).v, 116.5, 'subtract');
  eq(evaluate(`5' + 6`).v, 66, 'bare number added to a length is inches');
  eq(evaluate(`7 3/8" × 2`).v, 14.75, 'scale a length');
  eq(evaluate(`10' ÷ 3`).v, 40, 'divide a length');
  eq(evaluate(`16' ÷ 16"`), { v: 12, d: 0 }, 'length ÷ length is a count');
  const area = evaluate(`12' × 14'`);
  eq(area.d, 2, 'area dimension');
  ok(near(area.v / 144, 168), '168 sq ft');
  const vol = evaluate(`12' × 14' × 4"`);
  eq(vol.d, 3, 'volume dimension');
  ok(near(vol.v / 1728, 56), '56 cu ft');
  ok(near(evaluate('400 sqft ÷ 32').v / 144, 12.5), 'area ÷ number');
  ok(near(evaluate(`400 sqft ÷ 16'`).v, 25 * 12), 'area ÷ length is a length');
  eq(evaluate('2x4').v, 8, 'x as times');
  eq(evaluate('(2 + 3) × 4').v, 20, 'parentheses');
  eq(evaluate(`-(3")`).v, -3, 'unary minus');
  eq(evaluate('1,200 + 1').v, 1201, 'thousands separator');
});

describe('errors', () => {
  ok(throws(`5' 3 4`), 'two bare numbers');
  ok(throws(`3' + 4 sqft`), 'length + area');
  ok(throws(`12' × 3' × 2' × 1'`), 'four dimensions');
  ok(throws('5 ÷ 0'), 'divide by zero');
  ok(throws('3/0'), 'zero denominator');
  ok(throws(`5 ÷ 2'`), 'number ÷ length');
  ok(throws(`5' +`), 'trailing operator');
  ok(throws('3 / 8'), 'spaced slash is not division');
  ok(throws(`2" 3'`), 'smaller unit before larger');
  ok(throws('1.5 1/2'), 'decimal followed by fraction');
  eq(tryEvaluate(`5' +`), null, 'tryEvaluate swallows errors');
  eq(tryEvaluate(''), null, 'empty input');
});

describe('tape formatting', () => {
  eq(formatFtIn(0), '0"', 'zero');
  eq(formatFtIn(12), `1' 0"`, 'one foot');
  eq(formatFtIn(-6.5), '−6 1/2"', 'negative');
  eq(formatFtIn(11.99), `1' 0"`, 'carries into feet when rounding');
  eq(formatFtIn(0.03125), '1/16"', 'half a sixteenth rounds up');
  eq(formatFtIn(151.375), `12' 7 3/8"`, '12-7-3/8');
  eq(formatIn(151.375), '151 3/8"', 'inches only');
  eq(formatFtIn(7.3, 8), '7 1/4"', 'eighths');
  eq(formatFtIn(7.3, 32), '7 5/16"', '32nds reduce');
  eq(tapeParts(1 / 3).dir, 'strong', 'a hair over 5/16 is strong');
  eq(tapeParts(0.3).dir, 'scant', 'a hair under 5/16 is scant');
  eq(tapeParts(0.3125).dir, 'exact', 'exact');
  eq(readings(evaluate(`12' × 14' × 4"`))[0].value, '2.074 yd³', 'volume reads in yards first');
  eq(parseLength('8', 12), 96, 'bare number in a feet field');
  eq(parseLength(`8' - 1 1/2"`, 12), 94.5, 'arithmetic in a field');
  eq(parseLength('4 sqft'), null, 'area rejected as a length');
});

describe('stairs', () => {
  const o = out('stairs', {});
  eq(o['Risers'], '15', 'risers for 9\' 1 1/4"');
  eq(o['Riser height'], '7 5/16"', 'riser height');
  eq(o['Treads'], '14', 'treads');
  eq(o['Total run'], `11' 11 1/2"`, 'total run');
  eq(o['Bottom riser cut'], '6 5/16"', 'bottom riser drops by tread thickness');
  const steep = runSolver(solverById('stairs'), { rise: '100"', maxRiser: '8 1/2"', tread: '9"' }, 16);
  ok(steep.warnings.some((w) => w.includes('7 3/4')), 'flags riser over code');
  ok(steep.warnings.some((w) => w.includes('10"')), 'flags tread under code');
});

describe('rafters', () => {
  const o = out('rafter', {});
  eq(o['Rafter length (line)'], `13' 4 3/16"`, '24 ft span 6/12 with 1 1/2" ridge');
  eq(o['Rise'], `5' 11 5/8"`, 'rise');
  eq(o['Plumb cut angle'], '26.57°', 'plumb cut');
  eq(o['Seat cut angle'], '63.43°', 'seat cut');
  const flat = out('rafter', { ridge: '', overhang: '' });
  eq(flat['Rafter length (line)'], `13' 5"`, 'no ridge: 12 ft run × 1.118');
});

describe('stud layout', () => {
  const s = solverById('studs');
  const r = runSolver(s, s.example, 16);
  eq(r.marks.items[0], `15 1/4"   (1' 3 1/4")`, 'first mark');
  eq(r.marks.items[1], `31 1/4"   (2' 7 1/4")`, 'second mark');
  eq(r.marks.items.length, 10, 'marks in a 14\' 7" wall');
  eq(out('studs', {})['Studs'], '12', 'studs incl. ends');
  eq(
    runSolver(s, { wall: "8'", oc: '24' }, 16).marks.items,
    [`23 1/4"   (1' 11 1/4")`, `47 1/4"   (3' 11 1/4")`, `71 1/4"   (5' 11 1/4")`],
    '24 OC',
  );
});

describe('balusters', () => {
  const o = out('spacing', {});
  eq(o['Balusters'], '13', 'count');
  eq(o['Actual gap'], '3 23/32"', 'gap');
  const s = solverById('spacing');
  const r = runSolver(s, s.example, 16);
  eq(r.marks.items[0], '3 11/16"', 'first edge');
  ok(!r.warnings.length, 'passes 4" sphere');
});

describe('concrete', () => {
  const o = out('concrete', {});
  eq(o['Concrete'], '1.71 yd³', '12 × 10 1/2 × 4" slab + 10%');
  eq(o['80 lb bags'], '77', '80 lb bags');
  const col = out('concrete', { shape: 'round', dia: '12"', depth: "4'", count: '6', waste: '0' });
  eq(col['Cubic feet'], '18.85 ft³', 'six 12" tubes, 4 ft deep');
});

describe('geometry', () => {
  eq(out('triangle', {})['Diagonal'], `15' 0"`, '9-12-15');
  const sq = out('triangle', { diag: `15' 1/8"` });
  eq(sq['Diagonal long by'], '1/8"', 'out of square');
  eq(out('triangle', { diag: `15'`, rise: '' })['Rise'], `9' 0"`, 'solve rise');
  eq(out('arc', {})['Radius'], `2' 6"`, '36" wide 6" high arch');
  const crown = out('miter', {});
  eq(crown['Miter'], '31.62°', 'crown 38° miter');
  eq(crown['Bevel'], '33.86°', 'crown 38° bevel');
  const c45 = out('miter', { spring: '45' });
  eq([c45['Miter'], c45['Bevel']], ['35.26°', '30°'], 'crown 45°');
  eq(out('miter', { mode: 'flat' })['Miter'], '45°', 'flat 90');
  eq(out('miter', { mode: 'flat', sides: '8' })['Miter'], '22.5°', 'octagon');
});

describe('estimating', () => {
  const bf = out('boardfeet', {});
  eq([bf['Board feet'], bf['Cost']], ['360', '$486.00'], '18 2x10x12');
  eq(out('slope', {})['Per foot'], '1/4" per ft', 'quarter inch per foot');
  eq(out('slope', {})['Grade'], '2.08%', 'grade');
  eq(out('paint', {})['Buy'], '2 gal + 1 qt', 'paint');
  const d = out('decking', {});
  eq([d['Deck boards'], d['Joists'], d['Screws']], ['26', '13', '676'], 'decking');
  const t = out('tile', {});
  eq([t['Tiles'], t['Boxes']], ['68', '9'], 'tile');
  eq(out('drywall', {})['Sheets'], '11', 'drywall 4x12: 474 sq ft + 10% over 48');
  eq(out('fill', {})['Cubic yards'], '3.7 yd³', 'gravel');
});

describe('every solver handles its example and empty input', () => {
  for (const s of SOLVERS) {
    const r = runSolver(s, s.example, 16);
    ok(typeof r !== 'string' && r.outputs.length > 0, `${s.id} example`);
    if (s.id !== 'miter') ok(typeof runSolver(s, {}, 16) === 'string', `${s.id} empty gives a prompt`);
    for (const f of s.fields)
      ok(f.kind !== 'choice' || f.options?.some((o) => o.value === s.example[f.key]), `${s.id}.${f.key} example is an option`);
  }
});

report('core');
