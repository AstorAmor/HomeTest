import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { baselineReport, currentReport } from '@/data/reportRepository';
import { showSamples } from '@/data/dataMode';
import { AppIcon } from '@/components/HealthIcons';
import { KuovaAgeBadge, KuovaAgeDots, kuovaAgeLockedHint } from '@/components/KuovaAgeBadge';
import { kuovaAge, kuovaAgeFromUploads, KuovaAgeResult, LabInput, PHENOAGE_INPUTS, realChange } from '@/logic/kuovaAge';
import type { PhenoInput } from '@/logic/phenoAge';
import { labUploadRepository } from '@/data/labUploads';
import { profileRepository } from '@/data/profileRepository';
import { GaugeBar } from '@/components/GaugeBar';
import { getMarkerDisplayNameEn, getMarkerValueTextEn } from '@/data/reportContentEn';
import type { ReportMarker } from '@/types/report';
import { dateLocale, num, t } from '@/i18n';
import { TAB } from '@/constants/tabs';

// "Edad KUOVA", al tocar la insignia de Mis datos. Arriba, como en Whoop: la insignia con los años
// de diferencia a un lado y el cambio desde la analítica anterior al otro (solo si supera el margen);
// debajo, su margen, qué la mueve (los 9 valores de PhenoAge con su regla y si te quitan o te suman
// años) y cómo se calcula. Cuenta real: con sus analíticas subidas (src/logic/kuovaAge.ts) o, si
// aún no se puede, la insignia difuminada con lo que falta. Cuenta de prueba: el informe de ejemplo.

