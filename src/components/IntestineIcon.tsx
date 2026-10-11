import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Intestino de frente en contorno (no hay uno en Ionicons ni MaterialCommunityIcons): el colon con
// sus abultamientos enmarca las asas del intestino delgado y baja al recto por el centro.
// Mismo tamaño y uso que un icono de la librería.
export const IntestineIcon = ({ size = 20, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Colon: sube por la izquierda, cruza arriba, baja por la derecha y acaba en el recto */}
    <Path
      d="M8.4 19.6c-1.8 0-3-1.2-3-2.8 0-.9.4-1.3.4-2.1s-.5-1.3-.5-2.2.5-1.3.5-2.1-.5-1.3-.5-2.2C5.3 5.6 6.8 4 8.6 4c.9 0 1.3.4 2.1.4s1.3-.4 2.2-.4 1.3.4 2.1.4.9-.4 1.8-.4c1.9 0 3.4 1.6 3.4 3.5 0 .9-.5 1.3-.5 2.1s.5 1.3.5 2.2-.5 1.3-.5 2.1.5 1.3.5 2.2c0 1.9-1.5 3.3-3.4 3.3h-1.1c-.6 0-1 .4-1 1v1.9"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Intestino delgado */}
    <Path
      d="M10.1 8.5h3.6c1 0 1 1.9 0 1.9h-3.4c-1 0-1 1.9 0 1.9h3.4c1 0 1 1.9 0 1.9h-2.4"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
