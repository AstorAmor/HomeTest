import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { baselineReport, currentReport } from '@/data/reportRepository';
import { showSamples } from '@/data/dataMode';
import { KuovaAgeDots, KuovaAgeLockedFigure, kuovaAgeLockedHint } from '@/components/KuovaAgeBadge';
import { kuovaAge, kuovaAgeFromUploads, KuovaAgeResult, LabInput, PHENOAGE_INPUTS, realChange } from '@/logic/kuovaAge';
import type { PhenoInput } from '@/logic/phenoAge';
import { labUploadRepository } from '@/data/labUploads';
import { lastKuovaAge, rememberKuovaAge } from '@/data/kuovaAgeCache';
import { getMyAccess } from '@/data/access';
import { profileRepository } from '@/data/profileRepository';
import { FRow, SecHead } from '@/components/fine/Fine';
import { FineGlyph, FineMark, measureStyles } from '@/components/fine/FineMeasure';
import { LabGauge } from '@/components/fine/FineLab';
import { getMarkerDisplayNameEn, getMarkerValueTextEn } from '@/data/reportContentEn';
import type { ReportMarker } from '@/types/report';
import { dateLocale, num, t } from '@/i18n';
import { TAB } from '@/constants/tabs';
import { FINE, ff, fine } from '@/theme/fine';

// "Edad KUOVA", al tocarla en Análisis. Arriba, la cifra con los años de diferencia y el cambio desde la
// analítica anterior (solo si supera el margen); debajo, su margen, qué la mueve (los 9 valores de PhenoAge con
// su línea de rango y si te quitan o te suman años) y cómo se calcula. Cuenta real: con sus analíticas subidas
// (src/logic/kuovaAge.ts) o, si aún no se puede, los 9 puntos con lo que falta. Cuenta de prueba: el informe de
// ejemplo. Desde el 2026-11-16, como la Edad KUOVA del prototipo: sin la insignia grande, la cifra grande y ligera,
// los 9 valores en filas con línea fina y lo demás en secciones pequeñas, sin tarjetas ni iconos de color.

// Los 9 valores de una analítica normal que usa PhenoAge, agrupados por lo que reflejan
const INPUTS: { group: string; markers: PhenoInput[] }[] = [
  { group: 'Inflammation', markers: ['hs_crp'] },
  { group: 'Sugar metabolism', markers: ['glucose'] },
  { group: 'Liver and nutrition', markers: ['albumin', 'alp'] },
  { group: 'Kidneys', markers: ['creatinine'] },
  { group: 'Blood and defences', markers: ['wbc', 'lymphocytes_pct', 'mcv', 'rdw'] },
];

const longDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

// Lo que necesita una fila: del informe de ejemplo o de la analítica subida
type FactorMarker = Pick<ReportMarker, 'marker_id' | 'display_name' | 'value' | 'unit' | 'flag'> & {
  range?: { low: number | null; high: number | null };
  trend?: { previous_value: number | string };
};

const SAMPLE_ROWS: Record<string, FactorMarker> = Object.fromEntries(
  currentReport.sections.flatMap((sec) => sec.markers ?? []).map((m) => [m.marker_id, m]),
);

// Las filas de una cuenta real, con el valor y el rango tal como vienen en su analítica
const rowsFromInputs = (inputs: Record<PhenoInput, LabInput>): Record<string, FactorMarker> =>
  Object.fromEntries(
    PHENOAGE_INPUTS.map(({ id, label }) => {
      const { value, unit, low, high } = inputs[id];
      const flag = low != null && value < low ? 'bajo' : high != null && value > high ? 'alto' : 'en_rango';
      const name = t(label);
      return [id, { marker_id: id, display_name: name.charAt(0).toUpperCase() + name.slice(1), value, unit, flag, range: { low, high } }];
    }),
  );

