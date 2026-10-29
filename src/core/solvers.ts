// Jobsite solvers. Each is declarative — fields, an example, a compute
// function — so the UI renders every one with the same form. Compute is pure
// and takes the raw text of each field, which may itself be arithmetic
// ("12' - 3 1/2"").

import { parseLength, parseNumber } from './expr.ts';
import { fmtNum, formatFtIn, formatIn, type Precision } from './format.ts';
import { CUIN_PER, DEG, SQIN_PER } from './units.ts';

export type FieldKind = 'length' | 'number' | 'choice';

export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  /** For lengths: what a bare number means. */
  unit?: 'in' | 'ft';
  /** For numbers: suffix shown after the value. */
  suffix?: string;
  options?: { label: string; value: string }[];
  optional?: boolean;
  help?: string;
}

export interface Output {
  label: string;
  value: string;
  big?: boolean;
  note?: string;
}

export type Diagram =
  | { kind: 'stairs'; risers: number; riser: number; tread: number; riserLabel: string; treadLabel: string; totalRise: string; totalRun: string }
  | { kind: 'rafter'; run: number; rise: number; overhang: number; pitch: number; lengthLabel: string; riseLabel: string; runLabel: string }
  | { kind: 'triangle'; rise: number; run: number; riseLabel: string; runLabel: string; diagLabel: string; angle: string }
  | { kind: 'layout'; length: number; members: number[]; width: number; label: string }
  | { kind: 'arc'; chord: number; rise: number; radiusLabel: string; chordLabel: string; riseLabel: string }
  | { kind: 'miter'; miter: number; bevel?: number };

export interface Result {
  outputs: Output[];
  warnings?: string[];
  marks?: { title: string; items: string[] };
  diagram?: Diagram;
}

export type Values = Record<string, string>;

export interface Solver {
  id: string;
  title: string;
  blurb: string;
  group: 'Framing' | 'Concrete & Site' | 'Finish' | 'Geometry';
  pro: boolean;
  fields: Field[];
  example: Values;
  compute(v: Values, precision: Precision): Result | string;
}

const L = (v: Values, k: string, unit: 'in' | 'ft' = 'in') => {
  const s = (v[k] ?? '').trim();
  return s ? parseLength(s, unit === 'ft' ? 12 : 1) : null;
};
const N = (v: Values, k: string) => {
  const s = (v[k] ?? '').trim();
  return s ? parseNumber(s) : null;
};

const ftIn = formatFtIn;
const ceil = (x: number) => Math.ceil(x - 1e-9);
const deg = (rad: number) => fmtNum(rad / DEG, 2) + '°';
const sqft = (sqin: number) => fmtNum(sqin / SQIN_PER.sqft, 1) + ' sq ft';

// --- Framing ---------------------------------------------------------------

const stairs: Solver = {
  id: 'stairs',
  title: 'Stairs',
  blurb: 'Risers, treads, stringer length and code check',
  group: 'Framing',
  pro: true,
  fields: [
    { key: 'rise', label: 'Total rise (floor to floor)', kind: 'length', unit: 'in' },
    { key: 'maxRiser', label: 'Max riser height', kind: 'length', unit: 'in', help: 'IRC limit is 7 3/4"' },
    { key: 'tread', label: 'Tread depth (run)', kind: 'length', unit: 'in', help: 'IRC minimum is 10"' },
    { key: 'treadThk', label: 'Tread thickness', kind: 'length', unit: 'in', optional: true, help: 'Dropped off the bottom of the stringer' },
  ],
  example: { rise: '9\' 1 1/4"', maxRiser: '7 3/4"', tread: '10 1/4"', treadThk: '1"' },
  compute(v, p) {
    const rise = L(v, 'rise');
    const maxR = L(v, 'maxRiser') ?? 7.75;
    const tread = L(v, 'tread') ?? 10;
    const thk = L(v, 'treadThk') ?? 0;
    if (!rise || rise <= 0) return 'Enter the total rise';
    if (maxR <= 0 || tread <= 0) return 'Riser and tread must be more than 0';
    const risers = ceil(rise / maxR);
    const r = rise / risers;
    const treads = risers - 1;
    const run = treads * tread;
    const angle = Math.atan(r / tread);
    const stringer = Math.hypot(rise, run + tread);
    const warnings: string[] = [];
    if (r > 7.75 + 1e-9) warnings.push(`Riser ${formatIn(r, p)} is over the 7 3/4" IRC maximum`);
    if (tread < 10 - 1e-9) warnings.push(`Tread ${formatIn(tread, p)} is under the 10" IRC minimum`);
    const blondel = 2 * r + tread;
    if (blondel < 24 || blondel > 25.5)
      warnings.push(`2 × riser + tread = ${fmtNum(blondel, 2)}" — stairs feel best between 24" and 25"`);
    return {
      outputs: [
        { label: 'Risers', value: `${risers}`, big: true },
        { label: 'Riser height', value: formatIn(r, p), big: true },
        { label: 'Treads', value: `${treads}` },
        { label: 'Total run', value: ftIn(run, p) },
        { label: 'Stair angle', value: deg(angle) },
        { label: 'Stringer length (min)', value: ftIn(stringer, p), note: 'Hypotenuse plus one tread; buy the next board size up' },
        { label: 'Framing square', value: `${formatIn(r, p)} on the tongue, ${formatIn(tread, p)} on the blade` },
        ...(thk > 0 ? [{ label: 'Bottom riser cut', value: formatIn(r - thk, p), note: 'Drop the stringer by the tread thickness' }] : []),
      ],
      warnings,
      diagram: {
        kind: 'stairs',
        risers,
        riser: r,
        tread,
        riserLabel: formatIn(r, p),
        treadLabel: formatIn(tread, p),
        totalRise: ftIn(rise, p),
        totalRun: ftIn(run, p),
      },
    };
  },
};