// Los 9 valores de una analítica normal que usa PhenoAge, agrupados por lo que reflejan
const INPUTS: { group: string; icon: string; markers: PhenoInput[] }[] = [
  { group: 'Inflammation', icon: 'flame-outline', markers: ['hs_crp'] },
  { group: 'Sugar metabolism', icon: 'glucose', markers: ['glucose'] },
  { group: 'Liver and nutrition', icon: 'leaf-outline', markers: ['albumin', 'alp'] },
  { group: 'Kidneys', icon: 'kidney', markers: ['creatinine'] },
  { group: 'Blood and defences', icon: 'shield-checkmark-outline', markers: ['wbc', 'lymphocytes_pct', 'mcv', 'rdw'] },
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

// Lo que dice el informe de cada valor: si es de los que más te quitan o suman años, o si está en rango
const effectOf = (m: FactorMarker, drivers: { marker_id: string; direction: string }[]) => {
  const d = drivers.find((x) => x.marker_id === m.marker_id);
  if (d) return d.direction === 'resta' ? { label: 'Takes years off', color: Colors.ok, icon: 'arrow-down' } : { label: 'Adds years', color: Colors.attention, icon: 'arrow-up' };
  return m.flag === 'en_rango' ? { label: 'In range', color: Colors.textSecondary, icon: 'remove' } : { label: 'Out of range', color: Colors.warning, icon: 'alert' };
};

// Una fila por valor: nombre, cifra, regla (verde en el rango del laboratorio) y su efecto
const FactorRow = ({ m, drivers }: { m: FactorMarker; drivers: { marker_id: string; direction: string }[] }) => {
  const v = typeof m.value === 'number' ? m.value : null;
  const low = m.range?.low ?? null;
  const high = m.range?.high ?? null;
  const span = low != null && high != null ? high - low : Math.abs(v ?? 1) || 1;
  const min = low != null ? low - span * 0.6 : 0;
  const max = high != null ? high + span * 0.6 : (v ?? 0) * 2 || 1;
  const e = effectOf(m, drivers);
  return (
    <View style={styles.factor}>
      <View style={styles.factorHead}>
        <Text style={styles.factorName}>{getMarkerDisplayNameEn(m.marker_id, m.display_name)}</Text>
        <Text style={styles.factorValue}>{getMarkerValueTextEn(m.value, m.unit)}</Text>
      </View>
      {low != null && high != null && v != null && (
        <GaugeBar
          min={min}
          max={max}
          value={v}
          range={[low, high]}
          stops={[
            { at: min, color: Colors.attention },
            { at: low, color: Colors.green },
            { at: high, color: Colors.green },
            { at: max, color: Colors.attention },
          ]}
        />
      )}
      <View style={styles.factorFoot}>
        <Ionicons name={e.icon as any} size={12} color={e.color} />
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
  const [kres, setKres] = useState<KuovaAgeResult | null>(null);
  useEffect(() => {
    if (sample) return;
    Promise.all([labUploadRepository.getAll().catch(() => []), profileRepository.get().catch(() => null)]).then(([uploads, prof]) =>
      setKres(kuovaAgeFromUploads(uploads, prof?.dateOfBirth)),
    );
  }, [sample]);

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('KUOVA age')} showBack />

        {locked && (
          <>
            {/* Aún sin Edad KUOVA: la insignia difuminada y los 9 valores, marcados los que ya tiene */}
            <View style={styles.lockedTop}>
              <KuovaAgeBadge size={176} locked />
              <KuovaAgeDots c={locked.coverage} />
              <Text style={styles.lockedHint}>{kuovaAgeLockedHint(locked)}</Text>
            </View>

            <Text style={styles.section}>{t('What it needs')}</Text>
            {INPUTS.map((g) => (
              <View key={g.group} style={styles.groupCard}>
                <View style={styles.groupHead}>
                  <AppIcon name={g.icon} size={18} color={Colors.accent} />
                  <Text style={styles.groupTitle}>{t(g.group)}</Text>
                </View>
                {g.markers.map((id) => {
                  const has = locked.coverage.have.includes(id);
                  const label = t(PHENOAGE_INPUTS.find((i) => i.id === id)!.label);
                  return (
                    <View key={id} style={styles.need}>
                      <Ionicons name={has ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={has ? Colors.ok : Colors.textMuted} />
                      <Text style={styles.needName}>{getMarkerDisplayNameEn(id, label.charAt(0).toUpperCase() + label.slice(1))}</Text>
                      <Text style={[styles.needState, has && { color: Colors.ok }]}>{t(has ? 'You have it' : 'Missing')}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
            {locked.status === 'missing' && (
              <>
                <TouchableOpacity style={styles.labLink} onPress={() => router.push('/store')}>
                  <Ionicons name="water-outline" size={18} color={Colors.accent} />
                  <Text style={styles.labLinkText}>{t('Get the full blood test')}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.labLink} onPress={() => router.push('/upload-test')}>
                  <Ionicons name="cloud-upload-outline" size={18} color={Colors.accent} />
                  <Text style={styles.labLinkText}>{t('Upload a lab report you already have')}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </>
            )}
          </>
        )}
        {k && (
          <>
            <View style={styles.top}>
              <View style={styles.topStat}>
                <Text style={[styles.topValue, { color: k.diff >= 0 ? Colors.gold : Colors.attention }]}>{num(Math.abs(k.diff).toFixed(1))}</Text>
                <Text style={styles.topLabel}>{k.diff >= 0 ? t('years younger') : t('years older')}</Text>
              </View>
              <KuovaAgeBadge size={176} value={num(k.age.toFixed(1))} good={k.diff >= 0} />
              <View style={styles.topStat}>
                <Text style={[styles.topValue, { color: change != null && change > 0 ? Colors.attention : change != null ? Colors.ok : Colors.textSecondary }]}>
                  {change == null ? '—' : `${change > 0 ? '+' : '−'}${num(Math.abs(change).toFixed(1))}`}
                </Text>
                <Text style={styles.topLabel}>{view?.previous && change == null ? t('no real change since your previous test') : t('since your previous test')}</Text>
              </View>
            </View>

            {/* El margen: cuánto se mueve por la variación normal de la analítica */}
            <View style={styles.confidence}>
              <View style={styles.confidenceIcon}>
                <Ionicons name="swap-vertical" size={16} color={Colors.background} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.confidenceTitle}>{t('± {n} years', { n: num(k.margin.toFixed(1)) })}</Text>
                <Text style={styles.confidenceSub}>
                  {t('Normal variation between blood tests. We only tell you it has changed when the difference is bigger than that.')}
                </Text>
              </View>
            </View>
            <View style={styles.sampleTag}>
              <Ionicons name="flask-outline" size={13} color={Colors.warning} />
              <Text style={styles.sampleText}>
                {view?.testDate
                  ? t('Worked out from your blood test of {date}.', { date: longDay(view.testDate) })
                  : t('Sample: with your own blood test we work out yours.')}
              </Text>
            </View>

            {/* Qué la mueve: los 9 valores, por grupos */}
            <Text style={styles.section}>{t('What moves it')}</Text>
            {INPUTS.map((g) => (
              <View key={g.group} style={styles.groupCard}>
                <View style={styles.groupHead}>
                  <AppIcon name={g.icon} size={18} color={Colors.accent} />
                  <Text style={styles.groupTitle}>{t(g.group)}</Text>
                </View>
                {g.markers.map((id) => {
                  const m = view?.rows[id];
                  return m ? <FactorRow key={id} m={m} drivers={view.drivers} /> : null;
                })}
              </View>
            ))}
            <TouchableOpacity style={styles.labLink} onPress={() => router.navigate({ pathname: '/(tabs)', params: { tab: String(TAB.lab) } } as any)}>
              <Ionicons name="flask-outline" size={18} color={Colors.accent} />
              <Text style={styles.labLinkText}>{t('See your values in Lab')}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.section}>{t('How it is calculated')}</Text>
        <Text style={styles.body}>
          {t(
            'We use PhenoAge, a method published by Levine and colleagues (2018). It combines your age with 9 values from an ordinary blood test and compares them with thousands of people followed for years in a large US health survey (NHANES).'
          )}
        </Text>
        <Text style={styles.body}>
          {t(
            'The result is the age at which, on average, people have a profile like yours. If it comes out below your real age, your body is ageing better than average; above it, there is room to improve.'
          )}
        </Text>

        <Text style={styles.section}>{t('What the margin means')}</Text>
        <Text style={styles.body}>
          {t(
            'The same blood test varies a little from one day to another and from one lab to another. That is why your KUOVA age comes with a margin, worked out from how much each of the 9 values usually varies in the same person. We only tell you it has changed between two tests when the difference is bigger than both margins together.'
          )}
        </Text>

        <Text style={styles.section}>{t('What improves it')}</Text>
        <Text style={styles.body}>
          {t(
            'Inflammation, blood sugar control and your general health weigh the most. Sleep, physical activity and diet can improve them. A recent cold or infection raises CRP for a few weeks and can make it look older than it is: in that case, repeat the test later.'
          )}
        </Text>

        <Text style={styles.section}>{t('What it is not')}</Text>
        <Text style={styles.body}>
          {t('It is not a diagnosis or a prediction for you personally: it is a statistical estimate. It is most useful to compare yourself with yourself over time.')}
        </Text>

        <Text style={styles.section}>{t('Sources')}</Text>
        {SOURCES.map((s) => (
          <TouchableOpacity key={s.url} onPress={() => Linking.openURL(s.url)}>
            <Text style={styles.source}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 14 },
  topStat: { flex: 1, alignItems: 'center', gap: 2 },
  topValue: { fontSize: 26, fontWeight: '800' },
  topLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center', letterSpacing: 0.4 },
  groupCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factor: { gap: 4 },
  factorHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  factorName: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  factorValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  factorFoot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factorEffect: { fontSize: 11, fontWeight: '800' },
  factorTrend: { color: Colors.textMuted, fontSize: 11, marginLeft: 'auto' },
  changeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  changeText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  confidence: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', backgroundColor: withAlpha(Colors.ok, 0.1), borderRadius: 14, padding: 12, marginTop: 12 },
  confidenceIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.ok, alignItems: 'center', justifyContent: 'center' },
  confidenceTitle: { color: Colors.ok, fontSize: 17, fontWeight: '800' },
  confidenceSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  sampleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: withAlpha(Colors.warning, 0.1), borderRadius: 10, padding: 10 },
  sampleText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  section: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 8 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  groupTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  labLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14 },
  labLinkText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  source: { color: Colors.accent, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  lockedTop: { alignItems: 'center', gap: 12, marginTop: 4 },
  lockedHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 300 },
  need: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  needName: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  needState: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
});
