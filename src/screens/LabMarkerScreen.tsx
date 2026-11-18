import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { UnitLabel } from '@/components/UnitLabel';
import { Chev, FRow, SecHead } from '@/components/fine/Fine';
import { measureStyles } from '@/components/fine/FineMeasure';
import { LabFigure, LabGauge, labStyles, rangeTone, StatusWord } from '@/components/fine/FineLab';
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
import { FINE, ff, fine } from '@/theme/fine';

// Un marcador de tus analíticas en Mis datos (/lab-marker?key=…&from=…), fundador 2026-11-06: «pinchar en
// las analíticas y mostrar el marcador en tus datos». El último valor frente al rango de su laboratorio,
// la gráfica con todos los que hay en la misma unidad, la lista de analíticas (cada una se abre), qué es y
// qué puede moverlo y, fuera de rango, qué se ha asociado a mejores valores y su objetivo, si lo tiene.
// Textos neutros: un valor fuera del rango no es un diagnóstico.
// Desde el 2026-11-16, como la ficha de un biomarcador del prototipo: la cifra grande y ligera con su estado al
// lado (jade en rango, oro fuera), la línea de rango fina, la evolución sin tarjeta y lo demás en secciones
// pequeñas con filas de línea fina.

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

        <View style={styles.body}>
          <Text style={fine.kicker}>{t('In your lab tests')}</Text>

          {/* El último valor: la cifra, su unidad, de cuándo y de qué laboratorio, y su estado */}
          <LabFigure
            value={valueText(latest)}
            unit={latest.unit ? <UnitLabel unit={latest.unit} style={labStyles.unit} /> : undefined}
            lines={[`${t('Latest value')} · ${longDate(latest.date)}`, labOf(latest)]}
            status={rangeStatusLabel(state)}
            tone={rangeTone(state)}
            style={styles.figure}
          />
          <LabGauge value={latest.value} low={latest.low} high={latest.high} style={styles.gauge} />
          <Text style={fine.note}>
            {range ? t('Lab range: {range} {unit}', { range, unit: latest.unit }).trim() : t('This lab gives no reference range for it.')}
          </Text>

          {/* Todos sus valores */}
          {chart.points.length >= 2 && (
            <>
              <SecHead title={t('How it has changed')} />
              <TrendChart
                labels={chart.points.map((p) => shortLabel(p.date))}
                series={[{ color: FINE.jade, values: chart.points.map((p) => p.value as number) }]}
                height={140}
                band={band}
                formatValue={(v) => num(Math.round(v * 100) / 100)}
              />
              {band && <Text style={fine.note}>{t('The shaded band is the range of your latest lab.')}</Text>}
              {chart.otherUnits > 0 && (
                <Text style={fine.note}>
                  {t(chart.otherUnits === 1 ? '1 value comes in another unit and is not in the chart.' : '{n} values come in another unit and are not in the chart.', { n: chart.otherUnits })}
                </Text>
              )}
            </>
          )}

          <SecHead title={t(history.length === 1 ? 'Your result' : 'Your {n} results', { n: history.length })} />
          {[...history].reverse().map((p, i, list) => {
            const s = pointState(p);
            const here = from === sourceParam(p.source);
            const r = rangeText(p.low, p.high);
            return (
              <TouchableOpacity
                key={`${sourceParam(p.source)}-${i}`}
                style={[fine.row, i === list.length - 1 && styles.noLine]}
                onPress={() => openAnalysis(p)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${longDate(p.date)}, ${valueText(p)} ${p.unit}, ${rangeStatusLabel(s)}`}
              >
                <View style={styles.flex}>
                  <Text style={fine.rowTitle}>
                    {longDate(p.date)}
                    {here ? <Text style={styles.here}>{`  ·  ${t('this test')}`}</Text> : null}
                  </Text>
                  <Text style={fine.rowSub}>
                    {labOf(p)}
                    {r ? ` · ${t('range {range}', { range: r })}` : ''}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={[fine.rowValue, isOut(s) && { color: FINE.gold }]}>
                    {valueText(p)} <Text style={styles.rowUnit}>{p.unit}</Text>
                  </Text>
                  <StatusWord label={rangeStatusLabel(s)} tone={rangeTone(s)} />
                </View>
                <Chev />
              </TouchableOpacity>
            );
          })}
          <Text style={fine.note}>{t('Tap a result to open that lab test.')}</Text>

          {/* Qué es (base de conocimiento, pendiente de revisión médica) */}
          <SecHead title={t('What it is')} />
          <Text style={measureStyles.p}>{card.role}</Text>
          {card.relevance ? (
            <>
              <SecHead title={t('Why it is measured')} style={styles.infoHead} />
              <Text style={measureStyles.p}>{card.relevance}</Text>
            </>
          ) : null}
          {card.factors ? (
            <>
              <SecHead title={t('What can move it')} style={styles.infoHead} />
              <Text style={measureStyles.p}>{card.factors}</Text>
            </>
          ) : null}
          {isOut(state) && (
            <>
              <SecHead title={evidence ? t('What has been associated with better values') : t('What to do')} style={styles.infoHead} />
              <Text style={measureStyles.p}>{evidence ? t(evidence) : t('Talk to a doctor about this result before changing anything.')}</Text>
            </>
          )}

          <View style={styles.links}>
            {goal && show('plan') && (
              <FRow title={t('Your goal for this: {goal}', { goal: t(GOALS[goal].name) })} onPress={() => router.push('/metas-objetivos')} />
            )}
            <FRow title={t('Talk to a doctor')} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })} last />
          </View>
          <Text style={fine.note}>{t('A value out of range is not a diagnosis. Your doctor puts it in context.')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 32 },
  body: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  noLine: { borderBottomWidth: 0 },
  empty: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginHorizontal: 20 },
  figure: { marginTop: 8 },
  gauge: { marginTop: 14 },
  here: { ...ff('regular'), color: FINE.jade, fontSize: 12.5 },
  right: { alignItems: 'flex-end', gap: 2 },
  rowUnit: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  infoHead: { marginTop: 16 },
  links: { marginTop: 18, borderTopWidth: 1, borderTopColor: FINE.line },
});
