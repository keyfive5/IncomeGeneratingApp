// App state: settings, the calculator tape, last-used solver inputs and the
// Pro flag. One observable object, persisted to AsyncStorage on every change
// (debounced). Components subscribe with useStore().

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { Precision } from '../core/format.ts';
import type { Values } from '../core/solvers.ts';

export interface TapeLine {
  expr: string;
  result: string;
  at: number;
}

export interface State {
  precision: Precision;
  keepAwake: boolean;
  haptics: boolean;
  pro: boolean;
  tape: TapeLine[];
  inputs: Record<string, Values>;
  equalsCount: number;
  reviewAsked: boolean;
  hintSeen: boolean;
}

const KEY = 'kerf:v1';
const MAX_TAPE = 200;

let state: State = {
  precision: 16,
  keepAwake: true,
  haptics: true,
  pro: false,
  tape: [],
  inputs: {},
  equalsCount: 0,
  reviewAsked: false,
  hintSeen: false,
};
let loaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function emit() {
  for (const l of listeners) l();
  if (!loaded) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, 250);
}

export function getState() {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  emit();
}

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch {
    // a corrupt save starts fresh rather than crashing the calculator
  }
  loaded = true;
  emit();
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}

export function pushTape(line: Omit<TapeLine, 'at'>) {
  setState((s) => ({
    tape: [{ ...line, at: Date.now() }, ...s.tape].slice(0, MAX_TAPE),
    equalsCount: s.equalsCount + 1,
  }));
}

export function setInputs(solverId: string, values: Values) {
  setState((s) => ({ inputs: { ...s.inputs, [solverId]: values } }));
}