const rafter: Solver = {
  id: 'rafter',
  title: 'Rafters & Roof Pitch',
  blurb: 'Common and hip rafter length, plumb and seat cuts',
  group: 'Framing',
  pro: true,
  fields: [
    { key: 'span', label: 'Building span (outside walls)', kind: 'length', unit: 'ft' },
    { key: 'pitch', label: 'Pitch (rise per 12" run)', kind: 'number', suffix: '/12' },
    { key: 'overhang', label: 'Overhang (level)', kind: 'length', unit: 'in', optional: true },
    { key: 'ridge', label: 'Ridge board thickness', kind: 'length', unit: 'in', optional: true },
    { key: 'length', label: 'Building length (for roof area)', kind: 'length', unit: 'ft', optional: true },
  ],
  example: { span: "24'", pitch: '6', overhang: '12"', ridge: '1 1/2"', length: "40'" },
  compute(v, p) {
    const span = L(v, 'span', 'ft');
    const pitch = N(v, 'pitch');
    const over = L(v, 'overhang') ?? 0;
    const ridge = L(v, 'ridge') ?? 0;
    const blen = L(v, 'length', 'ft');
    if (!span || span <= 0) return 'Enter the building span';
    if (pitch == null || pitch <= 0) return 'Enter the pitch, e.g. 6 for 6/12';
    const run = span / 2 - ridge / 2;
    if (run <= 0) return 'The ridge is wider than the span';
    const slope = Math.hypot(1, pitch / 12);
    const rise = run * (pitch / 12);
    const rafterLen = run * slope;
    const tail = over * slope;
    const angle = Math.atan(pitch / 12);
    const hipRun = run * Math.SQRT2;
    const hipLen = Math.hypot(hipRun, rise);
    const outputs: Output[] = [
      { label: 'Rafter length (line)', value: ftIn(rafterLen, p), big: true, note: 'Ridge to outside of wall, along the top edge' },
      { label: 'With overhang', value: ftIn(rafterLen + tail, p), big: true },
      { label: 'Rise', value: ftIn(rise, p) },
      { label: 'Plumb cut angle', value: deg(angle) },
      { label: 'Seat cut angle', value: deg(Math.PI / 2 - angle) },
      { label: 'Roof angle', value: deg(angle) },
      { label: 'Hip / valley length', value: ftIn(hipLen, p), note: `Hip pitch ${fmtNum(pitch, 2)}/16.97` },
    ];
    if (blen && blen > 0) {
      const area = 2 * (rafterLen + tail) * (blen + 2 * over);
      outputs.push({ label: 'Roof area (gable, both sides)', value: sqft(area) });
      outputs.push({ label: 'Roofing squares', value: fmtNum(area / SQIN_PER.square, 2) });
    }
    return {
      outputs,
      diagram: {
        kind: 'rafter',
        run,
        rise,
        overhang: over,
        pitch,
        lengthLabel: ftIn(rafterLen, p),
        riseLabel: ftIn(rise, p),
        runLabel: ftIn(run, p),
      },
    };
  },
};

