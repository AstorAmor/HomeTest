import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Intestino en contorno (no hay uno en Ionicons ni MaterialCommunityIcons): el colon, con sus
// segmentos, enmarca las asas del intestino delgado y baja al recto por el centro.
// Mismo tamaño y uso que un icono de la librería.
export const IntestineIcon = ({ size = 20, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Colon: sube por la izquierda, cruza arriba, baja por la derecha y acaba en el recto */}
    <Path
      d="M7 18V8c0-1.9 1.4-3.3 3.3-3.3h3.4C15.6 4.7 17 6.1 17 8v5.6c0 1.6-1.2 2.8-2.8 2.8H13.4c-.8 0-1.4.6-1.4 1.4V21"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Ciego y apéndice */}
    <Path d="M7 18c0 1.1.7 1.8 1.6 1.8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    {/* Segmentos del colon */}
    <Path d="M5.6 10.5h2.8M5.6 14h2.8M10 3.4v2.6M14 3.4v2.6M15.6 10.5h2.8" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    {/* Intestino delgado */}
    <Path
      d="M10 8.6h3.6c.9 0 .9 1.7 0 1.7h-3.2c-.9 0-.9 1.7 0 1.7h3.2c.9 0 .9 1.7 0 1.7H10.4"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
