// La flor de loto a línea, del tamaño y el color pedidos: el dibujo único de fine/lotus.ts. Como DumbbellIcon: `stroke`
// en píxeles de pantalla; sin él, 1,3 px, y algo más a partir de unos 30 px.
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FINE } from '@/theme/fine';
import { LOTUS_PATH } from './lotus';

export { LOTUS_PATH, isFlowerIcon } from './lotus';

export function LotusIcon({
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
        <Path d={LOTUS_PATH} fill="none" stroke={color} strokeWidth={(stroke * 24) / size} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
