# Kerf — Construction Calculator

An iPhone construction calculator that works in feet, inches and fractions the
way you read a tape, plus fifteen jobsite tools that turn measurements into
cuts. Free calculator; one-time **Kerf Pro** unlock ($19.99) for the Pro tools.
No account, no ads, no subscription.

## Why this app

Picked for revenue, from data rather than taste:

- **This account ranks for single-purpose utilities.** Weekly downloads over
  October 2026: Dice Roller ~27, Boxing Rounds ~25, Coin Flip ~24, while the
  feature-heavy apps (Sift, QR Forge, Currency Converter) get almost none. But
  dice and coin users don't pay.
- **Construction calculators combine search volume with buyers who earn money
  with the tool.** The leader has ~40k ratings; an indie feet-and-inches
  calculator has ~9k; a concrete calculator ~26k. The niche splits into many
  long-tail searches (stairs, rafter, concrete, stud, baluster, crown miter…).
- **The leader moved to $4.99/month or $39.99/year** and collects 1-star
  "Why $40/year?" reviews. A one-time unlock answers that directly.
- **4.3 spam risk.** Overload was rejected twice under 4.3(a) for being like
  other apps in a crowded category. Kerf is a real engine (dimension-aware
  tape arithmetic, solvers that output marks and saw settings), not a
  template.

## What's free and what's Pro

| Free (no limits) | Pro (one-time) |
|---|---|
| Feet-inch-fraction calculator, tape, all readings | Stairs, Rafters & roof pitch, Stud layout |
| Concrete (slabs, footings, columns, bags) | Balusters & equal spacing, Miter & crown |
| Right triangle & square check | Arch & circle, Board feet, Drywall |
| Slope & grade | Tile, Paint, Decking, Gravel/sand/mulch |

Pro tools open with a worked example and drawing; editing a field opens the
purchase sheet.

## Layout

- `src/core/` — pure TypeScript, no React: the expression parser
  (`expr.ts`), tape formatting (`format.ts`), keypad entry rules
  (`keypad.ts`) and every solver (`solvers.ts`). Runs under
  `node --experimental-strip-types`.
- `src/iap/` — StoreKit 2 via expo-iap (`iap.native.ts`), a browser stub for
  screenshots (`iap.web.ts`).
- `src/state/store.ts` — observable store persisted to AsyncStorage.
- `src/ui/` — calculator, tools, drawings, paywall, settings.
- `scripts/` — tests, assets, screenshots, App Store Connect automation. See
  `SHIP.md`.

## Tests

```bash
npm test
```

220 assertions: parsing and arithmetic of tape measurements, rounding and
"strong"/"scant", keypad entry sequences, and every solver against
hand-worked jobsite numbers (IRC stair limits, 38° and 45° crown angles, stud
marks at 15 1/4", baluster gaps, concrete bag yields).
