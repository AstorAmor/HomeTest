// El dibujo del cuerpo de «Medidas» (lo pinta BodyHologram por debajo de las marcas), separado para poder
// cambiarlo sin tocar el resto. Desde el 2026-11-16, las cuatro figuras del fundador: hombre y mujer, de frente y de
// espaldas (la de espaldas, para los pliegues de tríceps y subescapular). Recortadas con el fondo transparente y su
// propia malla y brillo, en assets/images/body (360 × 784, el mismo encuadre en las cuatro). Se ajustan a la caja como
// el SVG de las marcas (contain = xMidYMid meet), así que las marcas caen en su sitio.
// Para cambiarlas otra vez: sustituir las imágenes (o pintar aquí un SVG), poner su tamaño en FIGURES de
// src/logic/bodyFigure.ts (`w`, `h`) y volver a colocar allí las marcas de cada sitio en sus coordenadas.
import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { FigureSex, FigureSide } from '@/logic/bodyFigure';

const IMAGES: Record<FigureSex, Record<FigureSide, number>> = {
  male: {
    front: require('@/assets/images/body/body-male-front.webp'),
    back: require('@/assets/images/body/body-male-back.webp'),
  },
  female: {
    front: require('@/assets/images/body/body-female-front.webp'),
    back: require('@/assets/images/body/body-female-back.webp'),
  },
};

export function BodyFigureArt({ sex, side = 'front' }: { sex: FigureSex; side?: FigureSide }) {
  return <Image source={IMAGES[sex][side]} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} accessible={false} />;
}
