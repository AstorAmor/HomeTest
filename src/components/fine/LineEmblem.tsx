// Dibujos a línea para los temas de Aprende (fundador, 2026-11-16: Aprende no se había pasado a la estética nueva).
// Sustituyen a las manchas de color con un icono relleno (BlobArt): trazos finos a 24 × 24 como los de GoalEmblem y
// FineGlyph, con el grosor fijo en píxeles a cualquier tamaño. La clave es el nombre del icono que ya traen los datos
// (MaterialCommunityIcons en learning.ts), así los datos no cambian; lo que no esté aquí sale como libro.
// Las insignias no van aquí: llevan su propio emblema (badges/BadgeEmblem), igual en Plan y en grande.
import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { FINE } from '@/theme/fine';
import { DUMBBELL_PATH } from './dumbbell';
import { LOTUS_PATH } from './lotus';

const LEAF = 'M5 19C5 11 10 6 19.5 5 18.5 14 13.5 19 5 19zM5 19l8.5-8.5';
const DUMBBELL = DUMBBELL_PATH; // las pesas, las mismas en toda la app (fine/dumbbell.ts)
const FLASK = 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9';
const BOOK = 'M12 6.5C10.5 5.3 8.3 4.8 4 5v13c4.3-.2 6.5.3 8 1.5 1.5-1.2 3.7-1.7 8-1.5V5c-4.3-.2-6.5.3-8 1.5zM12 6.5v13';

export const LINE_ICON_PATHS: Record<string, string> = {
  // Temas de Aprende (src/data/learning.ts)
  // Salud reproductiva: el loto único del ciclo (fine/lotus.ts)
  'flower-outline': LOTUS_PATH,
  lotus: LOTUS_PATH,
  run: 'M15 2.5a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4zM13.6 7.6L11.4 13l2.6 2.6-1 4.9M11.4 13L9 16l-3.5.5M13.4 8.2l2.6 2.4 2.6-.6M13.2 8.4L10 9l-2 2.2',
  meditation:
    'M12 2.8a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 1 0 0-3.6zM12 8.2v5.6M12 9.2c-1.5.9-2.9 2.6-4.3 5.3M12 9.2c1.5.9 2.9 2.6 4.3 5.3M4.5 18c2.4-1.6 4.8-2.3 7.5-2.3s5.1.7 7.5 2.3M7.5 20.5h9',
  yoga: 'M12 4.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2zM7.5 3l4.5 6.3L16.5 3M12 9.3V21M12 15l-3.8 1.6 3.8 1.9',
  'food-apple-outline':
    'M12 7.5c-1.4-1-3.8-1.3-5.3.3C4.9 9.6 5.2 13.4 6.6 16.3 7.8 18.8 9.6 20.6 11.2 20c.5-.2.6-.3.8-.3s.3.1.8.3c1.6.6 3.4-1.2 4.6-3.7 1.4-2.9 1.7-6.7-.1-8.5-1.5-1.6-3.9-1.3-5.3-.3zM12 7.5c0-2 .8-3.5 2.6-4.3M12 6.5c-1.5-.2-2.8-1.2-3.2-2.8 1.6-.2 2.9.7 3.2 2.8z',
  sleep: 'M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1zM16.5 4.5v3M15 6h3',
  'heart-pulse': 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20zM7 12h2.6l1.4-2.4 2.2 4.4 1.3-2h2.5',
  'head-heart-outline':
    'M8.5 21v-4.6C6.3 15 5 12.7 5 10a7 7 0 0 1 13.4-2.8l1.9 4.8-1.8.6V15a1.5 1.5 0 0 1-1.5 1.5h-1.5V21M11.5 12.6s-2.6-1.6-2.6-3.4a1.4 1.4 0 0 1 2.6-.7 1.4 1.4 0 0 1 2.6.7c0 1.8-2.6 3.4-2.6 3.4z',
  dna: 'M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9M8 12h8M8.7 5h6.6M8.7 19h6.6',
  'cup-water': 'M6 3.5h12l-1.6 16a1.7 1.7 0 0 1-1.7 1.5H9.3a1.7 1.7 0 0 1-1.7-1.5L6 3.5zM6.8 10c1.7-.9 3.5-.9 5.2 0s3.5.9 5.2 0',
  dumbbell: DUMBBELL,
  'test-tube': 'M9 3h6M10 3v14.5a2 2 0 0 0 4 0V3M10 11h4',
  fire: 'M12 21c3.6 0 6-2.5 6-6 0-4.2-3.3-6.3-4.2-10.5C11.6 6.4 11 8.6 11.5 10.6 10 10 9.2 8.8 9 7.4 7.2 9.2 6 11.8 6 15c0 3.5 2.4 6 6 6zM12 21c-1.6 0-2.7-1.1-2.7-2.7 0-1.8 1.4-2.7 2.7-4.3 1.3 1.6 2.7 2.5 2.7 4.3 0 1.6-1.1 2.7-2.7 2.7z',
  snowflake:
    'M12 21V3M4.21 16.5l15.58-9M4.21 7.5l15.58 9M14 3.8l-2 2-2-2M5.9 6.17l.73 2.73-2.73.73M3.9 14.37l2.73.73-.73 2.73M10 20.2l2-2 2 2M18.1 17.83l-.73-2.73 2.73-.73M20.1 9.63l-2.73-.73.73-2.73',
  'flask-outline': FLASK,
  'coffee-outline': 'M5 9h11v5.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5V9zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M4 21h14M9 3.5c-.8.9-.8 2.1 0 3M12.5 3.5c-.8.9-.8 2.1 0 3',
  book: BOOK,
};

