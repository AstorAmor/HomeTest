import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { AppSection, SECTION_OPTIONS } from '@/data/appPrefs';
import { t } from '@/i18n';
import { FINE, fine } from '@/theme/fine';

// Lista de partes de la app con su interruptor. Tocar la fila abre su guía con vista previa.
// La usa Configure my experience. Desde el 2026-11-16, como en el prototipo («Tu experiencia»): filas con
// una línea fina debajo, sin tarjeta ni icono de color, y el interruptor esmeralda.
export const SectionToggles = ({
  sections = SECTION_OPTIONS.map((o) => o.id),
  isOn,
  onToggle,
}: {
  sections?: AppSection[];
  isOn: (id: AppSection) => boolean;
  onToggle: (id: AppSection, on: boolean) => void;
}) => {
  const router = useRouter();
  const options = SECTION_OPTIONS.filter((o) => sections.includes(o.id));
  return (
    <View>
      {options.map((o, i) => {
        const on = isOn(o.id);
        return (
          <View key={o.id} style={[fine.row, i === options.length - 1 && styles.lastRow]}>
            <TouchableOpacity
              style={styles.rowMain}
              onPress={() => router.push({ pathname: '/feature-guide', params: { id: o.id } })}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityHint={t('See how it works')}
            >
              <Text style={fine.rowTitle}>{t(o.title)}</Text>
              <Text style={fine.rowSub}>{t(o.subtitle)}</Text>
              <Text style={styles.more}>{t('See how it works')} ›</Text>
            </TouchableOpacity>
            <Switch
              value={on}
              onValueChange={(v) => onToggle(o.id, v)}
              trackColor={{ false: 'rgba(240,239,230,0.14)', true: FINE.emerald }}
              thumbColor={FINE.ivory}
              ios_backgroundColor="rgba(240,239,230,0.14)"
              accessibilityLabel={t(o.title)}
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  rowMain: { flex: 1, minWidth: 0, paddingRight: 6 },
  lastRow: { borderBottomWidth: 0 },
  more: { ...fine.link, fontSize: 12.5, marginTop: 4 },
});
