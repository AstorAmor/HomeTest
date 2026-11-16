import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { RangeBar } from '@/components/RangeBar';
import { UnitLabel } from '@/components/UnitLabel';
import { statusColor, statusIcon } from '@/components/LabValueRow';
import { Colors, withAlpha } from '@/constants/colors';
import { TAB, tabHref } from '@/constants/tabs';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { labUploadRepository } from '@/data/labUploads';
import { markerName } from '@/utils/markerLinks';
import { useSections } from '@/data/appPrefs';
import { labReports } from '@/utils/labReportView';
import { getParameterCard } from '@/utils/parameterInfo';
import { labEvidence } from '@/utils/labEvidence';
import { rangeStatusLabel, rangeText } from '@/utils/rangeStatus';
import { chartBand, chartPoints, isOut, markerHistory, pointState, pointsFromReports, pointsFromUploads, sourceParam, type MarkerPoint } from '@/logic/labMarkers';
import { GOALS, labGoalForMarker } from '@/logic/metas';
import { dateLocale, num, t } from '@/i18n';

// Un marcador de tus analíticas en Mis datos (/lab-marker?key=…&from=…), fundador 2026-11-06: «pinchar en
// las analíticas y mostrar el marcador en tus datos». El último valor frente al rango de su laboratorio,
// la gráfica con todos los que hay en la misma unidad, la lista de analíticas (cada una se abre), qué es y
// qué puede moverlo y, fuera de rango, qué se ha asociado a mejores valores y su objetivo, si lo tiene.
// Textos neutros: un valor fuera del rango no es un diagnóstico.

const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
const shortLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(), { month: 'short', year: '2-digit' });
const labOf = (p: MarkerPoint) => p.source.lab || (p.source.kind === 'upload' ? t('Uploaded by you') : t('Lab test'));
const valueText = (p: MarkerPoint) => (p.value != null ? num(p.value) : p.text || '—');

