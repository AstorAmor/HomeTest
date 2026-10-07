import { View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

// Logotipo de Kuova Health: los mismos trazos que la web pública
// (HomeTest-web/components/ui/Logo.tsx) y la K de los iconos (scripts/make-icons.py).
// `height` es el alto de la palabra KUOVA; el ancho sale de la proporción del logo.

const RATIO = 1556 / 276;

export function KuovaWordmark({ height = 28, color }: { height?: number; color: string }) {
  return (
    <Svg width={height * RATIO} height={height} viewBox="226 189 1556 276">
      <Path d="M230 200H268V327L427 200H490L333.67 315.49L480 457H424L302.58 338.45L268 364V402C267 430 250 450 230 457Z" fill={color} />
      <Path d="M561.5 198v141a103.5 103.5 0 0 0 207 0V198" fill="none" stroke={color} strokeWidth={37} />
      <Ellipse cx={990.5} cy={326.5} rx={126.5} ry={116.5} fill="none" stroke={color} strokeWidth={38} />
      <Path d="M1167 196h41l109 214 116-214h42l-142 260h-32Z" fill={color} />
      <Path d="M1593 196h39l146 261h-43l-123-214-128 214h-43Z" fill={color} />
    </Svg>
  );
}

// Monograma K (icono de la app)
export function KuovaMonogram({ size = 32, color }: { size?: number; color: string }) {
  return (
    <View accessible accessibilityLabel="Kuova Health">
      <Svg width={(size * 260) / 257} height={size} viewBox="0 0 260 257">
        <Path d="M0 0H38V127L197 0H260L103.67 115.49L250 257H194L72.58 138.45L38 164V202C37 230 20 250 0 257Z" fill={color} />
      </Svg>
    </View>
  );
}
