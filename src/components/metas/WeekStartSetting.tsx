// Ajustes → «La semana empieza el»: lunes o domingo. Lo usan tus metas: cada semana va de ese día al de
// antes, y si empiezas a mitad, la primera cuenta desde ese día (fundador, 2026-11-05). Se guarda con las
// metas (user_flags 'metas.v1'), así que vale igual en el móvil y en la web.
// Desde el 2026-11-17, en el lenguaje fino de Ajustes: cabecera pequeña y los dos días en chips con borde.
import { View, StyleSheet, Text } from 'react-native';
import { SecHead } from '@/components/fine/Fine';
import { FChip } from '@/components/fine/FineForm';
import { useMetas } from '@/hooks/useMetas';
import type { WeekStart } from '@/logic/metas';
import { t } from '@/i18n';
import { fine } from '@/theme/fine';

const OPTIONS: { id: WeekStart; label: string }[] = [
  { id: 1, label: 'Monday' },
  { id: 0, label: 'Sunday' },
];

export function WeekStartSetting() {
  const { data, update } = useMetas();
  const on = data?.state.weekStart ?? 1;
  return (
    <>
      <SecHead title={t('Week starts on')} />
      <View style={styles.chips} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => {
          const sel = o.id === on;
          return (
            <FChip
              key={o.id}
              label={t(o.label)}
              on={sel}
              disabled={!data}
              onPress={() => data && !sel && update({ ...data.state, weekStart: o.id })}
            />
          );
        })}
      </View>
      <Text style={fine.note}>{t('For your targets: Monday to Sunday, or Sunday to Saturday.')}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
