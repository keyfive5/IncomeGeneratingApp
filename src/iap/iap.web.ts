// The browser build has no App Store. It exists for development and for the
// store screenshots, where ?pro=1 shows the unlocked app.
import type { ProProduct, Purchaser } from './product.ts';

export class CancelledError extends Error {}

const proInUrl = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('pro') === '1';

export const purchaser: Purchaser = {
  async init(onPro) {
    if (proInUrl()) onPro(true);
  },
  async product(): Promise<ProProduct | null> {
    return { price: '$19.99', title: 'Kerf Pro' };
  },
  async buy() {
    throw new Error('Purchases are only available in the iPhone app.');
  },
  async restore() {
    return proInUrl();
  },
};
