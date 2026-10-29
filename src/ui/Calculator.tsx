import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { CalcError, evaluate, prettyExpr, tryEvaluate } from '../core/expr.ts';
import { readings, tapeParts, type Precision } from '../core/format.ts';
import { applyKey, type Key } from '../core/keypad.ts';
import type { Qty } from '../core/units.ts';
import { pushTape, setState, useStore } from '../state/store.ts';
import { maybeAskForReview } from './review.ts';
import { NUM, usePalette, type Palette } from './theme.ts';

type Carry = { text: string; q: Qty };

const PRECISIONS: Precision[] = [8, 16, 32, 64];

/** The exact value behind a displayed (rounded) result, for chaining. */
function carrySource(q: Qty) {
  const unit = ['', '"', ' sqin', ' cuin'][q.d];
  return `(${q.v}${unit})`;
}

function displayText(q: Qty, precision: Precision) {
  return readings(q, precision)[0].value;
}

function haptic(on: boolean) {
  if (on && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function Calculator() {
  const c = usePalette();
  const s = useMemo(() => styles(c), [c]);
  const precision = useStore((st) => st.precision);
  const tape = useStore((st) => st.tape);
  const hapticsOn = useStore((st) => st.haptics);
  const hintSeen = useStore((st) => st.hintSeen);
  const [expr, setExpr] = useState('');
  const [carry, setCarry] = useState<Carry | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const tapeRef = useRef<FlatList>(null);

  const source = carry && expr.startsWith(carry.text) ? carrySource(carry.q) + expr.slice(carry.text.length) : expr;
  const live = expr ? tryEvaluate(source) : null;

  function press(key: Key) {
    haptic(hapticsOn);
    setError(null);
    if (!hintSeen) setState({ hintSeen: true });
    const continues = ['+', '-', '×', '÷'].includes(key);
    if (justEvaluated && !continues) {
      setCarry(null);
      setJustEvaluated(false);
      if (key === 'back') {
        setExpr('');
        return;
      }
      setExpr(applyKey('', key));
      return;
    }
    setJustEvaluated(false);
    const next = applyKey(expr, key);
    if (carry && !next.startsWith(carry.text)) setCarry(null);
    setExpr(next);
  }

  function equals() {
    if (!expr) return;
    try {
      const q = evaluate(source);
      if (!isFinite(q.v)) throw new CalcError('That number is too large');
      const text = displayText(q, precision);
      pushTape({ expr: prettyExpr(expr), result: text });
      setExpr(text);
      setCarry({ text, q });
      setJustEvaluated(true);
      haptic(hapticsOn);
      maybeAskForReview();
      requestAnimationFrame(() => tapeRef.current?.scrollToOffset({ offset: 0, animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not calculate');
      if (hapticsOn && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }

  function reuse(result: string) {
    haptic(hapticsOn);
    setError(null);
    setCarry(null);
    setJustEvaluated(false);
    const e = expr.replace(/\s+$/, '');
    const base = !e || justEvaluated ? '' : /[+\-×÷(]$/.test(e) ? e + ' ' : e + ' + ';
    setExpr(base + result.replace(/ ft²$/, ' sqft').replace(/ yd³$/, ' cuyd'));
  }

  async function copy(value: string) {
    await Clipboard.setStringAsync(value).catch(() => {});
    setCopied(value);
    setTimeout(() => setCopied(null), 1200);
  }

  const shown = live ?? (justEvaluated && carry ? carry.q : null);
  const parts = shown && shown.d === 1 ? tapeParts(shown.v, precision) : null;
  const rd = shown ? readings(shown, precision) : [];

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.brand}>Kerf</Text>
        {tape.length > 0 && (
          <Pressable hitSlop={10} onPress={() => setState({ tape: [] })}>
            <Text style={s.clearTape}>Clear tape</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={tapeRef}
        style={s.tape}
        inverted
        data={tape}
        keyExtractor={(t) => String(t.at)}
        ListEmptyComponent={
          <View style={s.hint}>
            <Text style={s.hintTitle}>Punch it in like you read it off the tape</Text>
            <Text style={s.hintText}>5  ft  7  in  3  ⁄  8   →   5' 7 3/8"</Text>
            <Text style={s.hintText}>Add, subtract, multiply into square and cubic feet, divide into equal parts.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => reuse(item.result)} style={s.tapeLine}>
            <Text style={s.tapeExpr} numberOfLines={1}>
              {item.expr} =
            </Text>
            <Text style={[s.tapeResult, NUM]}>{item.result}</Text>
          </Pressable>
        )}
      />

      <View style={s.blade} testID="display">
        <Ticks color={c.tapeInk} />
        <Text style={s.expr} numberOfLines={2} adjustsFontSizeToFit>
          {expr ? prettyExpr(expr) : ' '}
        </Text>
        <View style={s.resultRow}>
          {error ? (
            <Text style={s.error} numberOfLines={2}>
              {error}
            </Text>
          ) : (
            <>
              <Text style={[s.result, NUM]} numberOfLines={1} adjustsFontSizeToFit>
                {shown ? displayText(shown, precision) : '0"'}
              </Text>
              {parts && parts.dir !== 'exact' && <Text style={s.dir}>{parts.dir}</Text>}
            </>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsInner}>
        {rd.slice(1).map((r) => (
          <Pressable key={r.label} onPress={() => copy(r.value)} style={s.chip}>
            <Text style={[s.chipValue, NUM]}>{copied === r.value ? 'Copied' : r.value}</Text>
            <Text style={s.chipLabel}>{r.label}</Text>
          </Pressable>
        ))}
        {shown && shown.d === 0 && (
          <Text style={s.chipHint}>Plain number — add ft or in to make it a length</Text>
        )}
        {!shown && <Text style={s.chipHint}>Every reading shows here: inches, decimal feet, mm…</Text>}
      </ScrollView>

      <Keypad c={c} onKey={press} onEquals={equals} precision={precision} />
    </View>
  );
}

function Ticks({ color }: { color: string }) {
  // a strip of sixteenth marks along the top edge, like a tape blade
  const lines = [];
  for (let i = 0; i <= 96; i++) {
    const h = i % 16 === 0 ? 13 : i % 8 === 0 ? 9 : i % 4 === 0 ? 7 : i % 2 === 0 ? 5 : 3;
    lines.push(<Line key={i} x1={i * 4 + 2} y1={0} x2={i * 4 + 2} y2={h} stroke={color} strokeWidth={1} opacity={0.55} />);
  }
  return (
    <Svg width="100%" height={14} viewBox="0 0 390 14" preserveAspectRatio="xMinYMin slice" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      {lines}
    </Svg>
  );
}

type KeyDef = { k: Key | '='; label: string; kind: 'num' | 'op' | 'unit' | 'fn' | 'eq'; span?: number };

const ROWS: KeyDef[][] = [
  [
    { k: 'clear', label: 'AC', kind: 'fn' },
    { k: 'back', label: '⌫', kind: 'fn' },
    { k: '(', label: '(', kind: 'fn' },
    { k: ')', label: ')', kind: 'fn' },
    { k: '÷', label: '÷', kind: 'op' },
  ],
  [
    { k: '7', label: '7', kind: 'num' },
    { k: '8', label: '8', kind: 'num' },
    { k: '9', label: '9', kind: 'num' },
    { k: 'ft', label: "ft '", kind: 'unit' },
    { k: '×', label: '×', kind: 'op' },
  ],
  [
    { k: '4', label: '4', kind: 'num' },
    { k: '5', label: '5', kind: 'num' },
    { k: '6', label: '6', kind: 'num' },
    { k: 'in', label: 'in "', kind: 'unit' },
    { k: '-', label: '−', kind: 'op' },
  ],
  [
    { k: '1', label: '1', kind: 'num' },
    { k: '2', label: '2', kind: 'num' },
    { k: '3', label: '3', kind: 'num' },
    { k: 'frac', label: '⁄', kind: 'unit' },
    { k: '+', label: '+', kind: 'op' },
  ],
  [
    { k: '0', label: '0', kind: 'num', span: 2 },
    { k: '.', label: '.', kind: 'num' },
    { k: '=', label: '=', kind: 'eq', span: 2 },
  ],
];

const METRIC: { k: Key; label: string }[] = [
  { k: 'yd', label: 'yd' },
  { k: 'm', label: 'm' },
  { k: 'cm', label: 'cm' },
  { k: 'mm', label: 'mm' },
];

function Keypad({ c, onKey, onEquals, precision }: { c: Palette; onKey: (k: Key) => void; onEquals: () => void; precision: Precision }) {
  const s = useMemo(() => keyStyles(c), [c]);
  const nextPrecision = PRECISIONS[(PRECISIONS.indexOf(precision) + 1) % PRECISIONS.length];
  return (
    <View style={s.pad}>
      <View style={s.unitRow}>
        {METRIC.map((m) => (
          <Pressable key={m.k} testID={`key-${m.k}`} onPress={() => onKey(m.k)} style={({ pressed }) => [s.unitChip, pressed && s.pressed]}>
            <Text style={s.unitChipText}>{m.label}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setState({ precision: nextPrecision })}
          style={({ pressed }) => [s.precision, pressed && s.pressed]}
          accessibilityLabel={`Round to 1/${precision} inch. Tap for 1/${nextPrecision}.`}
        >
          <Text style={s.precisionText}>1/{precision}"</Text>
        </Pressable>
      </View>
      {ROWS.map((row, i) => (
        <View key={i} style={s.row}>
          {row.map((d) => (
            <Pressable
              key={d.k}
              testID={`key-${d.k}`}
              onPress={() => (d.k === '=' ? onEquals() : onKey(d.k as Key))}
              style={({ pressed }) => [s.key, s[d.kind], { flex: d.span ?? 1 }, pressed && s.pressed]}
              accessibilityLabel={d.k === 'frac' ? 'fraction bar' : d.k === 'back' ? 'delete' : d.label}
            >
              <Text style={[s.keyText, d.kind === 'eq' && s.eqText, d.kind === 'unit' && s.unitText, d.kind === 'fn' && s.fnText]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 2 },
    brand: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
    clearTape: { color: c.dim, fontSize: 14 },
    tape: { flex: 1, paddingHorizontal: 18 },
    tapeLine: { paddingVertical: 6, alignItems: 'flex-end' },
    tapeExpr: { color: c.dim, fontSize: 14 },
    tapeResult: { color: c.text, fontSize: 18, fontWeight: '600' },
    hint: { paddingVertical: 12, gap: 6 },
    hintTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    hintText: { color: c.dim, fontSize: 14, lineHeight: 20 },
    blade: {
      marginHorizontal: 12,
      backgroundColor: c.tape,
      borderRadius: 14,
      paddingTop: 18,
      paddingBottom: 10,
      paddingHorizontal: 16,
      overflow: 'hidden',
      minHeight: 108,
      justifyContent: 'flex-end',
    },
    expr: { color: c.tapeInk, opacity: 0.7, fontSize: 18, textAlign: 'right', fontWeight: '500' },
    resultRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8 },
    result: { color: c.tapeInk, fontSize: 44, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
    dir: { color: c.tapeInk, fontSize: 13, fontWeight: '700', marginBottom: 9, opacity: 0.75, textTransform: 'uppercase' },
    error: { color: '#8A1C1C', fontSize: 17, fontWeight: '700', textAlign: 'right', paddingVertical: 10 },
    chips: { flexGrow: 0, marginTop: 8 },
    chipsInner: { paddingHorizontal: 12, gap: 8, alignItems: 'center', minHeight: 46 },
    chip: { backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
    chipValue: { color: c.text, fontSize: 15, fontWeight: '600' },
    chipLabel: { color: c.faint, fontSize: 11 },
    chipHint: { color: c.faint, fontSize: 13, paddingHorizontal: 4 },
  });

const keyStyles = (c: Palette) =>
  StyleSheet.create({
    pad: { paddingHorizontal: 10, paddingBottom: 8, paddingTop: 4, gap: 7 },
    unitRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
    unitChip: { paddingHorizontal: 13, height: 32, borderRadius: 8, backgroundColor: c.surface2, justifyContent: 'center' },
    unitChipText: { color: c.text, fontSize: 15, fontWeight: '600' },
    precision: { paddingHorizontal: 12, height: 32, borderRadius: 8, borderWidth: 1, borderColor: c.accent, justifyContent: 'center' },
    precisionText: { color: c.accent, fontSize: 15, fontWeight: '700', ...NUM },
    row: { flexDirection: 'row', gap: 7 },
    key: { height: 58, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    num: { backgroundColor: c.key },
    op: { backgroundColor: c.keyOp },
    unit: { backgroundColor: c.keyUnit },
    fn: { backgroundColor: c.keyOp },
    eq: { backgroundColor: c.accent },
    pressed: { opacity: 0.6 },
    keyText: { color: c.text, fontSize: 26, fontWeight: '500' },
    unitText: { color: c.accent, fontSize: 21, fontWeight: '700' },
    fnText: { fontSize: 20, fontWeight: '600' },
    eqText: { color: c.accentText, fontSize: 30, fontWeight: '700' },
  });