export const linePath = (icon: string) => LINE_ICON_PATHS[icon] ?? BOOK;

// Solo el dibujo, del tamaño pedido; `stroke`, en píxeles de pantalla
export function LineIcon({ icon, size = 20, color = FINE.mute, stroke = 1.4 }: { icon: string; size?: number; color?: string; stroke?: number }) {
  return (
    <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={linePath(icon)} fill="none" stroke={color} strokeWidth={(stroke * 24) / size} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// El dibujo dentro de un aro fino (las filas y la cabecera de Aprende). `glow`: un halo suave a lo largo del aro y
// una luz apenas marcada dentro; `dim`: apagado, sin halo y con el aro casi transparente.
export function LineEmblem({
  icon,
  size = 40,
  color = FINE.jade,
  glow,
  dim,
  ratio = 0.54,
  style,
}: {
  icon: string;
  size?: number;
  color?: string;
  glow?: boolean;
  dim?: boolean;
  ratio?: number; // tamaño del dibujo respecto al aro
  style?: StyleProp<ViewStyle>;
}) {
  const id = `le${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const c = size / 2;
  // Con halo, el aro deja sitio alrededor para que la luz no se corte en el borde
  const r = glow ? c * 0.8 : c - 1;
  const iconSize = r * 2 * ratio;
  const k = iconSize / 24;
  const lineW = glow ? Math.max(1, size / 150) : 1;
  const iconStroke = glow ? Math.max(1.3, size / 110) : 1.4;
  const halo = glow && !dim;
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`${id}i`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.7" stopColor={color} stopOpacity={dim ? 0.02 : 0.05} />
            <Stop offset="1" stopColor={color} stopOpacity={dim ? 0.05 : glow ? 0.13 : 0.1} />
          </RadialGradient>
          {halo && (
            <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
              <Stop offset={String((r * 0.86) / c)} stopColor={color} stopOpacity={0} />
              <Stop offset={String(r / c)} stopColor={color} stopOpacity={0.2} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          )}
        </Defs>
        {halo && <Circle cx={c} cy={c} r={c} fill={`url(#${id}h)`} />}
        <Circle cx={c} cy={c} r={r} fill={`url(#${id}i)`} />
        <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeOpacity={dim ? 0.35 : glow ? 0.85 : 0.5} strokeWidth={lineW} />
        <G transform={`translate(${c - iconSize / 2} ${c - iconSize / 2}) scale(${k})`} opacity={dim ? 0.75 : 1}>
          <Path d={linePath(icon)} fill="none" stroke={color} strokeWidth={iconStroke / k} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      </Svg>
    </View>
  );
}
