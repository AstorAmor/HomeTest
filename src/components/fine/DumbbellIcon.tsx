// Las pesas a línea, del tamaño y el color pedidos: el dibujo único de fine/dumbbell.ts (el del entrenador personal).
// `stroke`, en píxeles de pantalla, como PathIcon (fine/RoleEmblem.tsx). Sin él: 1,3 px, el trazo fino de los
// dibujos de los especialistas, y algo más a partir de unos 30 px para que en grande no se quede en un hilo.
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FINE } from '@/theme/fine';
import { DUMBBELL_PATH } from './dumbbell';

export { DUMBBELL_PATH, isWeightsIcon } from './dumbbell';

export function DumbbellIcon({
  size = 20,
  color = FINE.jade,
  stroke = Math.max(1.3, size / 22),
  style,
}: {
  size?: number;
  color?: string;
  stroke?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={DUMBBELL_PATH} fill="none" stroke={color} strokeWidth={(stroke * 24) / size} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
