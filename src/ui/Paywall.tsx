import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SOLVERS } from '../core/solvers.ts';
import { CancelledError, purchaser } from '../iap/iap';
import type { ProProduct } from '../iap/product.ts';
import { useStore } from '../state/store.ts';
import { Icon } from './Icon.tsx';
import { PRIVACY_URL, TERMS_URL } from './pro.ts';
import { usePalette, type Palette } from './theme.ts';

export function Paywall({ visible, reason, onClose }: { visible: boolean; reason?: string; onClose: () => void }) {
  const c = usePalette();
  const s = useMemo(() => styles(c), [c]);
  const pro = useStore((st) => st.pro);
  const [product, setProduct] = useState<ProProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const p = await purchaser.product();
      setProduct(p);
      if (!p) setMessage("The App Store didn't return the Pro unlock. Check your connection and try again.");
    } catch {
      setMessage("Couldn't reach the App Store. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible && !product) load();
    if (visible) setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (pro && visible) {
      const t = setTimeout(onClose, 900);
      return () => clearTimeout(t);
    }
  }, [pro, visible, onClose]);

  async function buy() {
    setBusy('buy');
    setMessage(null);
    try {
      await purchaser.buy();
    } catch (e) {
      if (!(e instanceof CancelledError)) setMessage(e instanceof Error ? e.message : 'The purchase did not go through.');
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    setMessage(null);
    try {
      const found = await purchaser.restore();
      if (!found) setMessage('No previous Pro purchase was found for this Apple Account.');
    } catch {
      setMessage("Couldn't reach the App Store to restore. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  }

  const proTools = SOLVERS.filter((x) => x.pro);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root} testID="paywall">
        <Pressable onPress={onClose} hitSlop={14} style={s.close} accessibilityLabel="Close">
          <Icon name="close" color={c.dim} />
        </Pressable>
        <ScrollView contentContainerStyle={s.pad}>
          <View style={s.badge}>
            <Icon name="tape" size={34} color={c.tapeInk} strokeWidth={2} />
          </View>
          <Text style={s.title}>{pro ? 'Pro is unlocked' : 'Kerf Pro'}</Text>
          <Text style={s.sub}>{reason ? `${reason} and every other jobsite tool.` : 'Every jobsite tool.'} One payment, yours for good.</Text>

          <View style={s.list}>
            {proTools.map((t) => (
              <View key={t.id} style={s.item}>
                <Icon name="check" size={18} color={c.accent} strokeWidth={2.4} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{t.title}</Text>
                  <Text style={s.itemText}>{t.blurb}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.promise}>
            <Text style={s.promiseText}>No subscription · No ads · No account · Works offline</Text>
          </View>
        </ScrollView>

        <View style={s.footer}>
          {message && <Text style={s.message}>{message}</Text>}
          {pro ? (
            <View style={[s.buy, { backgroundColor: c.good }]}>
              <Text style={s.buyText}>Thank you — everything is unlocked</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [s.buy, (pressed || busy) && { opacity: 0.7 }]}
              disabled={!!busy || loading || !product}
              onPress={product ? buy : load}
            >
              {busy === 'buy' || loading ? (
                <ActivityIndicator color={c.accentText} />
              ) : (
                <Text style={s.buyText}>{product ? `Unlock Pro · ${product.price}` : 'Try again'}</Text>
              )}
            </Pressable>
          )}
          {!pro && (
            <Text style={s.fine}>A single one-time purchase. Not a subscription — you are never charged again.</Text>
          )}
          <View style={s.links}>
            {!pro && (
              <Pressable onPress={restore} disabled={!!busy} hitSlop={8}>
                <Text style={s.link}>{busy === 'restore' ? 'Restoring…' : 'Restore Purchase'}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8}>
              <Text style={s.link}>Terms of Use</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}>
              <Text style={s.link}>Privacy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    close: { position: 'absolute', top: 16, right: 16, zIndex: 2 },
    pad: { padding: 24, paddingTop: 36 },
    badge: { width: 64, height: 64, borderRadius: 16, backgroundColor: c.tape, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
    title: { color: c.text, fontSize: 30, fontWeight: '800', textAlign: 'center', marginTop: 14 },
    sub: { color: c.dim, fontSize: 16, textAlign: 'center', marginTop: 6, lineHeight: 22 },
    list: { marginTop: 22, gap: 12 },
    item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    itemTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    itemText: { color: c.dim, fontSize: 13, marginTop: 1 },
    promise: { marginTop: 22, padding: 12, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center' },
    promiseText: { color: c.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    footer: { padding: 20, paddingBottom: 30, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, gap: 10 },
    message: { color: c.bad, fontSize: 14, textAlign: 'center' },
    buy: { backgroundColor: c.accent, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center' },
    buyText: { color: c.accentText, fontSize: 18, fontWeight: '800' },
    fine: { color: c.faint, fontSize: 12, textAlign: 'center' },
    links: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
    link: { color: c.dim, fontSize: 13, textDecorationLine: 'underline' },
  });
