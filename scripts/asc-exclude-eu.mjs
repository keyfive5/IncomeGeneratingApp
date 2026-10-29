// Takes the app and its in-app purchase off sale in the EU.
//
// Without a Digital Services Act trader declaration Apple will not sell in EU
// storefronts, and marks each one TRADER_STATUS_NOT_PROVIDED. Kerf works in
// feet and inches, so its buyers are mostly in North America; rather than
// publish a home address on EU product pages, the account declared "not a
// trader / not distributing in the EU" and the EU storefronts are switched off
// here. Apple's own flag picks the territories; the 27 member states are a
// cross-check.
//
// Usage: node scripts/asc-exclude-eu.mjs
import { api, appId } from './asc-lib.mjs';
import * as M from '../store/metadata.mjs';

const APP = appId();
const EU = new Set([
  'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL',
  'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE',
]);

async function all(url) {
  const out = [];
  while (url) {
    const page = await api('GET', url);
    out.push(...page.data);
    url = page.links?.next ?? null;
  }
  return out;
}

async function app() {
  const rows = await all(`/v2/appAvailabilities/${APP}/territoryAvailabilities?include=territory&limit=200`);
  const flagged = rows.filter((r) => r.attributes.contentStatuses?.includes('TRADER_STATUS_NOT_PROVIDED'));
  const ids = new Set(flagged.map((r) => r.relationships.territory.data.id));
  const extra = [...ids].filter((t) => !EU.has(t));
  const missing = [...EU].filter((t) => !ids.has(t));
  if (extra.length) console.log('  note: Apple also flags', extra.join(' '));
  if (missing.length) console.log('  note: not flagged by Apple, excluded anyway:', missing.join(' '));
  const off = rows.filter((r) => EU.has(r.relationships.territory.data.id) || ids.has(r.relationships.territory.data.id));
  let changed = 0;
  for (const r of off) {
    if (!r.attributes.available) continue;
    await api('PATCH', `/v1/territoryAvailabilities/${r.id}`, {
      data: { type: 'territoryAvailabilities', id: r.id, attributes: { available: false } },
    });
    changed++;
  }
  const exclude = new Set(off.map((r) => r.relationships.territory.data.id));
  console.log(`• app: ${changed} EU storefronts switched off, on sale in ${rows.length - exclude.size}`);
  return exclude;
}

async function iap(exclude) {
  const list = await api('GET', `/v1/apps/${APP}/inAppPurchasesV2?limit=50`);
  const product = list.data.find((p) => p.attributes.productId === M.IAP.productId);
  if (!product) throw new Error('in-app purchase missing');
  const territories = (await all('/v1/territories?limit=200')).map((t) => t.id).filter((t) => !exclude.has(t));
  await api('POST', '/v1/inAppPurchaseAvailabilities', {
    data: {
      type: 'inAppPurchaseAvailabilities',
      attributes: { availableInNewTerritories: false },
      relationships: {
        inAppPurchase: { data: { type: 'inAppPurchases', id: product.id } },
        availableTerritories: { data: territories.map((id) => ({ type: 'territories', id })) },
      },
    },
  });
  const after = await api('GET', `/v2/inAppPurchases/${product.id}/inAppPurchaseAvailability`);
  const n = (await all(`/v1/inAppPurchaseAvailabilities/${after.data.id}/availableTerritories?limit=200`)).length;
  console.log(`• in-app purchase: available in ${n} territories`);
}

const exclude = await app();
await iap(exclude);
