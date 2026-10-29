// Keypad entry: key sequences build expressions the parser reads correctly.
import { describe, eq, report } from './harness.mjs';
import { applyKey } from '../src/core/keypad.ts';
import { evaluate, prettyExpr } from '../src/core/expr.ts';
import { formatFtIn } from '../src/core/format.ts';

const keys = (seq) => seq.split(' ').reduce((e, k) => applyKey(e, k), '');
const value = (seq) => evaluate(keys(seq)).v;

describe('feet-inch-fraction entry', () => {
  eq(keys('5 ft 7 in 3 frac 8'), `5' 7" 3/8`, 'keyed form');
  eq(prettyExpr(keys('5 ft 7 in 3 frac 8')), `5' 7 3/8"`, 'shown as on a tape');
  eq(value('5 ft 7 in 3 frac 8'), 67.375, 'reads as 5\' 7 3/8"');
  eq(value('3 frac 8 in'), 0.375, 'fraction then inch');
  eq(value('7 in 3 frac 8 + 1 in 5 frac 8'), 9, '7 3/8 + 1 5/8');
  eq(
    formatFtIn(value('5 ft 7 in 3 frac 8 + 2 ft 1 1 in 5 frac 1 6')),
    `8' 6 11/16"`,
    'the headline sum',
  );
  eq(keys('5 ft in'), `5"`, 'a second unit key swaps the first');
  eq(keys('1 2 0 0 mm'), '1200mm', 'metric');
  eq(keys('3 frac frac 8'), '3/8', 'double fraction bar ignored');
  eq(keys('3 frac 8 frac'), '3/8', 'no fraction of a fraction');
  eq(keys('ft'), '', 'unit needs a number');
});

describe('operators', () => {
  eq(keys('5 ft + ×'), `5' ×`, 'operator replaces operator');
  eq(keys('5 ft × -'), `5' × -`, 'minus after times is a sign');
  eq(value('5 ft × - 2'), -120, 'negative multiplier');
  eq(keys('- 3 in'), '-3"', 'leading negative');
  eq(keys('+'), '', 'cannot start with plus');
  eq(keys('1 . 5 .'), '1.5', 'one decimal point');
  eq(keys('.'), '0.', 'leading point');
  eq(value('( 2 + 3 ) × 4'), 20, 'parentheses');
  eq(keys('2 ( 3'), '2 × (3', 'implicit times before a bracket');
  eq(keys(') 2'), '2', 'unmatched close ignored');
});

describe('backspace', () => {
  eq(keys('5 ft 7 back'), `5'`, 'digit');
  eq(keys('5 ft back'), '5', 'unit mark');
  eq(keys('1 2 mm back'), '12', 'unit word removed whole');
  eq(keys('5 + back'), '5', 'operator and its space');
  eq(keys('back'), '', 'empty');
  eq(keys('5 clear'), '', 'clear');
});

report('keypad');