const studs: Solver = {
  id: 'studs',
  title: 'Stud Layout',
  blurb: 'Every on-center mark to pull from the end of the plate',
  group: 'Framing',
  pro: true,
  fields: [
    { key: 'wall', label: 'Wall length', kind: 'length', unit: 'ft' },
    {
      key: 'oc',
      label: 'Spacing',
      kind: 'choice',
      options: [
        { label: '16" OC', value: '16' },
        { label: '24" OC', value: '24' },
        { label: '19.2" OC', value: '19.2' },
        { label: '12" OC', value: '12' },
      ],
    },
    { key: 'width', label: 'Stud thickness', kind: 'length', unit: 'in', optional: true },
  ],
  example: { wall: "14' 7\"", oc: '16', width: '1 1/2"' },
  compute(v, p) {
    const wall = L(v, 'wall', 'ft');
    const oc = Number(v.oc || 16);
    const w = L(v, 'width') ?? 1.5;
    if (!wall || wall <= 0) return 'Enter the wall length';
    if (wall < 2 * w) return 'The wall is shorter than two studs';
    // Marks are the leading edge of each stud, set back half a stud so the
    // stud centers land on the sheet joints: 15 1/4", 31 1/4", 47 1/4"...
    const marks: number[] = [];
    for (let n = 1; ; n++) {
      const edge = n * oc - w / 2;
      if (edge + w > wall - w + 1e-9) break;
      marks.push(edge);
    }
    const members = [0, ...marks, wall - w];
    return {
      outputs: [
        { label: 'Studs', value: `${members.length}`, big: true, note: 'Includes both end studs; add for corners, openings and blocking' },
        { label: 'First mark', value: marks.length ? formatIn(marks[0], p) : '—', big: true },
        { label: 'Plate stock (bottom + double top)', value: ftIn(wall * 3, p) },
      ],
      marks: {
        title: 'Marks from the end (leading edge)',
        items: marks.map((m) => `${formatIn(m, p)}   ${m >= 12 ? '(' + ftIn(m, p) + ')' : ''}`.trim()),
      },
      diagram: { kind: 'layout', length: wall, members, width: w, label: `${members.length} studs @ ${fmtNum(oc, 1)}" OC` },
    };
  },
};

const spacing: Solver = {
  id: 'spacing',
  title: 'Balusters & Equal Spacing',
  blurb: 'Count, gap and marks for pickets, balusters, anything',
  group: 'Finish',
  pro: true,
  fields: [
    { key: 'span', label: 'Space between posts', kind: 'length', unit: 'in' },
    { key: 'width', label: 'Baluster width', kind: 'length', unit: 'in' },
    { key: 'gap', label: 'Max gap', kind: 'length', unit: 'in', help: 'Code: a 4" sphere must not pass' },
  ],
  example: { span: '71 1/2"', width: '1 1/2"', gap: '3 3/4"' },
  compute(v, p) {
    const span = L(v, 'span');
    const w = L(v, 'width') ?? 1.5;
    const maxGap = L(v, 'gap') ?? 4;
    if (!span || span <= 0) return 'Enter the space between posts';
    if (maxGap <= 0) return 'The gap must be more than 0';
    if (w < 0) return 'Width cannot be negative';
    const n = Math.max(0, ceil((span - maxGap) / (w + maxGap)));
    const gap = (span - n * w) / (n + 1);
    if (gap < 0) return 'The balusters do not fit in that space';
    const marks = Array.from({ length: n }, (_, i) => gap + i * (gap + w));
    const warnings = gap >= 4 ? ['The gap is 4" or more — that fails the 4" sphere rule for guards'] : [];
    return {
      outputs: [
        { label: 'Balusters', value: `${n}`, big: true },
        { label: 'Actual gap', value: formatIn(gap, 32), big: true },
        { label: 'On center', value: formatIn(gap + w, p) },
        { label: 'Gaps', value: `${n + 1}` },
      ],
      warnings,
      marks: { title: 'Left edge of each baluster, from the post', items: marks.map((m) => formatIn(m, p)) },
      diagram: { kind: 'layout', length: span, members: marks, width: w, label: `${n} @ ${formatIn(gap, 32)} gaps` },
    };
  },
};

