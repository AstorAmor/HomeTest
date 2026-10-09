import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { AppSection, SECTION_OPTIONS } from '@/data/appPrefs';

// Lista de partes de la app con su interruptor. Tocar la fila abre su guía con vista previa.
// La usan Configure my experience y el último paso del onboarding.
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
    <View style={styles.card}>
      {options.map((o, i) => {
        const on = isOn(o.id);
        return (
          <View key={o.id} style={[styles.row, i > 0 && styles.rowDivider]}>
            <TouchableOpacity
              style={styles.rowMain}
              onPress={() => router.push({ pathname: '/feature-guide', params: { id: o.id } })}
              activeOpacity={0.7}
            >
              <Ionicons name={o.icon as any} size={20} color={on ? Colors.accent : Colors.textMuted} />
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.rowTitle}>{o.title}</Text>
                </View>
                <Text style={styles.rowSubtitle}>{o.subtitle}</Text>
                <Text style={styles.more}>See how it works</Text>
              </View>
            </TouchableOpacity>
            <Switch
              value={on}
              onValueChange={(v) => onToggle(o.id, v)}
              trackColor={{ false: Colors.cardBorder, true: withAlpha(Colors.accent, 0.6) }}
              thumbColor={on ? Colors.accent : Colors.textMuted}
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  optional: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: withAlpha(Colors.gold, 0.5),
    borderRadius: 6,
    paddingHorizontal: 5,
  },
  rowSubtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  more: { color: Colors.accent, fontSize: 12, fontWeight: '600', marginTop: 4 },
});
