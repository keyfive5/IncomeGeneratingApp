# Shipping Kerf to the App Store

Same pipeline as Overload (`D:/StrongAlternative/SHIP.md`), which records the
gotchas in detail. Credentials live in `credentials/` and `.expotoken`, both
gitignored: the App Store Connect API key is copied from Overload, and the
app signs with Overload's existing distribution certificate so no new
certificate is minted and nothing else gets revoked.

## Blockers that only the Account Holder can clear

1. **Program License Agreement.** Until the latest PLA is accepted at
   developer.apple.com/account, every API call 403s with
   `FORBIDDEN_ERROR.PLA_NOT_ACCEPTED`, including registering the bundle id.
2. **Paid Apps Agreement.** App Store Connect → Business: Edit Legal Entity,
   sign the Paid Apps Agreement, add bank account and tax forms. Without it
   StoreKit returns no products, the purchase sheet cannot load a price, and
   App Review rejects the app.
3. **Small Business Program** (after 2): 15% commission instead of 30%.

## Steps

```bash
node scripts/gen-ios-creds.mjs
```

Registers `com.hasanzafar.kerf` and makes the App Store profile.

```bash
npx eas-cli@latest build --platform ios --profile production --non-interactive
```

Needs `EXPO_TOKEN` from `.expotoken`. EAS project
`7ba60f88-2c27-464a-b817-455f3ef0df36`.

**Create the app record in the web UI** (the API cannot): Apps → + → New App,
iOS, name from `store/metadata.mjs`, English (U.S.), bundle id
`com.hasanzafar.kerf`, SKU `KERF2026`, Full Access. Write the id to
`.ascappid` and into `eas.json` `submit.production.ios.ascAppId`.

```bash
node scripts/check-metadata.mjs && node scripts/asc-metadata.mjs
```

```bash
node scripts/asc-iap.mjs
```

Creates the $19.99 non-consumable `com.hasanzafar.kerf.pro` with price,
availability and review screenshot.

```bash
node scripts/asc-availability.mjs
```

```bash
node scripts/asc-exclude-eu.mjs
```

The account has no DSA trader declaration, so the 27 EU storefronts are
switched off for the app and the in-app purchase (148 storefronts remain).
Declaring as a trader would publish a home address on EU product pages.

```bash
npm run screenshots && node scripts/asc-screenshots.mjs
```

App Privacy (web UI only): "No, we do not collect data from this app" → Save →
**Publish**.

```bash
npx eas-cli@latest submit --platform ios --profile production --non-interactive
```

```bash
node scripts/asc-submit.mjs
```

The first in-app purchase has to go to review with a version. If the API will
not attach it, add it on the version page under In-App Purchases and
Subscriptions before submitting.