const boardFeet: Solver = {
  id: 'boardfeet',
  title: 'Board Feet & Lumber',
  blurb: 'Board feet, linear feet and cost for any stock',
  group: 'Framing',
  pro: true,
  fields: [
    { key: 't', label: 'Thickness (nominal)', kind: 'length', unit: 'in' },
    { key: 'w', label: 'Width (nominal)', kind: 'length', unit: 'in' },
    { key: 'len', label: 'Length', kind: 'length', unit: 'ft' },
    { key: 'qty', label: 'Pieces', kind: 'number' },
    { key: 'price', label: 'Price per board foot', kind: 'number', suffix: '$', optional: true },
  ],
  example: { t: '2', w: '10', len: "12'", qty: '18', price: '1.35' },
  compute(v) {
    const t = L(v, 't');
    const w = L(v, 'w');
    const len = L(v, 'len', 'ft');
    const qty = N(v, 'qty') ?? 1;
    const price = N(v, 'price');
    if (!t || !w || !len) return 'Enter thickness, width and length';
    const bf = ((t * w * len) / 144) * qty;
    const outputs: Output[] = [
      { label: 'Board feet', value: fmtNum(bf, 2), big: true },
      { label: 'Per piece', value: fmtNum(bf / qty, 3) + ' bf' },
      { label: 'Linear feet', value: fmtNum((len / 12) * qty, 2) },
    ];
    if (price != null) outputs.splice(1, 0, { label: 'Cost', value: '$' + fmtNum(bf * price, 2, 2), big: true });
    return { outputs };
  },
};

// --- Concrete & site -------------------------------------------------------

const BAGS = [
  { lb: 80, cuft: 0.6 },
  { lb: 60, cuft: 0.45 },
  { lb: 40, cuft: 0.3 },
];

const concrete: Solver = {
  id: 'concrete',
  title: 'Concrete',
  blurb: 'Yards and bags for slabs, footings and round columns',
  group: 'Concrete & Site',
  pro: false,
  fields: [
    {
      key: 'shape',
      label: 'Shape',
      kind: 'choice',
      options: [
        { label: 'Slab / footing', value: 'slab' },
        { label: 'Round column', value: 'round' },
      ],
    },
    { key: 'len', label: 'Length', kind: 'length', unit: 'ft' },
    { key: 'wid', label: 'Width', kind: 'length', unit: 'ft' },
    { key: 'dia', label: 'Diameter', kind: 'length', unit: 'in' },
    { key: 'depth', label: 'Thickness / depth', kind: 'length', unit: 'in' },
    { key: 'count', label: 'How many', kind: 'number', optional: true },
    { key: 'waste', label: 'Extra for waste', kind: 'number', suffix: '%', optional: true },
  ],
  example: { shape: 'slab', len: "12'", wid: "10' 6\"", dia: '12"', depth: '4"', count: '1', waste: '10' },
  compute(v) {
    const round = v.shape === 'round';
    const depth = L(v, 'depth');
    const count = N(v, 'count') ?? 1;
    const waste = (N(v, 'waste') ?? 0) / 100;
    let cuin: number;
    if (round) {
      const dia = L(v, 'dia');
      if (!dia || !depth) return 'Enter diameter and depth';
      cuin = Math.PI * (dia / 2) ** 2 * depth;
    } else {
      const len = L(v, 'len', 'ft');
      const wid = L(v, 'wid', 'ft');
      if (!len || !wid || !depth) return 'Enter length, width and thickness';
      cuin = len * wid * depth;
    }
    const total = cuin * count * (1 + waste);
    const cuft = total / CUIN_PER.cuft;
    return {
      outputs: [
        { label: 'Concrete', value: fmtNum(total / CUIN_PER.cuyd, 2) + ' yd³', big: true, note: waste ? `Includes ${fmtNum(waste * 100, 1)}% extra` : undefined },
        { label: 'Cubic feet', value: fmtNum(cuft, 2) + ' ft³' },
        { label: 'Cubic meters', value: fmtNum(total / CUIN_PER.m3, 3) + ' m³' },
        ...BAGS.map((b) => ({ label: `${b.lb} lb bags`, value: `${ceil(cuft / b.cuft)}`, big: b.lb === 80 })),
      ],
    };
  },
  // field visibility depends on shape
};
export const hiddenFields: Record<string, (v: Values) => string[]> = {
  concrete: (v) => (v.shape === 'round' ? ['len', 'wid'] : ['dia']),
};

const MATERIALS: Record<string, { label: string; tonsPerYd: number; bagCuft: number }> = {
  gravel: { label: 'Gravel', tonsPerYd: 1.4, bagCuft: 0.5 },
  sand: { label: 'Sand', tonsPerYd: 1.35, bagCuft: 0.5 },
  topsoil: { label: 'Topsoil', tonsPerYd: 1.1, bagCuft: 0.75 },
  mulch: { label: 'Mulch', tonsPerYd: 0.4, bagCuft: 2 },
};

