import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { BlobArt, ART_PALETTES } from '@/components/BlobArt';
import { recipeName, SLOT_ICON, getRecipe } from '@/data/diet/catalog';
import { RECIPE_PHOTO_FILES } from '@/data/diet/recipePhotos';
import type { MealSlot } from '@/data/diet/types';

// Foto del plato (assets/images/recipes, índice en recipePhotos.ts; se importa solo aquí para que la lógica y
// los tests no carguen imágenes). Si una receta nueva aún no tiene foto, un fondo de color con el icono de la comida.
const PALETTE: Record<MealSlot, [string, string, string]> = {
  breakfast: [...ART_PALETTES.gold],
  lunch: [...ART_PALETTES.terracotta],
  dinner: [...ART_PALETTES.forest],
  snack: [...ART_PALETTES.sage],
};

export const RecipeImage = ({
  recipeId,
  slot,
  size,
  height,
  radius = 14,
  style,
}: {
  recipeId: string;
  slot?: MealSlot;
  size?: number; // cuadrada
  height?: number; // a todo el ancho
  radius?: number;
  style?: ViewStyle;
}) => {
  const [w, setW] = useState(size ?? 0);
  const r = getRecipe(recipeId);
  const photo = RECIPE_PHOTO_FILES[recipeId];
  const s: MealSlot = slot ?? r?.meals[0] ?? 'lunch';
  const h = size ?? height ?? 160;
  const onLayout = (e: LayoutChangeEvent) => !size && setW(Math.round(e.nativeEvent.layout.width));
  return (
    <View style={[{ width: size ?? '100%', height: h, borderRadius: radius, overflow: 'hidden' }, style]} onLayout={onLayout} accessibilityRole="image" accessibilityLabel={recipeName(r)}>
      {photo ? (
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : w > 0 ? (
        <BlobArt seed={recipeId} palette={PALETTE[s]} icon={SLOT_ICON[s]} size={{ width: w, height: h }} radius={radius} iconSize={Math.min(w, h) * 0.32} />
      ) : null}
    </View>
  );
};
