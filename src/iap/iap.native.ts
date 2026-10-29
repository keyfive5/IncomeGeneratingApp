// StoreKit 2 through expo-iap. Ownership is checked on device from the
// App Store's signed entitlements, so there is no server.
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Purchase,
} from 'expo-iap';
import { PRO_SKU, type ProProduct, type Purchaser } from './product.ts';

export class CancelledError extends Error {}

let started: Promise<void> | null = null;
let notify: (owned: boolean) => void = () => {};
let pending: { resolve: () => void; reject: (e: Error) => void } | null = null;

async function handle(p: Purchase) {
  if (p.productId !== PRO_SKU) return;
  if (p.purchaseState === 'pending') return; // Ask to Buy: wait for approval
  try {
    await finishTransaction({ purchase: p, isConsumable: false });
  } catch {
    // unlocking matters more than tidying the queue; StoreKit replays it
  }
  notify(true);
  pending?.resolve();
  pending = null;
}

async function owned(): Promise<boolean> {
  const list = await getAvailablePurchases();
  return list.some((p) => p.productId === PRO_SKU);
}

export const purchaser: Purchaser = {
  init(onPro) {
    notify = onPro;
    if (!started) {
      started = (async () => {
        await initConnection();
        purchaseUpdatedListener((p) => void handle(p));
        purchaseErrorListener((e) => {
          if (!pending) return;
          pending.reject(isUserCancelledError(e) ? new CancelledError() : new Error(e.message || 'The purchase did not go through'));
          pending = null;
        });
        if (await owned()) notify(true);
      })().catch((e) => {
        started = null;
        throw e;
      });
    }
    return started;
  },

  async product(): Promise<ProProduct | null> {
    await started;
    const list = await fetchProducts({ skus: [PRO_SKU], type: 'in-app' });
    const p = (list ?? []).find((x) => x.id === PRO_SKU);
    return p ? { price: p.displayPrice, title: p.title } : null;
  },

  buy() {
    return new Promise<void>((resolve, reject) => {
      pending = { resolve, reject };
      requestPurchase({ request: { apple: { sku: PRO_SKU } }, type: 'in-app' }).catch((e: unknown) => {
        if (!pending) return;
        pending = null;
        reject(isUserCancelledError(e) ? new CancelledError() : new Error(e instanceof Error ? e.message : 'The purchase did not go through'));
      });
    });
  },

  async restore() {
    await started;
    await restorePurchases();
    const found = await owned();
    if (found) notify(true);
    return found;
  },
};