const fill: Solver = {
  id: 'fill',
  title: 'Gravel, Sand & Mulch',
  blurb: 'Cubic yards, tons and bags to cover an area',
  group: 'Concrete & Site',
  pro: true,
  fields: [
    { key: 'mat', label: 'Material', kind: 'choice', options: Object.entries(MATERIALS).map(([value, m]) => ({ label: m.label, value })) },
    { key: 'len', label: 'Length', kind: 'length', unit: 'ft' },
    { key: 'wid', label: 'Width', kind: 'length', unit: 'ft' },
    { key: 'depth', label: 'Depth', kind: 'length', unit: 'in' },
  ],
  example: { mat: 'gravel', len: "30'", wid: "10'", depth: '4"' },
  compute(v) {
    const m = MATERIALS[v.mat] ?? MATERIALS.gravel;
    const len = L(v, 'len', 'ft');
    const wid = L(v, 'wid', 'ft');
    const depth = L(v, 'depth');
    if (!len || !wid || !depth) return 'Enter length, width and depth';
    const cuin = len * wid * depth;
    const yd = cuin / CUIN_PER.cuyd;
    return {
      outputs: [
        { label: 'Cubic yards', value: fmtNum(yd, 2) + ' yd³', big: true },
        { label: 'Weight (approx.)', value: fmtNum(yd * m.tonsPerYd, 2) + ' tons', big: true, note: `${m.label} at about ${m.tonsPerYd} tons per yard` },
        { label: `${fmtNum(m.bagCuft, 2)} cu ft bags`, value: `${ceil(cuin / CUIN_PER.cuft / m.bagCuft)}` },
        { label: 'Area', value: sqft(len * wid) },
      ],
    };
  },
};

const slope: Solver = {
  id: 'slope',
  title: 'Slope & Grade',
  blurb: 'Percent grade, degrees, pitch and inches per foot',
  group: 'Concrete & Site',
  pro: false,
  fields: [
    { key: 'rise', label: 'Rise (drop)', kind: 'length', unit: 'in' },
    { key: 'run', label: 'Run', kind: 'length', unit: 'ft' },
  ],
  example: { rise: '3"', run: "12'" },
  compute(v, p) {
    const rise = L(v, 'rise');
    const run = L(v, 'run', 'ft');
    if (rise == null || !run) return 'Enter rise and run';
    const g = rise / run;
    return {
      outputs: [
        { label: 'Grade', value: fmtNum(g * 100, 2) + '%', big: true },
        { label: 'Per foot', value: formatIn(g * 12, p) + ' per ft', big: true },
        { label: 'Angle', value: deg(Math.atan(g)) },
        { label: 'Pitch', value: fmtNum(g * 12, 2) + '/12' },
        { label: 'Ratio', value: g ? `1 : ${fmtNum(1 / g, 1)}` : '—' },
      ],
      warnings: v.rise && g > 0 && g < 1 / 48 - 1e-9 ? ['Less than 1/4" per foot — too flat for most drain lines'] : [],
    };
  },
};

// --- Finish ----------------------------------------------------------------

const SHEETS: Record<string, number> = { '4x8': 32, '4x10': 40, '4x12': 48 };

const drywall: Solver = {
  id: 'drywall',
  title: 'Drywall',
  blurb: 'Sheets, screws, mud and tape for walls and ceilings',
  group: 'Finish',
  pro: true,
  fields: [
    { key: 'perim', label: 'Total wall length', kind: 'length', unit: 'ft', help: 'Add up every wall' },
    { key: 'height', label: 'Wall height', kind: 'length', unit: 'ft' },
    { key: 'ceiling', label: 'Ceiling area', kind: 'number', suffix: 'sq ft', optional: true },
    { key: 'openings', label: 'Doors + windows', kind: 'number', optional: true, help: 'Deducted at about 18 sq ft each' },
    { key: 'sheet', label: 'Sheet size', kind: 'choice', options: Object.keys(SHEETS).map((k) => ({ label: k.replace('x', ' × ') + "'", value: k })) },
    { key: 'waste', label: 'Extra for waste', kind: 'number', suffix: '%', optional: true },
  ],
  example: { perim: "48'", height: "8'", ceiling: '144', openings: '3', sheet: '4x12', waste: '10' },
  compute(v) {
    const perim = L(v, 'perim', 'ft');
    const h = L(v, 'height', 'ft');
    if (!perim || !h) return 'Enter wall length and height';
    const ceiling = N(v, 'ceiling') ?? 0;
    const openings = N(v, 'openings') ?? 0;
    const waste = (N(v, 'waste') ?? 10) / 100;
    const area = Math.max(0, (perim * h) / 144 + ceiling - openings * 18);
    const per = SHEETS[v.sheet] ?? 32;
    const sheets = ceil((area * (1 + waste)) / per);
    return {
      outputs: [
        { label: 'Sheets', value: `${sheets}`, big: true, note: `${v.sheet || '4x8'} sheets with ${fmtNum(waste * 100, 0)}% extra` },
        { label: 'Area to cover', value: fmtNum(area, 1) + ' sq ft', big: true },
        { label: 'Screws (approx.)', value: `${ceil(area * 1.05)}`, note: 'About one per square foot' },
        { label: 'Joint compound', value: fmtNum(area / 100, 1) + ' gal', note: 'About 1 gallon per 100 sq ft' },
        { label: 'Paper tape', value: `${ceil(area * 0.37)} ft` },
      ],
    };
  },
};

