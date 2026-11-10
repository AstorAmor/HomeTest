// Ajustes → «La semana empieza el»: lunes o domingo. Lo usan tus metas: cada semana va de ese día al de
// antes, y si empiezas a mitad, la primera cuenta desde ese día (fundador, 2026-11-05). Se guarda con las
// metas (user_flags 'metas.v1'), así que vale igual en el móvil y en la web.
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { prefStyles } from '@/components/PreferencesBlock';
import { useMetas } from '@/hooks/useMetas';
import type { WeekStart } from '@/logic/metas';
import { t } from '@/i18n';

const OPTIONS: { id: WeekStart; label: string }[] = [
  { id: 1, label: 'Monday' },
  { id: 0, label: 'Sunday' },
];

export function WeekStartSetting() {
  const { data, update } = useMetas();
  const on = data?.state.weekStart ?? 1;
  return (
    <>
      <Text style={prefStyles.section}>{t('Week starts on')}</Text>
      <View style={prefStyles.card}>
        {OPTIONS.map((o, i) => {
          const sel = o.id === on;
          return (
            <TouchableOpacity
              key={o.id}
              style={[styles.row, i > 0 && styles.divider]}
              disabled={!data}
              onPress={() => data && !sel && update({ ...data.state, weekStart: o.id })}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel }}
            >
              <Text style={styles.rowTitle}>{t(o.label)}</Text>
              <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={20} color={sel ? Colors.accent : Colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.note}>{t('For your targets: Monday to Sunday, or Sunday to Saturday.')}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginHorizontal: 20, marginTop: 8 },
});
