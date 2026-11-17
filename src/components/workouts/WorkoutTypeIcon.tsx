// El dibujo a línea de cada tipo de entreno: el mismo al apuntarlo (LogWorkoutScreen), en «Entreno apuntado» y en
// el historial. Antes eran iconos de Ionicons (fundador, 2026-11-17: «la estética no es coherente en los iconos»).
// Fuerza son las pesas únicas de la app (fine/dumbbell.ts, las del entrenador personal); cardio y movilidad, los
// dibujos de sus temas de Aprende (fine/LineEmblem.tsx); «Otro», un cronómetro neutro (fundador, 2026-11-17: con
// la pelota, «Otro» de baile parecía tenis o béisbol). Trazos a 24 × 24, sin
// relleno, con el grueso en píxeles de pantalla como PathIcon (fine/RoleEmblem.tsx).
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DUMBBELL_PATH } from '@/components/fine/dumbbell';
import { linePath } from '@/components/fine/LineEmblem';
import { FINE } from '@/theme/fine';

// Un cronómetro: vale para cualquier actividad (baile, buceo, pádel…) sin parecer un deporte concreto
const STOPWATCH = 'M12 7.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 1 0 0-13zM12 10.6V14l2.2 1.4M10 3.5h4M12 3.5v4M17.4 7.6l1.3-1.3';

// Un tipo que no se conozca sale con el cronómetro
export const workoutTypePath = (type: string) =>
  type === 'strength' ? DUMBBELL_PATH : type === 'cardio' ? linePath('run') : type === 'mobility' ? linePath('yoga') : STOPWATCH;

export function WorkoutTypeIcon({
  type,
  size = 20,
  color = FINE.jade,
  stroke = Math.max(1.3, size / 22),
  style,
}: {
  type: string;
  size?: number;
  color?: string;
  stroke?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={workoutTypePath(type)} fill="none" stroke={color} strokeWidth={(stroke * 24) / size} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