const tile: Solver = {
  id: 'tile',
  title: 'Tile & Flooring',
  blurb: 'Tiles, boxes and square feet to buy',
  group: 'Finish',
  pro: true,
  fields: [
    { key: 'len', label: 'Room length', kind: 'length', unit: 'ft' },
    { key: 'wid', label: 'Room width', kind: 'length', unit: 'ft' },
    { key: 'tw', label: 'Tile width', kind: 'length', unit: 'in' },
    { key: 'th', label: 'Tile length', kind: 'length', unit: 'in' },
    { key: 'joint', label: 'Grout joint', kind: 'length', unit: 'in', optional: true },
    { key: 'box', label: 'Tiles per box', kind: 'number', optional: true },
    { key: 'waste', label: 'Extra for cuts', kind: 'number', suffix: '%', optional: true },
  ],
  example: { len: "12' 6\"", wid: "10'", tw: '12"', th: '24"', joint: '1/8"', box: '8', waste: '10' },
  compute(v) {
    const len = L(v, 'len', 'ft');
    const wid = L(v, 'wid', 'ft');
    const tw = L(v, 'tw');
    const th = L(v, 'th');
    if (!len || !wid || !tw || !th) return 'Enter the room and tile sizes';
    const j = L(v, 'joint') ?? 0;
    const box = N(v, 'box');
    const waste = (N(v, 'waste') ?? 10) / 100;
    const area = len * wid;
    const tiles = ceil(((area / ((tw + j) * (th + j))) * (1 + waste)));
    const outputs: Output[] = [
      { label: 'Tiles', value: `${tiles}`, big: true, note: `Includes ${fmtNum(waste * 100, 0)}% extra` },
      { label: 'Floor area', value: sqft(area), big: true },
      { label: 'Area to buy', value: sqft(area * (1 + waste)) },
    ];
    if (box && box > 0) outputs.splice(1, 0, { label: 'Boxes', value: `${ceil(tiles / box)}`, big: true });
    return { outputs };
  },
};

const paint: Solver = {
  id: 'paint',
  title: 'Paint',
  blurb: 'Gallons for walls and ceilings, any number of coats',
  group: 'Finish',
  pro: true,
  fields: [
    { key: 'perim', label: 'Total wall length', kind: 'length', unit: 'ft' },
    { key: 'height', label: 'Wall height', kind: 'length', unit: 'ft' },
    { key: 'doors', label: 'Doors', kind: 'number', optional: true },
    { key: 'windows', label: 'Windows', kind: 'number', optional: true },
    { key: 'coats', label: 'Coats', kind: 'number' },
    { key: 'coverage', label: 'Coverage per gallon', kind: 'number', suffix: 'sq ft', optional: true },
  ],
  example: { perim: "52'", height: "9'", doors: '2', windows: '3', coats: '2', coverage: '350' },
  compute(v) {
    const perim = L(v, 'perim', 'ft');
    const h = L(v, 'height', 'ft');
    if (!perim || !h) return 'Enter wall length and height';
    const doors = N(v, 'doors') ?? 0;
    const windows = N(v, 'windows') ?? 0;
    const coats = N(v, 'coats') ?? 2;
    const cov = N(v, 'coverage') ?? 350;
    const area = Math.max(0, (perim * h) / 144 - doors * 21 - windows * 15);
    const gal = (area * coats) / cov;
    return {
      outputs: [
        { label: 'Paint', value: fmtNum(gal, 2) + ' gal', big: true },
        { label: 'Buy', value: `${Math.floor(gal)} gal + ${ceil((gal % 1) * 4)} qt`, big: true },
        { label: 'Paintable area', value: fmtNum(area, 1) + ' sq ft', note: 'Doors 21 sq ft, windows 15 sq ft each' },
      ],
    };
  },
};

