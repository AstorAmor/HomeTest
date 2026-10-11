import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { AppIcon } from '@/components/HealthIcons';
import { t } from '@/i18n';

// Piezas comunes de las fichas de detalle (VFC, pulso, sueño… y también glucosa, tensión,
// colesterol y cortisol) para que todas se vean igual: icono arriba con el último valor,
// selector 7D/14D/1M/6M en pastilla, media/mínimo/máximo y "+ Añadir medición".

export const RANGES = [
  { id: '7D', days: 7 },
  { id: '14D', days: 14 },
  { id: '1M', days: 30 },
  { id: '6M', days: 182 },
] as const;
export type RangeId = (typeof RANGES)[number]['id'];
export const rangeDays = (id: RangeId) => RANGES.find((r) => r.id === id)!.days;

export const RangeTabs = ({ value, onChange }: { value: RangeId; onChange: (r: RangeId) => void }) => (
  <View style={styles.tabs}>
    {RANGES.map((r) => (
      <TouchableOpacity key={r.id} style={[styles.tab, value === r.id && styles.tabOn]} onPress={() => onChange(r.id)}>
        <Text style={[styles.tabText, value === r.id && styles.tabTextOn]}>{r.id}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

export const MetricHero = ({ icon, color, value, sub }: { icon: string; color: string; value: string; sub: string }) => (
  <View style={styles.hero}>
    <View style={[styles.icon, { backgroundColor: withAlpha(color, 0.14) }]}>
      <AppIcon name={icon} size={22} color={color} />
    </View>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.valueSub}>{sub}</Text>
  </View>
);

// `unit` va en pequeño debajo del nombre, para que el número quepa en una línea
export const StatsRow = ({ items, unit }: { items: { label: string; value: string }[]; unit?: string }) => (
  <View style={styles.stats}>
    {items.map((s) => (
      <View key={s.label} style={styles.stat}>
        <Text style={styles.statValue} numberOfLines={1}>
          {s.value}
        </Text>
        <Text style={styles.statLabel}>{unit ? `${t(s.label)} · ${unit}` : t(s.label)}</Text>
      </View>
    ))}
  </View>
);

export const AddMeasurementButton = ({ onPress, label }: { onPress: () => void; label?: string }) => (
  <TouchableOpacity style={styles.add} onPress={onPress} activeOpacity={0.85}>
    <Ionicons name="add" size={20} color={Colors.accent} />
    <Text style={styles.addText}>{label ?? t('Add measurement')}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', alignSelf: 'center', backgroundColor: Colors.card, borderRadius: 18, padding: 3, marginBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 15 },
  tabOn: { backgroundColor: Colors.accent },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  tabTextOn: { color: Colors.background },
  hero: { alignItems: 'center', marginBottom: 14 },
  icon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  value: { color: Colors.textPrimary, fontSize: 34, fontWeight: '800' },
  valueSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 12 },
  stat: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.6),
    borderRadius: 24,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 12,
  },
  addText: { color: Colors.accent, fontSize: 15, fontWeight: '800' },
});
