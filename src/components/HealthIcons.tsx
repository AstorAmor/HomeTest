import React from 'react';
import { View } from 'react-native';
import { withAlpha } from '@/constants/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { IntestineIcon } from './IntestineIcon';

// Iconos de salud que no traen las librerías, en contorno y con el mismo tamaño que un icono normal.

// Glucosa: gota de sangre con un terrón de azúcar
export const GlucoseIcon = ({ size = 20, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M10 2.8C8 5.4 4.8 9.4 4.8 12.6c0 2.9 2.3 5.2 5.2 5.2.4 0 .8 0 1.2-.1M10 2.8c2 2.6 5.2 6.6 5.2 9.8"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M14.2 13.6l3.4-1.6 3.4 1.6v4l-3.4 1.7-3.4-1.7z M14.2 13.6l3.4 1.6 3.4-1.6 M17.6 15.2v4.1"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Riñón con su uréter
export const KidneyIcon = ({ size = 20, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M13.4 4.3c-3.5-1.4-7.6.9-8.5 5.3-.9 4.6 1.2 9.4 5.1 10.4 2.4.6 4-.9 3.5-2.8-.4-1.5-1.8-2.2-1.8-3.8 0-1.4 1.2-2 1.9-3.1 1.5-2.4 1.4-5.2-.2-6z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    <Path d="M12.4 12.2c1.5.1 2.4.9 3.2 2.1.8 1.3 1.3 2.8 1.5 4.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

// Hierro: el símbolo químico "Fe" en un círculo (mejor que una gota, que se confunde con la sangre)
export const IronIcon = ({ size = 20, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.7} />
    <SvgText x={12} y={15.8} textAnchor="middle" fontSize={10} fontWeight="800" fill={color}>
      Fe
    </SvgText>
  </Svg>
);

// Un nombre de icono para toda la app: Ionicons por defecto, 'mci:<nombre>' para
// MaterialCommunityIcons y 'glucose' | 'kidney' | 'iron' | 'intestine' para los propios.
export const AppIcon = ({ name, size = 20, color }: { name: string; size?: number; color: string }) => {
  switch (name) {
    case 'glucose':
      return <GlucoseIcon size={size} color={color} />;
    case 'kidney':
      return <KidneyIcon size={size} color={color} />;
    case 'iron':
      return <IronIcon size={size} color={color} />;
    case 'intestine':
      return <IntestineIcon size={size} color={color} />;
  }
  if (name.startsWith('mci:')) return <MaterialCommunityIcons name={name.slice(4) as any} size={size} color={color} />;
  return <Ionicons name={name as any} size={size} color={color} />;
};

// Icono en su cuadradito de color (tarjetas de métricas y biomarcadores)
export const IconBadge = ({ name, color, size = 30 }: { name: string; color: string; size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.3),
      backgroundColor: withAlpha(color, 0.14),
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <AppIcon name={name} size={Math.round(size * 0.56)} color={color} />
  </View>
);
