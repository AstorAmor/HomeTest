import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { DonutChart } from '@/components/DonutChart';
import { RangeBar } from '@/components/RangeBar';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { profileRepository } from '@/data/profileRepository';
import { BodyComp, latestBodyComp, weightRepository } from '@/data/weightRepository';
import { bmi as bmiOf, bmiBand, BMI_RANGE, CompSlice, compositionSlices, weighAdvice } from '@/logic/weight';
import { dateLocale, num, t } from '@/i18n';

// Debajo de la gráfica del peso: cuándo toca pesarse, el IMC (con su altura del perfil y lo que no
// dice), la última composición corporal en un donut y cómo pesarse bien.

const SLICE: Record<CompSlice['kind'], { label: string; color: string }> = {
  fat: { label: 'Fat', color: Colors.amber },
  muscle: { label: 'Muscle', color: Colors.green },
  bone: { label: 'Bone', color: Colors.sky },
  rest: { label: 'Rest (organs, skin…)', color: Colors.cardBorder },
};

const ageFrom = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
};

export const WeightInfo = () => {
  const router = useRouter();
  const [comp, setComp] = useState<{ fecha: string; values: BodyComp; weight: number | null } | null>(null);
  const [next, setNext] = useState<{ due: boolean; date: Date | null; tooOften: boolean } | null>(null);
  const [body, setBody] = useState<{ bmi: number | null; hasHeight: boolean; minor: boolean } | null>(null);
  const [bmiOpen, setBmiOpen] = useState(false);

  useReloadOnFocus(
    useCallback(async () => {
      const [c, entries, profile] = await Promise.all([latestBodyComp(), weightRepository.getAll(), profileRepository.get().catch(() => null)]);
      const latest = entries.length ? entries.reduce((a, e) => (e.fecha > a.fecha ? e : a)) : null;
      // El peso del día de la composición (la báscula la da a la vez); si no, el último
      const sameDay = c ? entries.find((e) => e.fecha.slice(0, 10) === c.fecha.slice(0, 10)) : null;
      setComp(c ? { ...c, weight: sameDay?.valor ?? latest?.valor ?? null } : null);
      const a = weighAdvice(entries);
      setNext({ due: a.due, date: a.next, tooOften: a.tooOften });
      const age = ageFrom(profile?.dateOfBirth);
      setBody({
        bmi: bmiOf(latest?.valor ?? profile?.weightKg, profile?.heightCm),
        hasHeight: !!profile?.heightCm,
        minor: age !== null && age < 18,
      });
    }, []),
  );

  const day = (d: Date) => d.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  const slices = comp?.weight ? compositionSlices(comp.weight, comp.values) : null;
  const band = body?.bmi != null ? bmiBand(body.bmi) : null;

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

      {body && (
        <View style={styles.box}>
          <Text style={styles.title}>{t('Body mass index (BMI)')}</Text>
          {body.bmi != null ? (
            <>
              <View style={styles.bmiRow}>
                <Text style={styles.bmiValue}>{num(body.bmi.toFixed(1))}</Text>
                <Text style={styles.bmiUnit}>kg/m²</Text>
              </View>
              {body.minor ? (
                <Text style={styles.text}>{t('Under 18, BMI is read with charts by age and sex: take it as a guide.')}</Text>
              ) : (
                <>
                  <Text style={[styles.text, { color: band === 'normal' ? Colors.ok : Colors.textPrimary }]}>
                    {band === 'normal'
                      ? t('Within the WHO range (18.5–24.9)')
                      : band === 'under'
                        ? t('Below the WHO range (18.5–24.9)')
                        : t('Above the WHO range (18.5–24.9)')}
                  </Text>
                  <RangeBar value={body.bmi} min={BMI_RANGE.min} max={BMI_RANGE.max} format={(n) => num(n.toFixed(1))} />
                </>
              )}
            </>
          ) : (
            <TouchableOpacity onPress={() => router.push('/profile')} hitSlop={8}>
              <Text style={styles.text}>
                {body.hasHeight ? t('Log your weight and we will work out your BMI.') : t('Add your height to your profile and we will work out your BMI.')}{' '}
                <Text style={styles.link}>{body.hasHeight ? '' : t('My Profile')}</Text>
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.more} onPress={() => setBmiOpen((v) => !v)} hitSlop={8}>
            <Text style={styles.link}>{t('What it does and does not tell you')}</Text>
            <Ionicons name={bmiOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.accent} />
          </TouchableOpacity>
          {bmiOpen && (
            <Text style={styles.text}>
              {t('BMI compares your weight with your height. It is a population reference, not a measure of your health: it does not tell muscle from fat or where the fat is. With a lot of muscle it comes out high without excess fat, and with little muscle it can look normal even if fat is high. That is why your body composition and your waist measurement say more.')}
            </Text>
          )}
        </View>
      )}

      {comp && (
        <View style={styles.box}>
          <Text style={styles.title}>{t('Body composition')}</Text>
          <Text style={styles.muted}>{new Date(comp.fecha).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          {slices && comp.weight ? (
            <View style={styles.donutRow}>
              <DonutChart
                segments={slices.map((s) => ({ value: s.kg, color: SLICE[s.kind].color }))}
                size={130}
                strokeWidth={16}
                centerLabel={`${num(comp.weight)}`}
                centerSubLabel="kg"
              />
              <View style={styles.legend}>
                {slices.map((s) => (
                  <View key={s.kind} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: SLICE[s.kind].color }]} />
                    <Text style={styles.legendLabel}>{t(SLICE[s.kind].label)}</Text>
                    <Text style={styles.legendValue}>
                      {num(s.kg.toFixed(1))} kg · {Math.round((s.kg / comp.weight!) * 100)} %
                    </Text>
                  </View>
                ))}
                {comp.values.body_water != null && (
                  <Text style={styles.water}>
                    <Ionicons name="water-outline" size={12} color={Colors.sky} /> {t('Water: {v} % (spread across all of it)', { v: num(comp.values.body_water) })}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.text}>
              {comp.values.body_water != null ? t('Water: {v} % (spread across all of it)', { v: num(comp.values.body_water) }) : '—'}
            </Text>
          )}
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
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  muted: { color: Colors.textMuted, fontSize: 12 },
  bmiRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bmiValue: { color: Colors.textPrimary, fontSize: 30, fontWeight: '900' },
  bmiUnit: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 2 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  legend: { flex: 1, gap: 7 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  legendValue: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  water: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
});
