// App Store listing copy. Pushed by scripts/asc-metadata.mjs.
//
// Guideline 2.3.7 rejects price references outside the description, so the
// name, subtitle, promotional text and keywords say nothing about cost. Other
// apps are not named anywhere in the listing.
//
// Keywords already in the name or subtitle are not repeated: Apple indexes
// all three together, so repeats waste the 100-character budget.

export const NAME = 'Kerf: Construction Calculator';
export const SUBTITLE = 'Feet Inch Fraction & Stairs';

export const PROMOTIONAL_TEXT =
  'Feet, inches and fractions done the way you read a tape, plus stairs, rafters, stud layout marks, baluster spacing and crown molding angles. Built for the jobsite.';

export const KEYWORDS =
  'carpenter,framing,rafter,roof,pitch,concrete,stud,baluster,tape,drywall,crown,miter,deck,contractor';

export const DESCRIPTION = `Kerf is a construction calculator that works in feet, inches and fractions the way you read them off a tape measure — and the jobsite tools that turn those numbers into cuts.

TAPE-MEASURE MATH

Punch in 5 ft 7 in 3⁄8 + 2 ft 11 in 5⁄16 and get 8' 6 11/16". Multiply two lengths and you get square feet; multiply by a thickness and you get cubic yards. Divide a length by a length to see how many fit.

• Every answer in every format at once: feet-inch-fraction, inches, decimal feet, yards, millimeters and meters. Tap any one to copy it.
• Round to 1/8, 1/16, 1/32 or 1/64. A result a hair over the mark reads "strong", a hair under reads "scant".
• Metric in and out: mix 1200mm with 4' 2" in the same sum.
• A paper tape of every calculation. Tap a line to use it again.
• The screen stays on while you work, so it's awake when you come back from the saw.

TOOLS THAT GIVE YOU THE CUT, NOT JUST A NUMBER

Every field takes measurements as you would write them — 9' 1 1/4", 10 1/4", 1200mm — and even arithmetic like 8' - 1 1/2".

• Stairs — risers, riser height, treads, total run, stringer length, angle, framing square settings and the bottom riser drop for tread thickness, with IRC code and comfort checks.
• Rafters & roof pitch — common rafter length with ridge and overhang, plumb and seat cut angles, hip and valley length, roof area and squares.
• Stud layout — every on-center mark to pull from the end of the plate at 12", 16", 19.2" or 24", and the stud count.
• Balusters & equal spacing — how many, the exact gap, and each mark from the post, checked against the 4" sphere rule.
• Miter & crown molding — miter and bevel for crown laid flat at any spring angle and any wall corner, plus flat trim and polygon frames.
• Arch & circle — radius from the width and height of an arch, arc length and where to put the center.
• Concrete — cubic yards for slabs, footings and round columns, with 80, 60 and 40 lb bag counts.
• Gravel, sand, topsoil & mulch — yards, tons and bags.
• Board feet & lumber — board feet, linear feet and cost.
• Drywall — sheets, screws, compound and tape.
• Tile & flooring — tiles and boxes with waste.
• Paint — gallons and quarts for any number of coats.
• Decking — boards, joists and screws.
• Right triangle & square — any two sides give the third, and a diagonal check tells you how far out of square a corner is.
• Slope & grade — percent, degrees, pitch and inches per foot for drains and grading.

Drawings show each answer to scale with its measurements, and any result can be shared as text to a client, a crew or yourself.

KERF PRO — ONE PURCHASE, NO SUBSCRIPTION

The calculator, concrete, right triangle and slope tools are free to use with no limits. Every other tool opens with a worked example so you can see exactly what it does. Kerf Pro unlocks all of them with a single one-time purchase. It is not a subscription, and you are never charged again.

PRIVATE

No account. No ads. No tracking. Everything stays on your phone and works offline.

Always check critical cuts against your plans and local building code.`;

export const WHATS_NEW = '';

export const SUPPORT_URL = 'https://github.com/keyfive5/IncomeGeneratingApp';
export const MARKETING_URL = 'https://github.com/keyfive5/IncomeGeneratingApp';
export const PRIVACY_URL = 'https://github.com/keyfive5/IncomeGeneratingApp/blob/main/PRIVACY.md';
export const COPYRIGHT = '2026 Muhammad Hasan Zafar';

export const PRIMARY_CATEGORY = 'UTILITIES';
export const SECONDARY_CATEGORY = 'PRODUCTIVITY';

// In-app purchase listing (shown on the App Store page and the payment sheet).
export const IAP = {
  productId: 'com.hasanzafar.kerf.pro',
  referenceName: 'Kerf Pro Lifetime',
  displayName: 'Kerf Pro',
  description: 'Unlock every jobsite tool, for good',
  usdPrice: '19.99',
};

export const SHOT_CAPTIONS = [
  ['Feet, inches', '& fractions'],
  ['Stairs, with', 'a code check'],
  ['Every stud mark,', 'measured'],
  ['Rafters &', 'roof pitch'],
  ['Crown molding,', 'solved'],
  ['Balusters,', 'evenly spaced'],
];
