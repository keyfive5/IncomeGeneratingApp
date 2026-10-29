// The one product: a non-consumable that unlocks every Pro tool for good.
export const PRO_SKU = 'com.hasanzafar.kerf.pro';

export interface ProProduct {
  price: string;
  title: string;
}

export interface Purchaser {
  /** Connects to the store and re-checks ownership. Safe to call twice. */
  init(onPro: (owned: boolean) => void): Promise<void>;
  product(): Promise<ProProduct | null>;
  /** Resolves when the purchase completes; rejects with a readable message. */
  buy(): Promise<void>;
  /** Resolves true if a previous purchase was found. */
  restore(): Promise<boolean>;
}
