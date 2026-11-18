// El emblema de una insignia: el aro cometa con luz (GlowRing) del color del nivel, lleno hasta el siguiente nivel,
// con su dibujo a línea dentro. Uno solo para la fila de «Insignias y rachas» (Plan) y para la insignia en grande
// (fundador, 2026-11-16: «los iconos de la insignia no son iguales que los que aparecen en el menú Plan… entras y
// cambian»): mismo dibujo, mismo color y mismas proporciones; solo cambia el tamaño. Los dibujos son los grabados de
// badgeIconPaths.ts (el fundador: los de antes «son muy de niño»), y la imagen que se comparte (BadgeShareCard) los
// pinta con el mismo BadgeGlyph y el mismo anillo (GlowRingArt).
import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { Achievement, TIER_COLORS } from '@/data/achievements';
import { GlowRing, ringTones } from '@/components/GlowRing';
import { FINE } from '@/theme/fine';
import { BADGE_EMBLEM_STROKE, badgeEmblemPath } from './badgeIconPaths';

// Medidas de la fila de Plan; a otro tamaño, todo en proporción
const BASE = 66;
const BASE_STROKE = 4;
const BASE_ICON = 22;

// El color de la insignia: el de su nivel; sin ninguno, apagado
export const badgeTone = (a: Achievement) => (a.level > 0 && a.tier ? TIER_COLORS[a.tier] : FINE.mute);

// Cuánto se llena el aro: hasta el siguiente nivel; con todos, entero
export const badgeProgress = (a: Achievement) => (a.nextThreshold === null ? 1 : a.progressToNext);

// El grueso del aro y el tamaño del dibujo para un emblema de `size`
export const badgeEmblemMetrics = (size: number) => ({ stroke: (BASE_STROKE * size) / BASE, icon: (BASE_ICON * size) / BASE });

// El dibujo de la insignia dentro de cualquier SVG: en un cuadrado de `size` con la esquina en (x, y). Sin conseguir,
// algo apagado (como siempre en la fila de Plan).
export function BadgeGlyph({ a, x, y, size, color }: { a: Achievement; x: number; y: number; size: number; color: string }) {
  const k = size / 24;
  return (
    <G transform={`translate(${x} ${y}) scale(${k})`} opacity={a.level > 0 ? 1 : 0.7}>
      <Path d={badgeEmblemPath(a.icon)} fill="none" stroke={color} strokeWidth={BADGE_EMBLEM_STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </G>
  );
}

export function BadgeEmblem({ achievement: a, size = BASE }: { achievement: Achievement; size?: number }) {
  const color = badgeTone(a);
  const m = badgeEmblemMetrics(size);
  return (
    <GlowRing progress={badgeProgress(a)} colors={ringTones(color)} size={size} stroke={m.stroke}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={m.icon} height={m.icon}>
          <BadgeGlyph a={a} x={0} y={0} size={m.icon} color={color} />
        </Svg>
      </View>
    </GlowRing>
  );
}
