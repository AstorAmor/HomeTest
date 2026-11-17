import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Pill, SecHead } from '@/components/fine/Fine';
import { measureStyles } from '@/components/fine/FineMeasure';
import { profileRepository } from '@/data/profileRepository';
import { FRIEND_VO2MAX, Vo2Sex } from '@/logic/vo2max';
import { num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

const ageOf = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
};

// Parte propia de la ficha del VO2max: qué es, que se mide con un especialista (y que pronto se
// podrá pedir desde Kuova) y la tabla de referencia por edad y sexo (registro FRIEND) con la fila
// de la persona resaltada. Desde el 2026-11-16, en fino: sin tarjetas, cabeceras pequeñas, la consulta en
// píldora con borde de oro y la tabla en filas con línea fina (los niveles, sin colores de semáforo).
export const Vo2maxInfo = () => {
  const router = useRouter();
  const [sex, setSex] = useState<Vo2Sex>('male');
  const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    profileRepository
      .get()
      .then((p) => {
        if (p.sex === 'female') setSex('female');
        setAge(ageOf(p.dateOfBirth));
      })
      .catch(() => undefined);
  }, []);

  const rows = FRIEND_VO2MAX[sex];
  const f1 = (v: number) => num(v.toFixed(1));
  const myRow = age != null ? rows.find((r) => age >= r.ages[0] && age <= r.ages[1]) : undefined;

  return (
    <View>
      <SecHead title={t('What it is')} />
      <Text style={measureStyles.p}>
        {t('VO2max is the most oxygen your body can use during maximal exercise. It is one of the best markers of cardiovascular fitness and of how well you will age: the higher it is for your age, the better.')}
      </Text>
      <SecHead title={t('How it is measured')} />
      <Text style={measureStyles.p}>
        {t('With a stress test with gas analysis (cardiopulmonary exercise test) at a sports medicine centre or with a cardiologist: you run or cycle wearing a mask that measures the oxygen you use. It takes about 20-30 minutes. Watches estimate it, but the real measurement is this test.')}
      </Text>
      <View style={styles.cta}>
        <Pill gold label={t('Ask a specialist about the test')} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })} />
      </View>
      <Text style={styles.soon}>{t('Soon you will be able to book it from Kuova. If you already have a result, add it above.')}</Text>

      <SecHead title={t('What is normal for your age')} />
      {/* Hombres · Mujeres en pestañas pequeñas con borde, como los periodos */}
      <View style={styles.sexRow}>
        {(['male', 'female'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sexBtn, sex === s && styles.sexBtnOn]}
            onPress={() => setSex(s)}
            hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
            accessibilityRole="button"
            accessibilityState={{ selected: sex === s }}
          >
            <Text style={[styles.sexText, sex === s && styles.sexTextOn]}>{s === 'male' ? t('Men') : t('Women')}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* La tabla en filas con línea fina; la de tu edad, con su cifra en jade y un fondo apenas marcado */}
      <View style={styles.table}>
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.cell, styles.ageCell, styles.thText]}>{t('Age')}</Text>
          <Text style={[styles.cell, styles.thText]}>{t('Low level')}</Text>
          <Text style={[styles.cell, styles.thText]}>{t('Fair')}</Text>
          <Text style={[styles.cell, styles.thText]}>{t('Good level')}</Text>
          <Text style={[styles.cell, styles.thText]}>{t('Excellent')}</Text>
        </View>
        {rows.map((r) => {
          const mine = age != null && age >= r.ages[0] && age <= r.ages[1];
          const [, p25, p50, p75] = r.p;
          return (
            <View key={r.ages[0]} style={[styles.tr, mine && styles.trMine]}>
              <Text style={[styles.cell, styles.ageCell, mine && styles.mineText]}>
                {r.ages[0]}-{r.ages[1]}
              </Text>
              <Text style={styles.cell}>&lt; {f1(p25)}</Text>
              <Text style={styles.cell}>
                {f1(p25)}–{f1(p50)}
              </Text>
              <Text style={styles.cell}>
                {f1(p50)}–{f1(p75)}
              </Text>
              <Text style={styles.cell}>≥ {f1(p75)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={fine.note}>
        {t('mL/kg/min. Low: below the 25th percentile; fair: 25th-50th; good: 50th-75th; excellent: above the 75th.')}
        {myRow ? ` ${t('Above the 90th percentile it is superior: {n} or more at your age.', { n: f1(myRow.p[4]) })}` : ''}
      </Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/')} accessibilityRole="link">
        <Text style={styles.source}>
          {t('Source: FRIEND registry, Kaminsky LA et al. Mayo Clin Proc 2015 (treadmill test, adults without heart disease). On a bike, values come out a little lower.')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cta: { alignItems: 'center', marginTop: 16 },
  soon: { ...fine.note, textAlign: 'center' },
  sexRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  sexBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: FINE.line, minHeight: 30, justifyContent: 'center' },
  sexBtnOn: { borderColor: FINE.jade },
  sexText: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  sexTextOn: { color: FINE.ivory },
  table: { marginTop: 4 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: FINE.line },
  th: { paddingVertical: 7 },
  thText: { ...ff('semibold'), color: FINE.mute, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  trMine: { backgroundColor: FINE.tile },
  cell: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 11.5, textAlign: 'center', fontVariant: ['tabular-nums'] },
  ageCell: { flex: 0.85, color: FINE.mute },
  mineText: { ...ff('medium'), color: FINE.jade },
  source: { ...fine.link, fontSize: 11.5, lineHeight: 16, marginTop: 8 },
});
