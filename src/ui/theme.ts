import { useColorScheme } from 'react-native';

// Jobsite palette: high contrast for daylight, tape-blade yellow for the
// answer, safety orange for actions.
const dark = {
  bg: '#0F1113',
  surface: '#1A1D21',
  surface2: '#24282D',
  line: '#30353B',
  text: '#F4F2EE',
  dim: '#9BA1A8',
  faint: '#646A71',
  accent: '#FF7A1A',
  accentText: '#1A0E04',
  tape: '#FFCB2E',
  tapeInk: '#17140A',
  good: '#4ADE80',
  warn: '#FBBF24',
  bad: '#F87171',
  key: '#22262B',
  keyOp: '#2E333A',
  keyUnit: '#3A2A1C',
};

const light: typeof dark = {
  bg: '#F3F1EC',
  surface: '#FFFFFF',
  surface2: '#ECE9E2',
  line: '#DAD6CD',
  text: '#16181B',
  dim: '#5F6670',
  faint: '#9AA0A7',
  accent: '#E8620A',
  accentText: '#FFFFFF',
  tape: '#FFC820',
  tapeInk: '#17140A',
  good: '#15803D',
  warn: '#B45309',
  bad: '#DC2626',
  key: '#FFFFFF',
  keyOp: '#E4E1DA',
  keyUnit: '#FBE3CF',
};

export type Palette = typeof dark;

export function usePalette(): Palette {
  return useColorScheme() === 'light' ? light : dark;
}

export const NUM = { fontVariant: ['tabular-nums' as const] };
