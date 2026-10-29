import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import type { Diagram as D } from '../core/solvers.ts';
import type { Palette } from './theme.ts';

const W = 340;
const H = 200;

/** Scaled drawings of what a solver just worked out, labelled with its numbers. */
export function Diagram({ d, c }: { d: D; c: Palette }) {
  const label = (x: number, y: number, t: string, anchor: 'start' | 'middle' | 'end' = 'middle', color = c.text) => (
    <SvgText x={x} y={y} fill={color} fontSize={12} fontWeight="600" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif" textAnchor={anchor}>
      {t}
    </SvgText>
  );

  if (d.kind === 'stairs') {
    const n = Math.min(d.risers, 18);
    const totalW = (n - 1) * d.tread + d.tread;
    const totalH = n * d.riser;
    const k = Math.min((W - 80) / totalW, (H - 50) / totalH);
    const x0 = 40;
    const y0 = H - 24;
    let p = `M${x0},${y0}`;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * d.tread * k;
      const y = y0 - (i + 1) * d.riser * k;
      p += ` L${x},${y} L${x + d.tread * k},${y}`;
    }
    const topX = x0 + n * d.tread * k;
    return (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={`${p} L${topX},${y0} Z`} fill={c.surface2} stroke={c.accent} strokeWidth={2} strokeLinejoin="round" />
        <Line x1={x0} y1={y0} x2={x0 + (n - 1) * d.tread * k} y2={y0 - n * d.riser * k} stroke={c.dim} strokeWidth={1} strokeDasharray="4 4" />
        {label(16, 22, `Riser ${d.riserLabel}`, 'start', c.accent)}
        {label(16, 40, `Tread ${d.treadLabel}`, 'start', c.accent)}
        {label((x0 + topX) / 2, y0 + 16, `Run ${d.totalRun}`)}
        {label(topX + 4, y0 - totalH * k * 0.5, `Rise`, 'start', c.dim)}
        {label(topX + 4, y0 - totalH * k * 0.5 + 14, d.totalRise, 'start')}
      </Svg>
    );
  }

  if (d.kind === 'rafter') {
    const span = d.run + d.overhang;
    const k = Math.min((W - 90) / span, (H - 60) / Math.max(d.rise, 1));
    const ridgeX = W - 50;
    const wallX = ridgeX - d.run * k;
    const baseY = H - 40;
    const peakY = baseY - d.rise * k;
    const tailX = wallX - d.overhang * k;
    const tailY = baseY + d.overhang * k * (d.pitch / 12);
    return (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={wallX} y1={baseY} x2={ridgeX} y2={baseY} stroke={c.dim} strokeDasharray="4 4" />
        <Line x1={ridgeX} y1={baseY} x2={ridgeX} y2={peakY} stroke={c.dim} strokeDasharray="4 4" />
        <Rect x={wallX - 6} y={baseY} width={12} height={34} fill={c.surface2} stroke={c.line} />
        <Rect x={ridgeX} y={peakY - 4} width={8} height={30} fill={c.surface2} stroke={c.line} />
        <Line x1={tailX} y1={tailY} x2={ridgeX} y2={peakY} stroke={c.accent} strokeWidth={5} strokeLinecap="round" />
        {label((wallX + ridgeX) / 2 - 8, (baseY + peakY) / 2 - 10, d.lengthLabel, 'end', c.accent)}
        {label((wallX + ridgeX) / 2, baseY + 16, `Run ${d.runLabel}`)}
        {label(ridgeX - 6, (baseY + peakY) / 2 + 4, `Rise ${d.riseLabel}`, 'end', c.dim)}
        {label(wallX + 46, baseY - 8, `${d.pitch}/12`, 'start', c.dim)}
      </Svg>
    );
  }

  if (d.kind === 'triangle') {
    const k = Math.min((W - 120) / d.run, (H - 50) / d.rise);
    const x0 = 60;
    const y0 = H - 28;
    const x1 = x0 + d.run * k;
    const y1 = y0 - d.rise * k;
    return (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polygon points={`${x0},${y0} ${x1},${y0} ${x0},${y1}`} fill={c.surface2} stroke={c.accent} strokeWidth={2} strokeLinejoin="round" />
        <Path d={`M${x0 + 12},${y0} L${x0 + 12},${y0 - 12} L${x0},${y0 - 12}`} stroke={c.dim} fill="none" />
        {label((x0 + x1) / 2, y0 + 16, d.runLabel)}
        {label(x0 - 6, (y0 + y1) / 2, d.riseLabel, 'end')}
        {label((x0 + x1) / 2 + 10, (y0 + y1) / 2 - 6, d.diagLabel, 'start', c.accent)}
        {label(x1 - 34, y0 - 8, d.angle, 'middle', c.dim)}
      </Svg>
    );
  }

  if (d.kind === 'layout') {
    const k = (W - 30) / d.length;
    const x0 = 15;
    const y0 = 50;
    const h = 110;
    const shown = d.members.length > 80 ? [] : d.members;
    return (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={x0} y={y0 - 8} width={d.length * k} height={8} fill={c.surface2} stroke={c.line} />
        <Rect x={x0} y={y0 + h} width={d.length * k} height={8} fill={c.surface2} stroke={c.line} />
        {shown.map((m, i) => (
          <Rect key={i} x={x0 + m * k} y={y0} width={Math.max(2, d.width * k)} height={h} fill={c.accent} opacity={0.9} />
        ))}
        {label(W / 2, 30, d.label)}
      </Svg>
    );
  }

  if (d.kind === 'arc') {
    const k = Math.min((W - 60) / d.chord, (H - 60) / d.rise);
    const half = (d.chord * k) / 2;
    const cx = W / 2;
    const baseY = H - 36;
    const r = ((d.chord * d.chord) / (8 * d.rise) + d.rise / 2) * k;
    return (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={`M${cx - half},${baseY} A${r},${r} 0 0 1 ${cx + half},${baseY}`} stroke={c.accent} strokeWidth={4} fill="none" />
        <Line x1={cx - half} y1={baseY} x2={cx + half} y2={baseY} stroke={c.dim} strokeDasharray="4 4" />
        <Line x1={cx} y1={baseY} x2={cx} y2={baseY - d.rise * k} stroke={c.dim} strokeDasharray="4 4" />
        {label(cx, baseY + 18, d.chordLabel)}
        {label(cx + 6, baseY - (d.rise * k) / 2, d.riseLabel, 'start', c.dim)}
        {label(cx, baseY - d.rise * k - 10, `R ${d.radiusLabel}`, 'middle', c.accent)}
      </Svg>
    );
  }

  // miter: the saw table seen from above, blade swung to the miter angle
  const cx = W / 2;
  const cy = H - 30;
  const a = (d.miter * Math.PI) / 180;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={`M${cx - 130},${cy} A130,130 0 0 1 ${cx + 130},${cy}`} stroke={c.line} strokeWidth={2} fill="none" />
      <Line x1={cx} y1={cy} x2={cx} y2={cy - 140} stroke={c.dim} strokeDasharray="4 4" />
      <G>
        <Line x1={cx} y1={cy} x2={cx + 150 * Math.sin(a)} y2={cy - 150 * Math.cos(a)} stroke={c.accent} strokeWidth={4} strokeLinecap="round" />
        <Circle cx={cx} cy={cy} r={6} fill={c.accent} />
      </G>
      {label(cx + 150 * Math.sin(a) + 10, cy - 150 * Math.cos(a) + 4, `${d.miter.toFixed(2)}°`, 'start', c.accent)}
      {d.bevel != null && label(cx, 22, `Bevel ${d.bevel.toFixed(2)}°`, 'middle', c.text)}
    </Svg>
  );
}
