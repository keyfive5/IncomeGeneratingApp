// Creates the Kerf Pro non-consumable in App Store Connect and gets it to
// READY_TO_SUBMIT: product, en-US localization, a $19.99 USA base price
// (Apple equalizes every other storefront from it), availability everywhere,
// and the review screenshot App Review requires. Safe to re-run: each step
// checks what already exists.
//
// The first in-app purchase of an app can only be reviewed together with an
// app version, so this does not submit it; asc-submit.mjs does.
//
// Usage: node scripts/asc-iap.mjs
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { api, appId, ROOT, upload } from './asc-lib.mjs';
import * as M from '../store/metadata.mjs';

const APP = appId();
const SHOT = path.join(ROOT, 'store', 'iap-review.png');
const REVIEW_NOTE =
  'Non-consumable that unlocks the eleven Pro tools for good. Open Tools > Stairs and tap any field, or Settings > Unlock Kerf Pro. Restore Purchase is on the purchase sheet and in Settings.';

async function ensureProduct() {
  const list = await api('GET', `/v1/apps/${APP}/inAppPurchasesV2?limit=50`);
  const found = list.data.find((p) => p.attributes.productId === M.IAP.productId);
  if (found) {
    console.log(`• product exists: ${found.id} (${found.attributes.state})`);
    return found;
  }
  const created = await api('POST', '/v2/inAppPurchases', {
    data: {
      type: 'inAppPurchases',
      attributes: {
        name: M.IAP.referenceName,
        productId: M.IAP.productId,
        inAppPurchaseType: 'NON_CONSUMABLE',
        reviewNote: REVIEW_NOTE,
        familySharable: true,
      },
      relationships: { app: { data: { type: 'apps', id: APP } } },
    },
  });
  console.log('• product created:', created.data.id);
  return created.data;
}

async function ensureLocalization(iapId) {
  const locs = await api('GET', `/v2/inAppPurchases/${iapId}/inAppPurchaseLocalizations?limit=20`);
  const en = locs.data.find((l) => l.attributes.locale === 'en-US');
  const attributes = { name: M.IAP.displayName, description: M.IAP.description };
  if (en) {
    await api('PATCH', `/v1/inAppPurchaseLocalizations/${en.id}`, {
      data: { type: 'inAppPurchaseLocalizations', id: en.id, attributes },
    });
    console.log('• localization updated');
    return;
  }
  await api('POST', '/v1/inAppPurchaseLocalizations', {
    data: {
      type: 'inAppPurchaseLocalizations',
      attributes: { locale: 'en-US', ...attributes },
      relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iapId } } },
    },
  });
  console.log('• localization created');
}

async function ensurePrice(iapId) {
  const existing = await api('GET', `/v1/inAppPurchasePriceSchedules/${iapId}/manualPrices?limit=5`).catch(() => null);
  if (existing?.data?.length) {
    console.log('• price already set');
    return;
  }
  let point;
  let url = `/v2/inAppPurchases/${iapId}/pricePoints?filter[territory]=USA&limit=200`;
  while (url && !point) {
    const page = await api('GET', url);
    point = page.data.find((p) => p.attributes.customerPrice === M.IAP.usdPrice);
    url = page.links?.next ?? null;
  }
  if (!point) throw new Error(`no USA price point at $${M.IAP.usdPrice}`);
  await api('POST', '/v1/inAppPurchasePriceSchedules', {
    data: {
      type: 'inAppPurchasePriceSchedules',
      relationships: {
        inAppPurchase: { data: { type: 'inAppPurchases', id: iapId } },
        baseTerritory: { data: { type: 'territories', id: 'USA' } },
        manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${usa}' }] },
      },
    },
    included: [
      {
        type: 'inAppPurchasePrices',
        id: '${usa}',
        attributes: { startDate: null },
        relationships: {
          inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iapId } },
          inAppPurchasePricePoint: { data: { type: 'inAppPurchasePricePoints', id: point.id } },
        },
      },
    ],
  });
  console.log(`• price set: $${M.IAP.usdPrice} USA base, other storefronts equalized`);
}

async function ensureAvailability(iapId) {
  const existing = await api('GET', `/v2/inAppPurchases/${iapId}/inAppPurchaseAvailability`).catch(() => null);
  if (existing?.data) {
    console.log('• availability already set');
    return;
  }
  const territories = [];
  let url = '/v1/territories?limit=200';
  while (url) {
    const page = await api('GET', url);
    territories.push(...page.data.map((t) => t.id));
    url = page.links?.next ?? null;
  }
  await api('POST', '/v1/inAppPurchaseAvailabilities', {
    data: {
      type: 'inAppPurchaseAvailabilities',
      attributes: { availableInNewTerritories: true },
      relationships: {
        inAppPurchase: { data: { type: 'inAppPurchases', id: iapId } },
        availableTerritories: { data: territories.map((id) => ({ type: 'territories', id })) },
      },
    },
  });
  console.log(`• available in ${territories.length} territories`);
}

async function ensureReviewScreenshot(iapId) {
  const existing = await api('GET', `/v2/inAppPurchases/${iapId}/appStoreReviewScreenshot`).catch(() => null);
  if (existing?.data?.attributes?.assetDeliveryState?.state === 'COMPLETE') {
    console.log('• review screenshot already uploaded');
    return;
  }
  if (existing?.data?.id) await api('DELETE', `/v1/inAppPurchaseAppStoreReviewScreenshots/${existing.data.id}`).catch(() => {});
  const buf = fs.readFileSync(SHOT);
  const reserved = await api('POST', '/v1/inAppPurchaseAppStoreReviewScreenshots', {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      attributes: { fileName: path.basename(SHOT), fileSize: buf.length },
      relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iapId } } },
    },
  });
  for (const op of reserved.data.attributes.uploadOperations) {
    await upload(op, buf.subarray(op.offset, op.offset + op.length));
  }
  await api('PATCH', `/v1/inAppPurchaseAppStoreReviewScreenshots/${reserved.data.id}`, {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      id: reserved.data.id,
      attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(buf).digest('hex') },
    },
  });
  console.log('• review screenshot uploaded');
}

(async () => {
  console.log(`App ${APP}`);
  const product = await ensureProduct();
  await ensureLocalization(product.id);
  await ensurePrice(product.id);
  await ensureAvailability(product.id);
  await ensureReviewScreenshot(product.id);
  const after = await api('GET', `/v2/inAppPurchases/${product.id}`);
  console.log(`\n✓ ${M.IAP.productId}: ${after.data.attributes.state}`);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
