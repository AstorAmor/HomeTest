import React, { useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { registerTarget, TourScroll } from './tourStore';

// Marca un elemento para el tutorial: el hueco de luz se dibuja sobre este View. `scroll`: el de la
// pantalla (makeTourScroll) si el elemento puede quedar más abajo de lo que se ve. `inset`: el margen
// lateral de la tarjeta de dentro (si lo tiene), para que el hueco no ocupe todo el ancho.
export const TourTarget = ({
  id,
  scroll,
  inset,
  style,
  children,
}: {
  id: string;
  scroll?: TourScroll;
  inset?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) => {
  const view = useRef<View>(null);
  useEffect(() => registerTarget(id, { view, scroll, inset }), [id, scroll, inset]);
  return (
    <View ref={view} collapsable={false} style={style}>
      {children}
    </View>
  );
};