export const LabMarkerScreen = () => {
  const router = useRouter();
  const show = useSections();
  const { key = '', from } = useLocalSearchParams<{ key: string; from?: string }>();
  const [history, setHistory] = useDeepState<MarkerPoint[] | null>(null);

  useReloadOnFocus(
    useCallback(async () => {
      const uploads = await labUploadRepository.getAll().catch(() => []);
      setHistory(markerHistory([...pointsFromUploads(uploads), ...pointsFromReports(labReports())], key));
    }, [key, setHistory]),
  );

  const latest = history?.[history.length - 1];
  const name = latest ? markerName(key, latest.name) : t('Marker');
  if (!history || !latest) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={name} showBack backFallback={tabHref(TAB.analysis)} />
        {history && <Text style={styles.empty}>{t('This value is not in any of your lab tests any more.')}</Text>}
      </SafeAreaView>
    );
  }

  const state = pointState(latest);
  const color = statusColor(state);
  const range = rangeText(latest.low, latest.high);
  const chart = chartPoints(history);
  // Un límite inferior de 0 es «menos de …»: cuenta como sin límite
  const band = chartBand(chart.points.map((p) => p.value as number), latest.low ? latest.low : null, latest.high);
  const card = getParameterCard(latest.name);
  const side = state === 'por_encima' ? 'high' : 'low';
  const evidence = isOut(state) && !key.startsWith('n:') ? labEvidence(key, side) : null;
  const goal = isOut(state) ? labGoalForMarker(key, side) : null;
  const openAnalysis = (p: MarkerPoint) =>
    p.source.kind === 'upload'
      ? router.push({ pathname: '/progress', params: { upload: p.source.id } })
      : p.source.id === 'current'
        ? router.push('/report-summary')
        : router.push({ pathname: '/lab-report', params: { id: p.source.id } });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={name} showBack backFallback={tabHref(TAB.analysis)} />
        <Text style={styles.kicker}>{t('In your lab tests')}</Text>

        {/* El último valor */}
        <View style={styles.card}>
          <Text style={styles.meta}>
            {t('Latest value')} · {longDate(latest.date)} · {labOf(latest)}
          </Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{valueText(latest)}</Text>
            <UnitLabel unit={latest.unit} style={styles.unit} />
            <View style={{ flex: 1 }} />
            <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.12) }]}>
              <Ionicons name={statusIcon(state) as any} size={14} color={color} />
              <Text style={[styles.badgeText, { color }]}>{rangeStatusLabel(state)}</Text>
            </View>
          </View>
          <Text style={styles.rangeLine}>
            {range ? t('Lab range: {range} {unit}', { range, unit: latest.unit }).trim() : t('This lab gives no reference range for it.')}
          </Text>
          {latest.value != null && <RangeBar value={latest.value} min={latest.low} max={latest.high} />}
        </View>

        {/* Todos sus valores */}
        {chart.points.length >= 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('How it has changed')}</Text>
            <TrendChart
              labels={chart.points.map((p) => shortLabel(p.date))}
              series={[{ color: Colors.accent, values: chart.points.map((p) => p.value as number) }]}
              height={130}
              band={band}
              formatValue={(v) => num(Math.round(v * 100) / 100)}
            />
            {band && <Text style={styles.note}>{t('The shaded band is the range of your latest lab.')}</Text>}
            {chart.otherUnits > 0 && (
              <Text style={styles.note}>
                {t(chart.otherUnits === 1 ? '1 value comes in another unit and is not in the chart.' : '{n} values come in another unit and are not in the chart.', { n: chart.otherUnits })}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.section}>{t(history.length === 1 ? 'Your result' : 'Your {n} results', { n: history.length })}</Text>
        <View style={[styles.card, { paddingVertical: 4 }]}>
          {[...history].reverse().map((p, i) => {
            const s = pointState(p);
            const here = from === sourceParam(p.source);
            return (
              <TouchableOpacity key={`${sourceParam(p.source)}-${i}`} style={[styles.row, i > 0 && styles.divider]} onPress={() => openAnalysis(p)} activeOpacity={0.8}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {longDate(p.date)}
                    {here ? <Text style={styles.here}>{`  ·  ${t('this test')}`}</Text> : null}
                  </Text>
                  <Text style={styles.rowSub}>
                    {labOf(p)}
                    {rangeText(p.low, p.high) ? ` · ${t('range {range}', { range: rangeText(p.low, p.high)! })}` : ''}
                  </Text>
                </View>
                <Text style={[styles.rowValue, isOut(s) && { color: Colors.attention }]}>
                  {valueText(p)} <Text style={styles.rowUnit}>{p.unit}</Text>
                </Text>
                <Ionicons name={statusIcon(s) as any} size={18} color={statusColor(s)} />
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>{t('Tap a result to open that lab test.')}</Text>

        {/* Qué es (base de conocimiento, pendiente de revisión médica) */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('What it is')}</Text>
          <Text style={styles.text}>{card.role}</Text>
          {card.relevance ? (
            <>
              <Text style={styles.label}>{t('Why it is measured')}</Text>
              <Text style={styles.text}>{card.relevance}</Text>
            </>
          ) : null}
          {card.factors ? (
            <>
              <Text style={styles.label}>{t('What can move it')}</Text>
              <Text style={styles.text}>{card.factors}</Text>
            </>
          ) : null}
          {isOut(state) && (
            <>
              <Text style={styles.label}>{evidence ? t('What has been associated with better values') : t('What to do')}</Text>
              <Text style={styles.text}>{evidence ? t(evidence) : t('Talk to a doctor about this result before changing anything.')}</Text>
            </>
          )}
          <View style={styles.links}>
            {goal && show('plan') && (
              <TouchableOpacity style={styles.link} onPress={() => router.push('/metas-objetivos')}>
                <Ionicons name="flag-outline" size={16} color={Colors.accent} />
                <Text style={styles.linkText}>{t('Your goal for this: {goal}', { goal: t(GOALS[goal].name) })}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.link} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}>
              <Ionicons name="medkit-outline" size={16} color={Colors.accent} />
              <Text style={styles.linkText}>{t('Talk to a doctor')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.hint}>{t('A value out of range is not a diagnosis. Your doctor puts it in context.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 32 },
  empty: { color: Colors.textSecondary, fontSize: 14, marginHorizontal: 20 },
  kicker: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 20, marginBottom: 10 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12, gap: 6 },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  meta: { color: Colors.textSecondary, fontSize: 12 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  value: { color: Colors.textPrimary, fontSize: 30, fontWeight: '900' },
  unit: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  rangeLine: { color: Colors.textSecondary, fontSize: 13 },
  note: { color: Colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  section: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginHorizontal: 20, marginTop: 6, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  here: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  rowSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  rowValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  rowUnit: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginHorizontal: 20, marginTop: -4, marginBottom: 14 },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 6 },
  text: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  links: { gap: 10, marginTop: 10 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { color: Colors.accent, fontSize: 13, fontWeight: '700', flexShrink: 1 },
});