const decking: Solver = {
  id: 'decking',
  title: 'Decking',
  blurb: 'Boards, joists and screws for a deck surface',
  group: 'Finish',
  pro: true,
  fields: [
    { key: 'len', label: 'Deck length (along the boards)', kind: 'length', unit: 'ft' },
    { key: 'wid', label: 'Deck width (across the boards)', kind: 'length', unit: 'ft' },
    { key: 'bw', label: 'Board width (actual)', kind: 'length', unit: 'in' },
    { key: 'gap', label: 'Gap', kind: 'length', unit: 'in' },
    { key: 'blen', label: 'Board length', kind: 'length', unit: 'ft' },
    { key: 'oc', label: 'Joist spacing', kind: 'length', unit: 'in' },
  ],
  example: { len: "16'", wid: "12'", bw: '5 1/2"', gap: '3/16"', blen: "16'", oc: '16"' },
  compute(v) {
    const len = L(v, 'len', 'ft');
    const wid = L(v, 'wid', 'ft');
    const bw = L(v, 'bw') ?? 5.5;
    const gap = L(v, 'gap') ?? 0.1875;
    const blen = L(v, 'blen', 'ft') ?? 192;
    const oc = L(v, 'oc') ?? 16;
    if (!len || !wid) return 'Enter the deck size';
    const rows = ceil((wid + gap) / (bw + gap));
    const perRow = ceil(len / blen);
    const joists = Math.floor(len / oc + 1e-9) + 1;
    return {
      outputs: [
        { label: 'Deck boards', value: `${rows * perRow}`, big: true, note: `${rows} rows × ${perRow} per row, ${formatFtIn(blen, 16)} boards` },
        { label: 'Linear feet', value: fmtNum((rows * len) / 12, 1), big: true },
        { label: 'Joists', value: `${joists}`, note: `At ${formatIn(oc, 16)} OC across the ${formatFtIn(len, 16)} side` },
        { label: 'Screws', value: `${rows * joists * 2}`, note: 'Two per board at every joist' },
        { label: 'Deck area', value: sqft(len * wid) },
      ],
    };
  },
};

// --- Geometry --------------------------------------------------------------

const triangle: Solver = {
  id: 'triangle',
  title: 'Right Triangle & Square',
  blurb: 'Any two sides give the third; check a corner for square',
  group: 'Geometry',
  pro: false,
  fields: [
    { key: 'rise', label: 'Rise (side A)', kind: 'length', unit: 'in', optional: true },
    { key: 'run', label: 'Run (side B)', kind: 'length', unit: 'in', optional: true },
    { key: 'diag', label: 'Diagonal (C)', kind: 'length', unit: 'in', optional: true, help: 'Fill all three to check for square' },
  ],
  example: { rise: "9'", run: "12'", diag: '' },
  compute(v, p) {
    let a = L(v, 'rise');
    let b = L(v, 'run');
    let c = L(v, 'diag');
    const given = [a, b, c].filter((x) => x != null && x > 0).length;
    if (given < 2) return 'Enter any two sides';
    const outputs: Output[] = [];
    const warnings: string[] = [];
    if (given === 3) {
      const ideal = Math.hypot(a!, b!);
      const off = c! - ideal;
      outputs.push({ label: 'Square diagonal', value: ftIn(ideal, p), big: true });
      outputs.push({
        label: Math.abs(off) < 1 / 32 ? 'Square' : off > 0 ? 'Diagonal long by' : 'Diagonal short by',
        value: Math.abs(off) < 1 / 32 ? '✓ within 1/32"' : formatIn(Math.abs(off), 32),
        big: true,
      });
    } else if (c == null || !(c > 0)) {
      c = Math.hypot(a!, b!);
      outputs.push({ label: 'Diagonal', value: ftIn(c, p), big: true });
    } else if (a == null || !(a > 0)) {
      if (c <= b!) return 'The diagonal must be longer than the run';
      a = Math.sqrt(c * c - b! * b!);
      outputs.push({ label: 'Rise', value: ftIn(a, p), big: true });
    } else {
      if (c <= a) return 'The diagonal must be longer than the rise';
      b = Math.sqrt(c * c - a * a);
      outputs.push({ label: 'Run', value: ftIn(b, p), big: true });
    }
    const A = Math.atan2(a!, b!);
    outputs.push(
      { label: 'Angle at run', value: deg(A) },
      { label: 'Angle at rise', value: deg(Math.PI / 2 - A) },
      { label: 'Pitch', value: fmtNum((a! / b!) * 12, 2) + '/12' },
      { label: 'Area', value: sqft((a! * b!) / 2) },
    );
    return {
      outputs,
      warnings,
      diagram: {
        kind: 'triangle',
        rise: a!,
        run: b!,
        riseLabel: ftIn(a!, p),
        runLabel: ftIn(b!, p),
        diagLabel: ftIn(given === 3 ? c! : Math.hypot(a!, b!), p),
        angle: deg(A),
      },
    };
  },
};