// Lo que dice el informe de cada valor: si es de los que más te quitan o suman años, o si está en rango.
// Sin rojos: lo que quita años en jade, lo que suma o queda fuera del rango en oro
const effectOf = (m: FactorMarker, drivers: { marker_id: string; direction: string }[]) => {
  const d = drivers.find((x) => x.marker_id === m.marker_id);
  if (d) return d.direction === 'resta' ? { label: 'Takes years off', color: FINE.jade, glyph: 'down' as const } : { label: 'Adds years', color: FINE.gold, glyph: 'up' as const };
  return m.flag === 'en_rango' ? { label: 'In range', color: FINE.mute, glyph: null } : { label: 'Out of range', color: FINE.gold, glyph: null };
};

// Una fila por valor: nombre y cifra, la línea de rango (la franja, el rango del laboratorio) y su efecto
const FactorRow = ({ m, drivers, last }: { m: FactorMarker; drivers: { marker_id: string; direction: string }[]; last?: boolean }) => {
  const v = typeof m.value === 'number' ? m.value : null;
  const low = m.range?.low ?? null;
  const high = m.range?.high ?? null;
  const e = effectOf(m, drivers);
  return (
    <View style={[styles.factor, last && styles.noLine]}>
      <View style={styles.factorHead}>
        <Text style={[fine.rowTitle, styles.flex]}>{getMarkerDisplayNameEn(m.marker_id, m.display_name)}</Text>
        <Text style={fine.rowValue}>{getMarkerValueTextEn(m.value, m.unit)}</Text>
      </View>
      {low != null && high != null && <LabGauge value={v} low={low} high={high} />}
      <View style={styles.factorFoot}>
        {e.glyph ? <FineGlyph name={e.glyph} size={13} color={e.color} /> : null}
        <Text style={[styles.factorEffect, { color: e.color }]}>{t(e.label)}</Text>
        {m.trend?.previous_value != null && (
          <Text style={styles.factorTrend}>{t('Previous: {v}', { v: getMarkerValueTextEn(m.trend.previous_value, m.unit) })}</Text>
        )}
      </View>
    </View>
  );
};

const SOURCES = [
  { label: 'Levine ME et al. An epigenetic biomarker of aging for lifespan and healthspan. Aging (Albany NY), 2018.', url: 'https://doi.org/10.18632/aging.101414' },
  { label: 'Liu Z et al. A new aging measure captures morbidity and mortality risk across diverse subpopulations from NHANES IV. PLoS Med, 2018.', url: 'https://doi.org/10.1371/journal.pmed.1002718' },
];

