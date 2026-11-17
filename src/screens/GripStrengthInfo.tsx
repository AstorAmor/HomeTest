import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SecHead } from '@/components/fine/Fine';
import { measureStyles } from '@/components/fine/FineMeasure';
import { ageFromDob, profileRepository } from '@/data/profileRepository';
import { DODDS_GRIP, gripAgeLabel, gripRowFor, GripSex } from '@/logic/gripStrength';
import { num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Parte propia de la ficha de la fuerza de agarre (fundador, 2026-11-17: «añade otra sección (como VO2max) para
// fuerza de agarre. Y pon como en VO2max la tabla también»): qué es, cómo se mide (dinamómetro de mano, el mejor
// intento) y la tabla de referencia por edad y sexo de Dodds 2014 (src/logic/gripStrength.ts) con la fila de la
// persona resaltada. En fino, como Vo2maxInfo: cabeceras pequeñas, la tabla en filas con línea fina y los niveles
// sin colores de semáforo.
export const GripStrengthInfo = () => {
  const [sex, setSex] = useState<GripSex>('male');
  const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    profileRepository
      .get()
      .then((p) => {
        if (p.sex === 'female') setSex('female');
        const a = ageFromDob(p.dateOfBirth);
        setAge(a != null && Number.isFinite(a) ? a : null);
      })
      .catch(() => undefined);
  }, []);

  const rows = DODDS_GRIP[sex];
  const myRow = age != null ? gripRowFor(age, sex) : undefined;

  return (
    <View>
      <SecHead title={t('What it is')} />
      <Text style={measureStyles.p}>
        {t('The greatest force your hand can squeeze, in kilograms. It is a simple marker of overall muscle strength: in large population studies, higher grip strength for your age goes with better mobility and healthier ageing.')}
      </Text>
      <SecHead title={t('How it is measured')} />
      <Text style={measureStyles.p}>
        {t('With a hand dynamometer, seated, elbow bent at 90° and wrist straight. Squeeze as hard as you can for about 3 seconds, 3 times with each hand, resting in between, and log the best attempt. Physiotherapists and sports medicine centres have one; a home dynamometer also works if you always use the same one.')}
      </Text>

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
          const mine = myRow?.age === r.age;
          const [, p25, p50, p75] = r.p;
          return (
            <View key={r.age} style={[styles.tr, mine && styles.trMine]}>
              <Text style={[styles.cell, styles.ageCell, mine && styles.mineText]}>{gripAgeLabel(r)}</Text>
              <Text style={styles.cell}>&lt; {p25}</Text>
              <Text style={styles.cell}>
                {p25}–{p50}
              </Text>
              <Text style={styles.cell}>
                {p50}–{p75}
              </Text>
              <Text style={styles.cell}>≥ {p75}</Text>
            </View>
          );
        })}
      </View>
      <Text style={fine.note}>
        {t('kg, best attempt. Low: below the 25th percentile; fair: 25th-50th; good: 50th-75th; excellent: above the 75th.')}
        {myRow ? ` ${t('Above the 90th percentile it is superior: {n} or more at your age.', { n: num(myRow.p[4]) })}` : ''}
      </Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://doi.org/10.1371/journal.pone.0113637')} accessibilityRole="link">
        <Text style={styles.source}>
          {t('Source: Dodds RM et al. PLoS One 2014, centiles from 12 general population studies in Great Britain (about 50,000 people aged 4 to 90+, best of up to 6 attempts with both hands). Each row is the value at its central age.')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  sexRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  sexBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: FINE.line, minHeight: 30, justifyContent: 'center' },
  sexBtnOn: { borderColor: FINE.jade },
  sexText: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  sexTextOn: { color: FINE.ivory },
  table: { marginTop: 4 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: FINE.line },
  th: { paddingVertical: 7 },
  thText: { ...ff('semibold'), color: FINE.mute, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  trMine: { backgroundColor: FINE.tile },
  cell: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 11.5, textAlign: 'center', fontVariant: ['tabular-nums'] },
  ageCell: { flex: 0.85, color: FINE.mute },
  mineText: { ...ff('medium'), color: FINE.jade },
  source: { ...fine.link, fontSize: 11.5, lineHeight: 16, marginTop: 8 },
});
