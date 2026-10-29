import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { GROUPS, hiddenFields, runSolver, SOLVERS, type Field, type Solver, type Values } from '../core/solvers.ts';
import { setInputs, useStore } from '../state/store.ts';
import { Diagram } from './Diagram.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { usePaywall } from './pro.ts';
import { countUse } from './review.ts';
import { NUM, usePalette, type Palette } from './theme.ts';

const GROUP_ICON: Record<Solver['group'], IconName> = {
  Framing: 'framing',
  'Concrete & Site': 'concrete',
  Finish: 'finish',
  Geometry: 'geometry',
};

export function Tools({ open, onOpen }: { open: string | null; onOpen: (id: string | null) => void }) {
  const solver = SOLVERS.find((s) => s.id === open);
  if (solver) return <SolverScreen key={solver.id} solver={solver} onBack={() => onOpen(null)} />;
  return <ToolList onOpen={onOpen} />;
}

function ToolList({ onOpen }: { onOpen: (id: string) => void }) {
  const c = usePalette();
  const s = useMemo(() => styles(c), [c]);
  const pro = useStore((st) => st.pro);
  const { openPaywall } = usePaywall();
  return (
    <ScrollView style={s.root} contentContainerStyle={s.listPad}>
      <Text style={s.h1}>Tools</Text>
      {!pro && (
        <Pressable testID="pro-banner" style={s.proBanner} onPress={() => openPaywall()}>
          <View style={{ flex: 1 }}>
            <Text style={s.proBannerTitle}>Unlock every tool — pay once</Text>
            <Text style={s.proBannerText}>Stairs, rafters, stud layout, balusters, crown and more. No subscription.</Text>
          </View>
          <Icon name="right" color={c.accentText} />
        </Pressable>
      )}
      {GROUPS.map((g) => (
        <View key={g} style={s.group}>
          <View style={s.groupHead}>
            <Icon name={GROUP_ICON[g]} size={18} color={c.dim} />
            <Text style={s.groupTitle}>{g}</Text>
          </View>
          <View style={s.card}>
            {SOLVERS.filter((x) => x.group === g).map((x, i) => (
              <Pressable key={x.id} testID={`tool-${x.id}`} onPress={() => onOpen(x.id)} style={({ pressed }) => [s.row, i > 0 && s.rowLine, pressed && { opacity: 0.6 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{x.title}</Text>
                  <Text style={s.rowBlurb}>{x.blurb}</Text>
                </View>
                {x.pro && !pro ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>PRO</Text>
                  </View>
                ) : !x.pro && !pro ? (
                  <Text style={s.free}>FREE</Text>
                ) : null}
                <Icon name="right" size={18} color={c.faint} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Text style={s.footnote}>Every field takes tape measurements and arithmetic: 12' 6", 7 3/8", 8' - 1 1/2".</Text>
    </ScrollView>
  );
}

function SolverScreen({ solver, onBack }: { solver: Solver; onBack: () => void }) {
  const c = usePalette();
  const s = useMemo(() => styles(c), [c]);
  const pro = useStore((st) => st.pro);
  const precision = useStore((st) => st.precision);
  const saved = useStore((st) => st.inputs[solver.id]);
  const { openPaywall } = usePaywall();
  const locked = solver.pro && !pro;
  const [draft, setDraft] = useState<Values>(() => ({ ...solver.example, ...(locked ? {} : saved) }));
  const values = locked ? solver.example : draft;
  const result = runSolver(solver, values, precision);
  const hidden = hiddenFields[solver.id]?.(values) ?? [];

  function set(key: string, v: string) {
    if (locked) return openPaywall(solver.title);
    const next = { ...draft, [key]: v };
    setDraft(next);
    setInputs(solver.id, next);
  }

  function share() {
    if (typeof result === 'string') return;
    const lines = [
      `${solver.title}`,
      ...solver.fields.filter((f) => !hidden.includes(f.key) && values[f.key]).map((f) => `${f.label}: ${choiceLabel(f, values[f.key])}`),
      '',
      ...result.outputs.map((o) => `${o.label}: ${o.value}`),
      ...(result.marks ? ['', result.marks.title + ':', ...result.marks.items] : []),
      '',
      'Worked out with Kerf',
    ];
    Share.share({ message: lines.join('\n') }).catch(() => {});
    countUse();
  }

  return (
    <View style={s.root}>
      <View style={s.navBar}>
        <Pressable testID="back" onPress={onBack} hitSlop={12} style={s.back} accessibilityLabel="Back to tools">
          <Icon name="left" color={c.accent} />
          <Text style={s.backText}>Tools</Text>
        </Pressable>
        {typeof result !== 'string' && (
          <Pressable onPress={share} hitSlop={12} accessibilityLabel="Share result">
            <Icon name="share" color={c.accent} />
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={s.solverPad} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <Text style={s.h1}>{solver.title}</Text>
        <Text style={s.blurb}>{solver.blurb}</Text>

        {locked && (
          <Pressable style={s.lockBanner} onPress={() => openPaywall(solver.title)}>
            <Icon name="lock" size={18} color={c.accent} />
            <Text style={s.lockText}>A worked example. Unlock Pro to enter your own numbers.</Text>
          </Pressable>
        )}

        <View style={s.card}>
          {solver.fields
            .filter((f) => !hidden.includes(f.key))
            .map((f, i) => (
              <FieldRow key={f.key} f={f} value={values[f.key] ?? ''} onChange={(v) => set(f.key, v)} locked={locked} onLocked={() => openPaywall(solver.title)} c={c} first={i === 0} onDone={() => typeof result !== 'string' && countUse()} />
            ))}
        </View>

        {typeof result === 'string' ? (
          <Text style={s.prompt}>{result}</Text>
        ) : (
          <>
            <View style={s.results}>
              {[...result.outputs.filter((o) => o.big), ...result.outputs.filter((o) => !o.big)].map((o) => (
                <View key={o.label} style={[s.out, o.big && s.outBig]}>
                  <Text style={[s.outLabel, o.big && s.outLabelBig]}>{o.label}</Text>
                  <Text style={[o.big ? s.outValueBig : s.outValue, NUM]}>{o.value}</Text>
                  {o.note && <Text style={[s.outNote, o.big && s.outNoteBig]}>{o.note}</Text>}
                </View>
              ))}
            </View>
            {result.warnings?.map((w) => (
              <View key={w} style={s.warn}>
                <Icon name="warn" size={18} color={c.warn} />
                <Text style={s.warnText}>{w}</Text>
              </View>
            ))}
            {result.diagram && (
              <View style={s.diagram}>
                <Diagram d={result.diagram} c={c} />
              </View>
            )}
            {result.marks && result.marks.items.length > 0 && (
              <View style={s.card}>
                <Text style={s.marksTitle}>{result.marks.title}</Text>
                {result.marks.items.map((m, i) => (
                  <View key={i} style={[s.markRow, i > 0 && s.rowLine]}>
                    <Text style={s.markIndex}>{i + 1}</Text>
                    <Text style={[s.markValue, NUM]}>{m}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        {locked && (
          <Pressable testID="unlock" style={s.unlock} onPress={() => openPaywall(solver.title)}>
            <Text style={s.unlockText}>Unlock {solver.title} and every Pro tool</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function choiceLabel(f: Field, v: string) {
  return f.kind === 'choice' ? f.options?.find((o) => o.value === v)?.label ?? v : v;
}

function FieldRow({ f, value, onChange, locked, onLocked, c, first, onDone }: { f: Field; value: string; onChange: (v: string) => void; locked: boolean; onLocked: () => void; c: Palette; first: boolean; onDone: () => void }) {
  const s = useMemo(() => styles(c), [c]);
  if (f.kind === 'choice') {
    return (
      <View style={[s.field, !first && s.rowLine]}>
        <Text style={s.fieldLabel}>{f.label}</Text>
        <View style={s.seg}>
          {f.options!.map((o) => (
            <Pressable key={o.value} testID={`opt-${f.key}-${o.value}`} onPress={() => (locked ? onLocked() : onChange(o.value))} style={[s.segItem, value === o.value && s.segOn]}>
              <Text style={[s.segText, value === o.value && s.segTextOn]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  const unit = f.kind === 'length' ? (f.unit === 'ft' ? 'ft' : 'in') : f.suffix;
  return (
    <Pressable onPress={locked ? onLocked : undefined} style={[s.field, !first && s.rowLine]}>
      <View style={s.fieldTop}>
        <Text style={s.fieldLabel}>
          {f.label}
          {f.optional ? <Text style={s.optional}>  optional</Text> : null}
        </Text>
      </View>
      <View style={s.inputRow}>
        <TextInput
          testID={`field-${f.key}`}
          value={value}
          onChangeText={onChange}
          editable={!locked}
          onPressIn={locked ? onLocked : undefined}
          onBlur={onDone}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          returnKeyType="done"
          placeholder={f.optional ? '—' : '0'}
          placeholderTextColor={c.faint}
          style={[s.input, NUM]}
          selectTextOnFocus
        />
        {unit ? <Text style={s.unitHint}>{unit}</Text> : null}
      </View>
      {f.help && <Text style={s.help}>{f.help}</Text>}
    </Pressable>
  );
}

const styles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    listPad: { padding: 16, paddingBottom: 40, gap: 6 },
    h1: { color: c.text, fontSize: 30, fontWeight: '800', marginBottom: 4 },
    blurb: { color: c.dim, fontSize: 15, marginBottom: 12 },
    proBanner: { backgroundColor: c.accent, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
    proBannerTitle: { color: c.accentText, fontSize: 16, fontWeight: '800' },
    proBannerText: { color: c.accentText, fontSize: 13, opacity: 0.85, marginTop: 2 },
    group: { marginTop: 14 },
    groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginLeft: 4 },
    groupTitle: { color: c.dim, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, gap: 10 },
    rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
    rowTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
    rowBlurb: { color: c.dim, fontSize: 13, marginTop: 2 },
    badge: { backgroundColor: c.keyUnit, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    badgeText: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    free: { color: c.good, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    footnote: { color: c.faint, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
    navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
    back: { flexDirection: 'row', alignItems: 'center' },
    backText: { color: c.accent, fontSize: 17 },
    solverPad: { paddingHorizontal: 16, paddingBottom: 60 },
    lockBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.keyUnit, borderRadius: 12, padding: 12, marginBottom: 12 },
    lockText: { color: c.text, fontSize: 14, flex: 1 },
    diagram: { backgroundColor: c.surface, borderRadius: 14, paddingVertical: 8, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
    field: { paddingHorizontal: 14, paddingVertical: 10 },
    fieldTop: { flexDirection: 'row', justifyContent: 'space-between' },
    fieldLabel: { color: c.dim, fontSize: 13, fontWeight: '600' },
    optional: { color: c.faint, fontWeight: '400' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: { flex: 1, color: c.text, fontSize: 22, fontWeight: '600', paddingVertical: 4 },
    unitHint: { color: c.faint, fontSize: 15 },
    help: { color: c.faint, fontSize: 12, marginTop: 2 },
    seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    segItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, backgroundColor: c.surface2 },
    segOn: { backgroundColor: c.accent },
    segText: { color: c.text, fontSize: 14, fontWeight: '600' },
    segTextOn: { color: c.accentText },
    prompt: { color: c.dim, fontSize: 16, textAlign: 'center', marginVertical: 16 },
    results: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    out: { backgroundColor: c.surface, borderRadius: 12, padding: 12, width: '100%', borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
    outBig: { width: '48.6%', backgroundColor: c.tape, borderColor: c.tape },
    outLabel: { color: c.dim, fontSize: 12, fontWeight: '600' },
    outValue: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: 2 },
    outValueBig: { color: c.tapeInk, fontSize: 24, fontWeight: '800', marginTop: 2 },
    outNote: { color: c.faint, fontSize: 12, marginTop: 3 },
    outLabelBig: { color: c.tapeInk, opacity: 0.7 },
    outNoteBig: { color: c.tapeInk, opacity: 0.65 },
    warn: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: c.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.warn },
    warnText: { color: c.text, fontSize: 14, flex: 1 },
    marksTitle: { color: c.dim, fontSize: 13, fontWeight: '700', padding: 14, paddingBottom: 6 },
    markRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 9, gap: 14 },
    markIndex: { color: c.faint, fontSize: 15, width: 24, textAlign: 'right' },
    markValue: { color: c.text, fontSize: 17, fontWeight: '600' },
    unlock: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
    unlockText: { color: c.accentText, fontSize: 16, fontWeight: '800' },
  });
