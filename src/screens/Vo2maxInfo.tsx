import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { profileRepository } from '@/data/profileRepository';
import { FRIEND_VO2MAX, Vo2Sex } from '@/logic/vo2max';
import { num, t } from '@/i18n';

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
// de la persona resaltada.
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
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('What it is')}</Text>
        <Text style={styles.body}>
          {t('VO2max is the most oxygen your body can use during maximal exercise. It is one of the best markers of cardiovascular fitness and of how well you will age: the higher it is for your age, the better.')}
        </Text>
        <Text style={styles.title}>{t('How it is measured')}</Text>
        <Text style={styles.body}>
          {t('With a stress test with gas analysis (cardiopulmonary exercise test) at a sports medicine centre or with a cardiologist: you run or cycle wearing a mask that measures the oxygen you use. It takes about 20-30 minutes. Watches estimate it, but the real measurement is this test.')}
        </Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })} activeOpacity={0.85}>
          <Ionicons name="medkit-outline" size={18} color={Colors.background} />
          <Text style={styles.ctaText}>{t('Ask a specialist about the test')}</Text>
        </TouchableOpacity>
        <Text style={styles.soon}>{t('Soon you will be able to book it from Kuova. If you already have a result, add it above.')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t('What is normal for your age')}</Text>
        <View style={styles.sexRow}>
          {(['male', 'female'] as const).map((s) => (
            <TouchableOpacity key={s} style={[styles.sexBtn, sex === s && styles.sexBtnOn]} onPress={() => setSex(s)}>
              <Text style={[styles.sexText, sex === s && styles.sexTextOn]}>{s === 'male' ? t('Men') : t('Women')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <Text style={[styles.cell, styles.ageCell, styles.thText]}>{t('Age')}</Text>
            <Text style={[styles.cell, styles.thText, { color: Colors.attention }]}>{t('Low level')}</Text>
            <Text style={[styles.cell, styles.thText]}>{t('Fair')}</Text>
            <Text style={[styles.cell, styles.thText, { color: Colors.ok }]}>{t('Good level')}</Text>
            <Text style={[styles.cell, styles.thText, { color: Colors.accent }]}>{t('Excellent')}</Text>
          </View>
          {rows.map((r) => {
            const mine = age != null && age >= r.ages[0] && age <= r.ages[1];
            const [, p25, p50, p75, p90] = r.p;
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
        <Text style={styles.note}>
          {t('mL/kg/min. Low: below the 25th percentile; fair: 25th-50th; good: 50th-75th; excellent: above the 75th.')}
          {myRow ? ` ${t('Above the 90th percentile it is superior: {n} or more at your age.', { n: f1(myRow.p[4]) })}` : ''}
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/')}>
          <Text style={styles.source}>
            {t('Source: FRIEND registry, Kaminsky LA et al. Mayo Clin Proc 2015 (treadmill test, adults without heart disease). On a bike, values come out a little lower.')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 16, marginHorizontal: 20 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 16, gap: 8 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 2 },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 22, paddingVertical: 12, marginTop: 6 },
  ctaText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  soon: { color: Colors.textMuted, fontSize: 12, textAlign: 'center' },
  sexRow: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: Colors.background, borderRadius: 16, padding: 3 },
  sexBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 13 },
  sexBtnOn: { backgroundColor: Colors.accent },
  sexText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  sexTextOn: { color: Colors.background },
  table: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.divider },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: Colors.divider },
  th: { borderTopWidth: 0, backgroundColor: Colors.background },
  thText: { fontWeight: '800', fontSize: 11 },
  trMine: { backgroundColor: withAlpha(Colors.accent, 0.12) },
  cell: { flex: 1, color: Colors.textPrimary, fontSize: 11, textAlign: 'center' },
  ageCell: { flex: 0.85, color: Colors.textSecondary, fontWeight: '700' },
  mineText: { color: Colors.accent, fontWeight: '800' },
  note: { color: Colors.textMuted, fontSize: 11, lineHeight: 16 },
  source: { color: Colors.accent, fontSize: 11, lineHeight: 16 },
});
