import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Intestino (no hay uno en Ionicons ni MaterialCommunityIcons): un solo tubo que baja haciendo eses,
// con tres asas que se meten unas en otras y un tramo recto arriba y abajo, como el icono de
// referencia que eligió el fundador (2026-10-19). Mismo tamaño y uso que un icono de la librería.
// A tamaño grande el trazo engorda un poco, como en la referencia; a tamaño de icono se queda fino
// para que se vea el hueco entre las asas.
export const IntestineIcon = ({ size = 20, color }: { size?: number; color: string }) => {
  const stroke = { stroke: color, strokeWidth: size >= 40 ? 1.7 : 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Entra por arriba, gira a la izquierda y vuelve hacia la derecha */}
      <Path d="M12.5 1.5V3A1.5 1.5 0 0 1 11 4.5H7.5A2.5 2.5 0 0 0 7.5 9.5H15.4" {...stroke} />
      {/* Asa del centro: abraza la vuelta de arriba por la derecha y la de abajo por la izquierda */}
      <Path d="M10.6 7H17.7A2.5 2.5 0 0 1 17.7 12H6.3A2.5 2.5 0 0 0 6.3 17H14.1" {...stroke} />
      {/* Última vuelta y salida por abajo */}
      <Path d="M8.6 14.5H17.1A2.5 2.5 0 0 1 17.1 19.5H12.9A1.5 1.5 0 0 0 11.4 21V22.5" {...stroke} />
    </Svg>
  );
};
