import { View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

// Logotipo de Kuova Health: los mismos trazos que la web pública
// (HomeTest-web/components/ui/Logo.tsx) y la K de los iconos (scripts/make-icons.py).
// `height` es el alto de la palabra KUOVA; el ancho sale de la proporción del logo.

const RATIO = 1556 / 276;

export function KuovaWordmark({ height = 28, color }: { height?: number; color: string }) {
  return (
    <Svg width={height * RATIO} height={height} viewBox="226 189 1556 276">
      <Path d="M230 200h38v202c-1 28-18 48-38 55Z" fill={color} />
      <Path d="M427 200h63L268 364v-37Z" fill={color} />
      <Path d="M297 333 328 310l152 147h-56Z" fill={color} />
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
        <Path d="M0 0h38v202c-1 28-18 48-38 55Z" fill={color} />
        <Path d="M197 0h63L38 164v-37Z" fill={color} />
        <Path d="M67 133 98 110l152 147h-56Z" fill={color} />
      </Svg>
    </View>
  );
}
