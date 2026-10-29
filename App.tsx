import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { purchaser } from './src/iap/iap';
import { loadState, setState, useStore } from './src/state/store.ts';
import { Calculator } from './src/ui/Calculator.tsx';
import { Icon, type IconName } from './src/ui/Icon.tsx';
import { Paywall } from './src/ui/Paywall.tsx';
import { PaywallContext } from './src/ui/pro.ts';
import { Settings } from './src/ui/Settings.tsx';
import { usePalette } from './src/ui/theme.ts';
import { Tools } from './src/ui/Tools.tsx';

type Tab = 'calc' | 'tools' | 'settings';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'calc', label: 'Calculator', icon: 'calc' },
  { id: 'tools', label: 'Tools', icon: 'tools' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

/** Deep links for the store screenshots in the browser build: ?tab=tools&tool=stairs */
function initialRoute(): { tab: Tab; tool: string | null } {
  if (Platform.OS !== 'web' || typeof location === 'undefined') return { tab: 'calc', tool: null };
  const q = new URLSearchParams(location.search);
  return { tab: (q.get('tab') as Tab) || 'calc', tool: q.get('tool') };
}

export default function App() {
  const c = usePalette();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>(() => initialRoute().tab);
  const [tool, setTool] = useState<string | null>(() => initialRoute().tool);
  const [paywall, setPaywall] = useState<{ open: boolean; reason?: string }>({ open: false });
  const keepAwake = useStore((s) => s.keepAwake);

  useEffect(() => {
    loadState().then(() => {
      setReady(true);
      purchaser.init((owned) => owned && setState({ pro: true })).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (keepAwake) activateKeepAwakeAsync('kerf').catch(() => {});
    else deactivateKeepAwake('kerf').catch(() => {});
  }, [keepAwake]);

  const openPaywall = useCallback((reason?: string) => setPaywall({ open: true, reason }), []);
  const ctx = useMemo(() => ({ openPaywall }), [openPaywall]);

  return (
    <SafeAreaProvider>
      <PaywallContext.Provider value={ctx}>
        <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
          <StatusBar style="auto" />
          <View style={styles.body}>
            {!ready ? null : tab === 'calc' ? (
              <Calculator />
            ) : tab === 'tools' ? (
              <Tools open={tool} onOpen={setTool} />
            ) : (
              <Settings />
            )}
          </View>
          <SafeAreaView edges={['bottom']} style={[styles.tabBar, { backgroundColor: c.surface, borderTopColor: c.line }]}>
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  testID={`tab-${t.id}`}
                  style={styles.tab}
                  onPress={() => {
                    if (t.id === 'tools' && tab === 'tools') setTool(null);
                    setTab(t.id);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Icon name={t.icon} color={on ? c.accent : c.faint} />
                  <Text style={[styles.tabLabel, { color: on ? c.accent : c.faint }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </SafeAreaView>
          <Paywall visible={paywall.open} reason={paywall.reason} onClose={() => setPaywall({ open: false })} />
        </SafeAreaView>
      </PaywallContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingBottom: 4 },
  tabLabel: { fontSize: 11, fontWeight: '600' },
});