const arc: Solver = {
  id: 'arc',
  title: 'Arch & Circle',
  blurb: 'Radius from width and height, arc length, circles',
  group: 'Geometry',
  pro: true,
  fields: [
    { key: 'chord', label: 'Width (chord)', kind: 'length', unit: 'in' },
    { key: 'rise', label: 'Height of arch (rise)', kind: 'length', unit: 'in' },
  ],
  example: { chord: '36"', rise: '6"' },
  compute(v, p) {
    const c = L(v, 'chord');
    const h = L(v, 'rise');
    if (!c || !h || c <= 0 || h <= 0) return 'Enter width and height';
    if (h > c / 2 + 1e-9) return 'Height can be at most half the width (a half circle)';
    const r = (c * c) / (8 * h) + h / 2;
    const theta = 2 * Math.asin(c / (2 * r));
    return {
      outputs: [
        { label: 'Radius', value: ftIn(r, p), big: true, note: 'Swing this from a point below the arch on the centerline' },
        { label: 'Arc length', value: ftIn(r * theta, p), big: true },
        { label: 'Center below springline', value: ftIn(r - h, p) },
        { label: 'Arc angle', value: deg(theta) },
        { label: 'Full circle circumference', value: ftIn(2 * Math.PI * r, p) },
      ],
      diagram: { kind: 'arc', chord: c, rise: h, radiusLabel: ftIn(r, p), chordLabel: ftIn(c, p), riseLabel: ftIn(h, p) },
    };
  },
};

const miter: Solver = {
  id: 'miter',
  title: 'Miter & Crown Molding',
  blurb: 'Saw settings for any corner, flat trim or crown',
  group: 'Geometry',
  pro: true,
  fields: [
    {
      key: 'mode',
      label: 'Trim',
      kind: 'choice',
      options: [
        { label: 'Crown (flat on saw)', value: 'crown' },
        { label: 'Flat trim / frame', value: 'flat' },
      ],
    },
    { key: 'corner', label: 'Wall corner angle', kind: 'number', suffix: '°', help: '90 for a square corner, 135 for a bay' },
    { key: 'spring', label: 'Crown spring angle', kind: 'number', suffix: '°', help: 'Usually 38° or 45°' },
    { key: 'sides', label: 'Or: sides of a frame / polygon', kind: 'number', optional: true },
  ],
  example: { mode: 'crown', corner: '90', spring: '38', sides: '' },
  compute(v) {
    const sides = N(v, 'sides');
    let corner = N(v, 'corner') ?? 90;
    if (sides && sides >= 3) corner = 180 - 360 / sides;
    if (corner <= 0 || corner >= 180) return 'The corner angle must be between 0° and 180°';
    const half = (corner / 2) * DEG;
    if (v.mode === 'flat') {
      const m = 90 - corner / 2;
      return {
        outputs: [
          { label: 'Miter', value: fmtNum(m, 2) + '°', big: true },
          { label: 'Each piece', value: `${fmtNum(m, 2)}° — the joint closes to ${fmtNum(corner, 2)}°` },
        ],
        diagram: { kind: 'miter', miter: m },
      };
    }
    const s = (N(v, 'spring') ?? 38) * DEG;
    if (s <= 0 || s >= Math.PI / 2) return 'The spring angle must be between 0° and 90°';
    const m = Math.atan(Math.sin(s) / Math.tan(half)) / DEG;
    const b = Math.asin(Math.cos(s) * Math.cos(half)) / DEG;
    return {
      outputs: [
        { label: 'Miter', value: fmtNum(m, 2) + '°', big: true },
        { label: 'Bevel', value: fmtNum(b, 2) + '°', big: true },
        { label: 'How to cut', value: 'Lay the crown flat, finished face up; set both angles on a compound miter saw' },
      ],
      diagram: { kind: 'miter', miter: m, bevel: b },
    };
  },
};

export const SOLVERS: Solver[] = [stairs, rafter, studs, boardFeet, concrete, fill, slope, spacing, drywall, tile, paint, decking, triangle, arc, miter];

export const GROUPS: Solver['group'][] = ['Framing', 'Concrete & Site', 'Finish', 'Geometry'];

export function solverById(id: string) {
  return SOLVERS.find((s) => s.id === id);
}

export function runSolver(s: Solver, v: Values, precision: Precision): Result | string {
  try {
    return s.compute(v, precision);
  } catch (e) {
    return e instanceof Error ? e.message : 'Could not calculate';
  }
}
