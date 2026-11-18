// «Cinta métrica · Pinza de grasa»: las dos pestañas pequeñas con borde de Medidas (apuntarlas y su evolución),
// como los periodos de las fichas. `counts`: un número junto al nombre (las rellenas al apuntar)
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MeasureTool } from '@/logic/bodyMeasures';
import { t } from '@/i18n';
import { FINE, ff } from '@/theme/fine';

export function MeasureTabs({
  value,
  onChange,
  counts,
  style,
}: {
  value: MeasureTool;
  onChange: (tool: MeasureTool) => void;
  counts?: Partial<Record<MeasureTool, number>>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <FineTabs
      value={value}
      onChange={onChange}
      style={style}
      options={(['tape', 'fold'] as const).map((id) => ({
        id,
        label: `${id === 'tape' ? t('Tape measure') : t('Skinfold caliper')}${counts?.[id] ? ` · ${counts[id]}` : ''}`,
      }))}
    />
  );
}

// Las mismas pestañas con cualquier opción (p. ej. «Con tus medidas · De tu báscula» al apuntar el peso)
export function FineTabs<T extends string>({
  value,
  onChange,
  options,
  style,
}: {
  value: T;
  onChange: (id: T) => void;
  options: readonly { id: T; label: string }[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tabs, style]} accessibilityRole="tablist">
      {options.map(({ id, label }) => {
        const on = value === id;
        return (
          <TouchableOpacity
            key={id}
            style={[styles.tab, on && styles.tabOn]}
            onPress={() => onChange(id)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { paddingVertical: 6, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: FINE.line, minHeight: 34, justifyContent: 'center' },
  tabOn: { borderColor: FINE.jade },
  tabText: { ...ff('regular'), fontSize: 13, color: FINE.mute },
  tabTextOn: { color: FINE.ivory },
});
