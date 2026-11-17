import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FRow, Pill } from '@/components/fine/Fine';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Piezas comunes de las fichas de detalle: los periodos 7D/14D/1M/6M y, para lo que aún las use, la cifra de
// arriba, las medias y «Añadir medición». Desde el 2026-11-16, en el lenguaje fino del prototipo (src/theme/fine.ts),
// igual que FineMeasure: sin icono en un círculo de color, pestañas con borde, las medias en filas con línea fina y
// la píldora esmeralda (el fundador: los iconos de estas fichas «se ven un poco bastos»). Las fichas usan ya
// FineMeasure (BigFigure, FineRangeTabs); estas se quedan con el mismo aspecto para no romper a quien las importe.

export const RANGES = [
  { id: '7D', days: 7 },
  { id: '14D', days: 14 },
  { id: '1M', days: 30 },
  { id: '6M', days: 182 },
] as const;
export type RangeId = (typeof RANGES)[number]['id'];
export const rangeDays = (id: RangeId) => RANGES.find((r) => r.id === id)!.days;

// `only`: algunos periodos (p. ej. «Tus últimos días», sin 6M). Pestañas pequeñas con borde, como FineRangeTabs
export const RangeTabs = ({ value, onChange, only }: { value: RangeId; onChange: (r: RangeId) => void; only?: RangeId[] }) => (
  <View style={styles.tabs}>
    {RANGES.filter((r) => !only || only.includes(r.id)).map((r) => {
      const on = value === r.id;
      return (
        <TouchableOpacity
          key={r.id}
          style={[styles.tab, on && styles.tabOn]}
          onPress={() => onChange(r.id)}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
        >
          <Text style={[styles.tabText, on && styles.tabTextOn]}>{r.id}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// La cifra grande y ligera con lo suyo debajo, sin icono (`icon` y `color` ya no se pintan; se aceptan por compatibilidad)
export const MetricHero = ({ value, sub }: { icon?: string; color?: string; value: string; sub: string }) => (
  <View style={styles.hero}>
    <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
      {value}
    </Text>
    <Text style={styles.valueSub}>{sub}</Text>
  </View>
);

// Las medias en filas con línea fina; `unit` va al lado de cada cifra
export const StatsRow = ({ items, unit }: { items: { label: string; value: string }[]; unit?: string }) => (
  <View style={styles.stats}>
    {items.map((s, i) => (
      <FRow key={s.label} title={t(s.label)} value={unit && s.value !== '—' ? `${s.value} ${unit}` : s.value} last={i === items.length - 1} />
    ))}
  </View>
);

// «Añadir medición» en píldora esmeralda, centrada
export const AddMeasurementButton = ({ onPress, label }: { onPress: () => void; label?: string }) => (
  <View style={styles.add}>
    <Pill label={label ?? t('Add measurement')} onPress={onPress} />
  </View>
);

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, marginBottom: 12 },
  tab: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20, borderWidth: 1, borderColor: FINE.line, minHeight: 30, justifyContent: 'center' },
  tabOn: { borderColor: FINE.jade },
  tabText: { ...ff('regular'), fontSize: 12.5, color: FINE.mute },
  tabTextOn: { color: FINE.ivory },
  hero: { marginBottom: 14 },
  value: { ...fine.num, fontSize: 44, lineHeight: 52 },
  valueSub: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18, marginTop: 2 },
  stats: { marginTop: 12 },
  add: { alignItems: 'center', marginTop: 22 },
});