export const BiologicalAgeScreen = () => {
  const router = useRouter();
  const sample = showSamples();
  const p = currentReport.summary.phenoage;
  // Cuenta real: su Edad KUOVA sale de sus analíticas subidas y su fecha de nacimiento (o qué falta)
  // Sale ya con lo que calculó Mis datos; hasta tenerlo no se pinta nada debajo del título, para que la
  // pantalla aparezca entera de una vez y no a trozos
  const [kres, setKres] = useState<KuovaAgeResult | null>(() => (sample ? null : lastKuovaAge()));
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if (sample) return;
    Promise.all([labUploadRepository.getAll().catch(() => []), profileRepository.get().catch(() => null)]).then(([uploads, prof]) => {
      const age = kuovaAgeFromUploads(uploads, prof?.dateOfBirth);
      rememberKuovaAge(age);
      setKres(age);
    });
    getMyAccess()
      .then((a) => setSubscribed(a.tier !== 'free'))
      .catch(() => undefined);
  }, [sample]);
  const loading = !sample && kres === null;

  const view = sample
    ? p.available
      ? {
          k: kuovaAge(p),
          previous: baselineReport.summary.phenoage.available ? kuovaAge(baselineReport.summary.phenoage) : null,
          drivers: p.drivers ?? [],
          rows: SAMPLE_ROWS,
          testDate: null,
        }
      : null
    : kres?.status === 'ok'
      ? { k: kres.k, previous: kres.previous, drivers: kres.drivers, rows: rowsFromInputs(kres.inputs), testDate: kres.testDate }
      : null;
  const locked = !sample && kres && kres.status !== 'ok' ? kres : null;
  const k = view?.k ?? null;
  const change = view?.previous && k ? realChange(k, view.previous) : null;
  const openLab = () => router.navigate({ pathname: '/(tabs)', params: { tab: String(TAB.analysis) } } as any);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('KUOVA age')} showBack />
        <View style={styles.body}>
          {loading && <ActivityIndicator color={FINE.jade} style={{ marginTop: 60 }} />}

          {locked && (
            <>
              {/* Aún sin Edad KUOVA: donde iría la cifra, «00,0» difuminado y «Pendiente de desbloquear» con los 9
                  puntos de lo que hay (fundador, 2026-11-18); debajo, en pequeño, qué falta */}
              <View style={styles.lockedTop}>
                <View style={styles.hero}>
                  <KuovaAgeLockedFigure />
                  <View style={styles.flex}>
                    <Text style={styles.diff}>{t('Not unlocked yet')}</Text>
                    <View style={styles.lockedDots}>
                      <KuovaAgeDots c={locked.coverage} />
                    </View>
                  </View>
                </View>
                <Text style={styles.lockedHint}>{kuovaAgeLockedHint(locked)}</Text>
              </View>

              <SecHead title={t('What it needs')} />
              {INPUTS.map((g) => (
                <View key={g.group}>
                  <Text style={[fine.kicker, styles.groupHead]}>{t(g.group)}</Text>
                  {g.markers.map((id, i) => {
                    const has = locked.coverage.have.includes(id);
                    const label = t(PHENOAGE_INPUTS.find((x) => x.id === id)!.label);
                    return (
                      <View key={id} style={[fine.row, i === g.markers.length - 1 && styles.noLine]}>
                        <FineMark on={has} size={18} />
                        <Text style={[fine.rowTitle, styles.flex]}>{getMarkerDisplayNameEn(id, label.charAt(0).toUpperCase() + label.slice(1))}</Text>
                        <Text style={[styles.needState, has && { color: FINE.jade }]}>{t(has ? 'You have it' : 'Missing')}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
              {locked.status === 'missing' && (
                <View style={styles.links}>
                  {/* La analítica completa (~100 marcadores) no se vende suelta: va con Kuova Basic y Premium */}
                  <FRow
                    title={subscribed ? t('Your full blood test is included') : t('Get the full blood test')}
                    sub={subscribed ? t('See when it is due in Lab.') : t('Comes with Kuova Basic: the full panel and a follow-up at 6 months.')}
                    onPress={() => (subscribed ? openLab() : router.push({ pathname: '/checkout', params: { id: 'membership' } }))}
                  />
                  <FRow title={t('Upload a lab report you already have')} onPress={() => router.push('/upload-test')} last />
                </View>
              )}
            </>
          )}
          {k && (
            <>
              {/* La cifra grande y ligera; al lado, cuánto más joven (o mayor) y el cambio desde la anterior */}
              <View style={styles.hero}>
                <Text style={styles.age}>{num(k.age.toFixed(1))}</Text>
                <View style={styles.flex}>
                  <Text style={[styles.diff, k.diff < 0 && { color: FINE.gold }]}>
                    {num(Math.abs(k.diff).toFixed(1))} {k.diff >= 0 ? t('years younger') : t('years older')}
                  </Text>
                  {view?.previous ? (
                    <Text style={[styles.meta, change != null && { color: change > 0 ? FINE.gold : FINE.jade }]}>
                      {change == null
                        ? t('no real change since your previous test')
                        : `${change > 0 ? '+' : '−'}${num(Math.abs(change).toFixed(1))} ${t('since your previous test')}`}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* El margen: cuánto se mueve por la variación normal de la analítica */}
              <View style={styles.margin}>
                <Text style={styles.marginTitle}>{t('± {n} years', { n: num(k.margin.toFixed(1)) })}</Text>
                <Text style={[fine.note, styles.marginNote]}>
                  {t('Normal variation between blood tests. We only tell you it has changed when the difference is bigger than that.')}
                </Text>
              </View>
              <Text style={fine.note}>
                {view?.testDate
                  ? t('Worked out from your blood test of {date}.', { date: longDay(view.testDate) })
                  : t('Sample: with your own blood test we work out yours.')}
              </Text>

              {/* Qué la mueve: los 9 valores, por grupos */}
              <SecHead title={t('What moves it')} />
              {INPUTS.map((g) => {
                const rows = g.markers.map((id) => view?.rows[id]).filter((m): m is FactorMarker => !!m);
                return (
                  <View key={g.group}>
                    <Text style={[fine.kicker, styles.groupHead]}>{t(g.group)}</Text>
                    {rows.map((m, i) => (
                      <FactorRow key={m.marker_id} m={m} drivers={view!.drivers} last={i === rows.length - 1} />
                    ))}
                  </View>
                );
              })}
              <View style={styles.links}>
                <FRow title={t('See your values in Lab')} onPress={openLab} last />
              </View>
            </>
          )}

          {!loading && (
            <>
              <SecHead title={t('How it is calculated')} />
              <Text style={[measureStyles.p, styles.para]}>
                {t(
                  'We use PhenoAge, a method published by Levine and colleagues (2018). It combines your age with 9 values from an ordinary blood test and compares them with thousands of people followed for years in a large US health survey (NHANES).'
                )}
              </Text>
              <Text style={[measureStyles.p, styles.para]}>
                {t(
                  'The result is the age at which, on average, people have a profile like yours. If it comes out below your real age, your body is ageing better than average; above it, there is room to improve.'
                )}
              </Text>

              <SecHead title={t('What the margin means')} />
              <Text style={[measureStyles.p, styles.para]}>
                {t(
                  'The same blood test varies a little from one day to another and from one lab to another. That is why your KUOVA age comes with a margin, worked out from how much each of the 9 values usually varies in the same person. We only tell you it has changed between two tests when the difference is bigger than both margins together.'
                )}
              </Text>

              <SecHead title={t('What improves it')} />
              <Text style={[measureStyles.p, styles.para]}>
                {t(
                  'Inflammation, blood sugar control and your general health weigh the most. Sleep, physical activity and diet can improve them. A recent cold or infection raises CRP for a few weeks and can make it look older than it is: in that case, repeat the test later.'
                )}
              </Text>

              <SecHead title={t('What it is not')} />
              <Text style={[measureStyles.p, styles.para]}>
                {t('It is not a diagnosis or a prediction for you personally: it is a statistical estimate. It is most useful to compare yourself with yourself over time.')}
              </Text>

              <SecHead title={t('Sources')} />
              {SOURCES.map((s) => (
                <TouchableOpacity key={s.url} onPress={() => Linking.openURL(s.url)} accessibilityRole="link">
                  <Text style={styles.source}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  noLine: { borderBottomWidth: 0 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  age: { ...fine.num, fontSize: 54, lineHeight: 60, letterSpacing: -1 },
  diff: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  meta: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  margin: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: FINE.line },
  marginTitle: { ...ff('light'), color: FINE.jade, fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
  marginNote: { marginTop: 2 },
  groupHead: { marginTop: 14, marginBottom: 2 },
  factor: { paddingVertical: 11, gap: 4, borderBottomWidth: 1, borderBottomColor: FINE.line },
  factorHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  factorFoot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factorEffect: { ...ff('regular'), fontSize: 12 },
  factorTrend: { ...ff('regular'), color: FINE.mute, fontSize: 12, marginLeft: 'auto' },
  links: { marginTop: 14, borderTopWidth: 1, borderTopColor: FINE.line },
  para: { marginBottom: 8 },
  source: { ...ff('regular'), color: FINE.jade, fontSize: 12.5, lineHeight: 18, marginBottom: 8 },
  lockedTop: { gap: 10, marginTop: 4 },
  lockedDots: { marginTop: 7 },
  lockedHint: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 19 },
  needState: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
});
