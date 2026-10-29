import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';
import { getState, setState } from '../state/store.ts';

// Ask for a rating once, after someone has clearly found the app useful:
// ten answers on the calculator or a tool. iOS decides whether to show it.
export function maybeAskForReview() {
  const s = getState();
  if (s.reviewAsked || s.equalsCount < 10 || Platform.OS === 'web') return;
  setState({ reviewAsked: true });
  setTimeout(() => {
    StoreReview.isAvailableAsync()
      .then((ok) => (ok ? StoreReview.requestReview() : undefined))
      .catch(() => {});
  }, 1200);
}

export function countUse() {
  setState((s) => ({ equalsCount: s.equalsCount + 1 }));
  maybeAskForReview();
}
