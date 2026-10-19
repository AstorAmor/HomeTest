import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { BodyComp, latestBodyComp, weightRepository } from '@/data/weightRepository';
import { BODY_COMP, weighAdvice } from '@/logic/weight';
import { dateLocale, num, t } from '@/i18n';

// Debajo de la gráfica del peso: cuándo toca pesarse, cómo hacerlo bien y la última composición corporal.
export const WeightInfo = () => {
  const [comp, setComp] = useState<{ fecha: string; values: BodyComp } | null>(null);
  const [next, setNext] = useState<{ due: boolean; date: Date | null; tooOften: boolean } | null>(null);

  useReloadOnFocus(
    useCallback(async () => {
      const [c, entries] = await Promise.all([latestBodyComp(), weightRepository.getAll()]);
      setComp(c);
      const a = weighAdvice(entries);
      setNext({ due: a.due, date: a.next, tooOften: a.tooOften });
    }, []),
  );

  const day = (d: Date) => d.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={{ gap: 12 }}>
      {next && (
        <View style={styles.card}>
          <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
          <Text style={styles.cardText}>
            {next.due || !next.date ? t('Time to weigh yourself.') : t('Next weigh-in: {day}.', { day: day(next.date) })}
            {next.tooOften ? ` ${t('You have weighed yourself 3 or more times this week: once a week is enough.')}` : ''}
          </Text>
        </View>
      )}

      {comp && (
        <View style={styles.box}>
          <Text style={styles.title}>{t('Body composition')}</Text>
          <Text style={styles.muted}>{new Date(comp.fecha).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          <View style={styles.grid}>
            {BODY_COMP.map((b) => (
              <View key={b.kind} style={styles.cell}>
                <Text style={styles.value}>{comp.values[b.kind] != null ? `${num(comp.values[b.kind]!)} ${b.unit}` : '—'}</Text>
                <Text style={styles.label}>{t(b.label)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.muted}>{t('Home scales estimate it from your hydration: compare it between weigh-ins in the same conditions.')}</Text>
        </View>
      )}

      <View style={styles.box}>
        <Text style={styles.title}>{t('How to weigh yourself')}</Text>
        <Text style={styles.text}>
          {t('Once a week, on the same day: in the morning, after the toilet and before eating or drinking, with little clothing and on the same scale. Weight changes 1–2 kg from one day to the next with what you ate, salt, fluid retention or your menstrual cycle, so a single weigh-in says little. Look at the trend over several weeks.')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.accentSoft, borderRadius: 14, padding: 12 },
  cardText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  box: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, gap: 8 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  text: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  muted: { color: Colors.textMuted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '47%', backgroundColor: Colors.background, borderRadius: 12, padding: 10 },
  value: { color: Colors.textPrimary, fontSize: 17, fontWeight: '900' },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
});
