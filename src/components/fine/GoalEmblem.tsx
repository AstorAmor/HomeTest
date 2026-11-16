// El emblema de cada objetivo (Plan → Tus objetivos): un dibujo a línea dentro de un círculo con luz, como los
// círculos de Hoy (fundador, 2026-11-16: «en Your goals… estaría bien darle algo más chulo, rollo icono o
// imagen»). El aro va entero y quieto: un objetivo no enseña porcentaje de avance (ESPECIFICACION.md §1.5).
// Jade para los que eliges tú; oro para los que salen del análisis.
import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import type { GoalKey } from '@/logic/metas';
import { FINE } from '@/theme/fine';

// Trazos a 24 × 24, línea de 1,4 (como los iconos de la barra de pestañas)
const FLASK = 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9';
const PATHS: Record<GoalKey, string> = {
  ldl: FLASK,
  tg: FLASK,
  glucosa: FLASK,
  hdl: FLASK,
  energia: 'M13.2 3 6.5 13.2h5L10.8 21l6.7-10.2h-5L13.2 3z',
  animo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.6 14.2q3.4 3 6.8 0M9.2 9.6h.01M14.8 9.6h.01',
  sueno: 'M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1zM16.5 4.5v3M15 6h3',
  peso: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.5 10.5a3.5 3.5 0 0 1 7 0M12 10.5l1.6-1.8',
  estres: 'M5 19C5 11 10 6 19.5 5 18.5 14 13.5 19 5 19zM5 19l8.5-8.5',
  forma: 'M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11',
  tabaco: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8',
  alcohol: 'M7 3h10l-.8 6.5a4.2 4.2 0 0 1-8.4 0L7 3zM12 14v6.5M8.5 20.5h7',
  salud: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z',
  longev: 'M7 3h10M7 21h10M8.5 3c0 4.6 7 5 7 9s-7 4.4-7 9M15.5 3c0 4.6-7 5-7 9s7 4.4 7 9',
};

export function GoalEmblem({ goal, lab, size = 44 }: { goal: GoalKey; lab?: boolean; size?: number }) {
  const id = `ge${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const color = lab ? FINE.gold : FINE.jade;
  const c = size / 2;
  const icon = size * 0.5;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Defs>
          {/* Una luz suave dentro, más fuerte hacia el aro */}
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.04} />
            <Stop offset="0.8" stopColor={color} stopOpacity={0.12} />
            <Stop offset="1" stopColor={color} stopOpacity={0.22} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 1} fill={`url(#${id})`} />
        <Circle cx={c} cy={c} r={c - 1} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={1} />
        <G transform={`translate(${c - icon / 2} ${c - icon / 2}) scale(${icon / 24})`}>
          <Path d={PATHS[goal]} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      </Svg>
    </View>
  );
}
