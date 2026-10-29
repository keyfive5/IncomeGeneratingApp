import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { Precision } from '../core/format.ts';
import { purchaser } from '../iap/iap';
import { setState, useStore } from '../state/store.ts';
import { Icon } from './Icon.tsx';
import { PRIVACY_URL, TERMS_URL, usePaywall } from './pro.ts';
import { usePalette, type Palette } from './theme.ts';

const PRECISIONS: Precision[] = [8, 16, 32, 64];

export function Settings() {
  const c = usePalette();
  const s = useMemo(() => styles(c), [c]);
  const st = useStore((x) => x);
  const { openPaywall } = usePaywall();
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  async function restore() {
    setRestoreMsg('Checking…');
    try {
      setRestoreMsg((await purchaser.restore()) ? 'Pro restored.' : 'No previous purchase found.');
    } catch {
      setRestoreMsg("Couldn't reach the App Store.");
    }
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.pad}>
      <Text style={s.h1}>Settings</Text>

      <View style={s.card}>
        {st.pro ? (
          <View style={s.row}>
            <Icon name="star" color={c.accent} />
            <Text style={[s.label, { flex: 1 }]}>Kerf Pro is unlocked</Text>
            <Icon name="check" color={c.good} />
          </View>
        ) : (
          <>
            <Pressable style={s.row} onPress={() => openPaywall()}>
              <Icon name="star" color={c.accent} />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Unlock Kerf Pro</Text>
                <Text style={s.sub}>Every tool, one payment, no subscription</Text>
              </View>
              <Icon name="right" color={c.faint} size={18} />
            </Pressable>
            <Pressable style={[s.row, s.line]} onPress={restore}>
              <Text style={[s.label, { flex: 1 }]}>Restore Purchase</Text>
              {restoreMsg && <Text style={s.sub}>{restoreMsg}</Text>}
            </Pressable>
          </>
        )}
      </View>

      <Text style={s.section}>Rounding</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={[s.label, { flex: 1 }]}>Round fractions to</Text>
        </View>
        <View style={s.seg}>
          {PRECISIONS.map((p) => (
            <Pressable key={p} onPress={() => setState({ precision: p })} style={[s.segItem, st.precision === p && s.segOn]}>
              <Text style={[s.segText, st.precision === p && s.segTextOn]}>1/{p}"</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.note}>Results a hair over a mark read "strong", a hair under read "scant".</Text>
      </View>

      <Text style={s.section}>On the job</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Keep screen on</Text>
            <Text style={s.sub}>So it's awake when you come back from the saw</Text>
          </View>
          <Switch value={st.keepAwake} onValueChange={(v) => setState({ keepAwake: v })} trackColor={{ true: c.accent }} />
        </View>
        <View style={[s.row, s.line]}>
          <Text style={[s.label, { flex: 1 }]}>Key clicks (haptics)</Text>
          <Switch value={st.haptics} onValueChange={(v) => setState({ haptics: v })} trackColor={{ true: c.accent }} />
        </View>
      </View>

      <Text style={s.section}>Typing measurements</Text>
      <View style={[s.card, { padding: 14, gap: 8 }]}>
        <Text style={s.help}>On the keypad: 5 ft 7 in 3 ⁄ 8 gives 5' 7 3/8".</Text>
        <Text style={s.help}>In tool fields, type it as written: 5' 7 3/8", 12', 1 1/2", 1200mm. A plain number uses the unit shown beside the field.</Text>
        <Text style={s.help}>Any field takes arithmetic too: 8' - 1 1/2", 3 × 16".</Text>
        <Text style={s.help}>Length × length gives square feet, × again gives cubic yards. Length ÷ length gives a count.</Text>
      </View>

      <View style={[s.card, { marginTop: 18 }]}>
        <Pressable
          style={s.row}
          onPress={() =>
            StoreReview.isAvailableAsync()
              .then((ok) => (ok ? StoreReview.requestReview() : undefined))
              .catch(() => {})
          }
        >
          <Text style={[s.label, { flex: 1 }]}>Rate Kerf</Text>
          <Icon name="right" color={c.faint} size={18} />
        </Pressable>
        <Pressable style={[s.row, s.line]} onPress={() => Linking.openURL('mailto:hzafar300@gmail.com?subject=Kerf')}>
          <Text style={[s.label, { flex: 1 }]}>Suggest a tool or report a problem</Text>
          <Icon name="right" color={c.faint} size={18} />
        </Pressable>
        <Pressable style={[s.row, s.line]} onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={[s.label, { flex: 1 }]}>Privacy Policy</Text>
          <Icon name="right" color={c.faint} size={18} />
        </Pressable>
        <Pressable style={[s.row, s.line]} onPress={() => Linking.openURL(TERMS_URL)}>
          <Text style={[s.label, { flex: 1 }]}>Terms of Use</Text>
          <Icon name="right" color={c.faint} size={18} />
        </Pressable>
      </View>
      <Text style={s.version}>
        Kerf {Constants.expoConfig?.version ?? ''} · No account, no ads, no tracking.{'\n'}Always check critical cuts against your local code and plans.
      </Text>
    </ScrollView>
  );
}

const styles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    pad: { padding: 16, paddingBottom: 40 },
    h1: { color: c.text, fontSize: 30, fontWeight: '800', marginBottom: 12 },
    section: { color: c.dim, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 20, marginBottom: 6, marginLeft: 4 },
    card: { backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
    line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
    label: { color: c.text, fontSize: 16, fontWeight: '600' },
    sub: { color: c.dim, fontSize: 13, marginTop: 1 },
    seg: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 4 },
    segItem: { flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: c.surface2, alignItems: 'center' },
    segOn: { backgroundColor: c.accent },
    segText: { color: c.text, fontSize: 15, fontWeight: '700' },
    segTextOn: { color: c.accentText },
    note: { color: c.faint, fontSize: 12, padding: 14, paddingTop: 8 },
    help: { color: c.dim, fontSize: 14, lineHeight: 20 },
    version: { color: c.faint, fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 },
  });
