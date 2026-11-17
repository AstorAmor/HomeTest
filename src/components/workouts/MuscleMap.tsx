// El mapa de músculos de un ejercicio: la figura de frente y de espaldas como un holograma, con los grupos que
// trabaja encendidos en su color, y al lado la leyenda (principales y secundarios). Fundador, 2026-11-16: «incluir
// de alguna forma estos hologramas y resaltar los grupos musculares […] recortarlos bien y hacerlo por capas […]
// Sería óptimo poder poner, para cada ejercicio, los músculos que implica».
// Por capas: debajo, la figura entera en un solo tono (la base); encima, una imagen por grupo muscular, del mismo
// tamaño que la base, así que basta con apilarlas. Los principales, en rojo; los secundarios, en violeta azulado
// (fundador, 2026-11-17), igual que su punto en la leyenda. Las imágenes están en ./muscleArt.ts y qué capas se
// encienden, en src/logic/muscleMap.ts.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { muscleLabel } from '@/data/workouts/catalog';
import type { FigureSex } from '@/logic/bodyFigure';
import { MUSCLE_TONE, muscleHighlights, muscleLegend, type LayerHighlight, type MuscleLevel, type MuscleView } from '@/logic/muscleMap';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';
import { MUSCLE_ART, MUSCLE_ART_SIZE } from './muscleArt';

function Figure({ sex, view, layers, height }: { sex: FigureSex; view: MuscleView; layers: LayerHighlight[]; height: number }) {
  const art = MUSCLE_ART[sex][view];
  return (
    <View style={{ height, width: (height * MUSCLE_ART_SIZE.w) / MUSCLE_ART_SIZE.h }}>
      <Image source={art.base} style={[StyleSheet.absoluteFill, styles.base]} contentFit="contain" transition={0} accessible={false} />
      {layers.map(({ layer, level }) => {
        const source = art.layers[layer]?.[level];
        if (!source) return null;
        return <Image key={layer} source={source} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} accessible={false} />;
      })}
    </View>
  );
}

function LegendGroup({ title, muscles, level }: { title: string; muscles: string[]; level: MuscleLevel }) {
  return (
    <View>
      <Text style={styles.kicker}>{title}</Text>
      {muscles.map((m) => (
        <View key={m} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: MUSCLE_TONE[level] }]} />
          <Text style={[styles.name, level === 'secondary' && styles.softName]}>{muscleLabel(m)}</Text>
        </View>
      ))}
    </View>
  );
}

// ¿Hay algo que encender? (si no, la ficha deja el texto de siempre)
export const hasMuscleMap = (primary: string[], secondary: string[]) => muscleLegend(primary, secondary).length > 0;

export function MuscleMap({
  primary,
  secondary,
  sex = 'male',
  height = 248,
  style,
}: {
  primary: string[]; // músculos del catálogo (en inglés)
  secondary: string[];
  sex?: FigureSex; // sin él, la figura de hombre
  height?: number; // alto de cada figura
  style?: StyleProp<ViewStyle>;
}) {
  const lit = useMemo(() => muscleHighlights(primary, secondary), [primary, secondary]);
  const legend = useMemo(() => muscleLegend(primary, secondary), [primary, secondary]);
  const main = legend.filter((l) => l.level === 'primary').map((l) => l.muscle);
  const also = legend.filter((l) => l.level === 'secondary').map((l) => l.muscle);
  const spoken = `${main.map(muscleLabel).join(', ')}${also.length ? ` · ${t('also')} ${also.map(muscleLabel).join(', ')}` : ''}`;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.figures} accessible accessibilityRole="image" accessibilityLabel={spoken}>
        <Figure sex={sex} view="front" layers={lit.front} height={height} />
        <Figure sex={sex} view="back" layers={lit.back} height={height} />
      </View>
      <View style={styles.legend}>
        {main.length > 0 && <LegendGroup title={t('Main muscles')} muscles={main} level="primary" />}
        {also.length > 0 && <LegendGroup title={t('Secondary muscles')} muscles={also} level="secondary" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 12, marginTop: 4 },
  figures: { flexDirection: 'row', gap: 2 },
  // La base, un punto apagada para que lo encendido destaque
  base: { opacity: 0.85 },
  legend: { flex: 1, minWidth: 108, gap: 14 },
  kicker: { ...fine.kicker, marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  name: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  softName: { color: FINE.mute },
});
