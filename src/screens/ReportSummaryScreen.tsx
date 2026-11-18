import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Chev, FRow, SecHead } from '@/components/fine/Fine';
import { FineGlyph } from '@/components/fine/FineMeasure';
import { currentReport } from '@/data/reportRepository';
import { getActionPlanContentEn, getMarkerDisplayNameEn, getMarkerValueTextEn, RETEST_REASON_EN } from '@/data/reportContentEn';
import { findLabReport, formatReportDate } from '@/utils/labReportView';
import { reportObservations, type FocusItem, type ObservedMarker } from '@/logic/reportObservations';
import { getLang, t, tn } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Observaciones del último informe (antes «Tu informe», que repetía lo de Análisis: el rosco, las áreas y los
// marcadores para revisar). Fundador, 2026-11-18: «el informe completo sobra, es exactamente lo mismo que "Tu último
// informe". ¿Podríamos añadir alguna observación en su lugar? Me gusta lo de 39 marcadores han mejorado de forma
// significativa (poner cuáles), poner si alguno ha empeorado… y poner recomendación en lo que te podrías fijar…
// pero no repetirlo todo como en la ventana anterior». Así que aquí va solo lo que Análisis no dice:
// - desde tu última analítica: cuántos han mejorado y cuáles (los que vuelven a su rango, por nombre; los que se
//   acercan, con su valor antes y ahora), si alguno ha empeorado y cuántos han cambiado sin salir de su rango;
// - en qué fijarte: como mucho 3 de los que siguen fuera, lo más lejos primero, con cuándo repetirlo y qué hay en
//   el plan para ellos, y en una línea los que están en rango pero cerca del límite;
// - el enlace a todos los resultados por áreas.
// Qué cuenta como mejora y por qué ya no salen 39 (sino 17 en la demo): src/logic/reportObservations.ts. Se llega
// tocando el rosco de «Tu último informe» en Análisis, desde Archivos y al recibir los resultados.

const nameOf = (m: ObservedMarker) => getMarkerDisplayNameEn(m.marker_id, m.display_name);
const valueOf = (m: ObservedMarker) => getMarkerValueTextEn(m.value, m.unit);
const prevOf = (m: ObservedMarker) => (m.trend ? getMarkerValueTextEn(m.trend.previous_value, null) : '');

export const ReportSummaryScreen = () => {
  const router = useRouter();
  const o = reportObservations(currentReport);
  const { lab } = findLabReport('current');
  const improved = [...o.backInRange, ...o.closer];
  const openMarker = (id: string) => router.push({ pathname: '/report-marker-detail', params: { markerId: id } });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Observations')} showBack />

        <View style={styles.body}>
          <Text style={[fine.note, styles.date]}>
            {formatReportDate(currentReport.test_date)} · {lab}
          </Text>

          {/* Desde tu última analítica */}
          {o.compared ? (
            <>
              <SecHead title={t('Since your last test')} />
              <View style={styles.headRow}>
                <FineGlyph name="up" size={18} color={improved.length ? FINE.jade : FINE.mute} />
                <Text style={styles.headline}>
                  {tn(improved.length, '{n} marker has improved significantly', '{n} markers have improved significantly')}
                </Text>
              </View>

              {o.backInRange.length > 0 && (
                <View style={styles.group}>
                  <Text style={fine.kicker}>{`${t('Back in range')} · ${o.backInRange.length}`}</Text>
                  <Text style={styles.names}>{o.backInRange.map(nameOf).join(' · ')}</Text>
                </View>
              )}

              {o.closer.length > 0 && (
                <View style={styles.group}>
                  <Text style={fine.kicker}>{`${t('Closer to their range')} · ${o.closer.length}`}</Text>
                  {o.closer.map((m, i) => (
                    <ChangeRow key={m.marker_id} m={m} last={i === o.closer.length - 1} onPress={() => openMarker(m.marker_id)} />
                  ))}
                </View>
              )}

              {o.worse.length > 0 ? (
                <View style={styles.group}>
                  <Text style={[fine.kicker, { color: FINE.gold }]}>
                    {`${tn(o.worse.length, '{n} has worsened significantly', '{n} have worsened significantly')}`}
                  </Text>
                  {o.worse.map((m, i) => (
                    <ChangeRow key={m.marker_id} m={m} last={i === o.worse.length - 1} onPress={() => openMarker(m.marker_id)} gold />
                  ))}
                </View>
              ) : (
                <Text style={styles.line}>{t('None has worsened significantly.')}</Text>
              )}

              {o.changedInRange.length > 0 && (
                <Text style={styles.line}>
                  {tn(o.changedInRange.length, '1 more changed significantly without leaving its range.', '{n} more changed significantly without leaving their range.')}
                </Text>
              )}
              <Text style={fine.note}>
                {t('Improving means getting back into the lab range or closer to it. Only changes larger than what a marker varies on its own between two tests count.')}
              </Text>
            </>
          ) : (
            <Text style={fine.note}>{t('With your next test you will see what has changed.')}</Text>
          )}

          {/* En qué fijarte */}
          {(o.focus.length > 0 || o.nearLimit.length > 0) && (
            <>
              <SecHead title={t('What to keep an eye on')} />
              {o.focus.map((f, i) => (
                <FocusRow key={f.marker.marker_id} f={f} last={i === o.focus.length - 1 && !o.nearLimit.length} onPress={() => openMarker(f.marker.marker_id)} />
              ))}
              {o.nearLimit.length > 0 && (
                <Text style={styles.line}>
                  {t('In range, close to the limit: {names}.', { names: o.nearLimit.map(nameOf).join(' · ') })}
                </Text>
              )}
              <Text style={fine.note}>{t('A value out of range is not a diagnosis. Your doctor puts it in context.')}</Text>
            </>
          )}

          <View style={styles.all}>
            <FRow title={t('All results')} sub={t('By area, with each range')} onPress={() => router.push({ pathname: '/lab-report', params: { id: 'current' } })} last />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Un marcador que ha cambiado: el nombre y, a la derecha, antes → ahora
function ChangeRow({ m, last, onPress, gold }: { m: ObservedMarker; last: boolean; onPress: () => void; gold?: boolean }) {
  return (
    <TouchableOpacity style={[fine.row, last && styles.noLine]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Text style={[fine.rowTitle, styles.flex]} numberOfLines={2}>
        {nameOf(m)}
      </Text>
      <Text style={styles.change}>
        {prevOf(m)} → <Text style={{ color: gold ? FINE.gold : FINE.ivory }}>{valueOf(m)}</Text>
      </Text>
      <Chev />
    </TouchableOpacity>
  );
}

// Uno de los que siguen fuera: su valor y de qué lado, cuándo repetirlo y qué hay en tu plan para él
function FocusRow({ f, last, onPress }: { f: FocusItem; last: boolean; onPress: () => void }) {
  const m = f.marker;
  const reason = f.retest ? (getLang() === 'es' ? f.retest.reason : (RETEST_REASON_EN[m.marker_id] ?? f.retest.reason)) : '';
  const actions = f.actions.map((a) => getActionPlanContentEn(a.id, { title: a.title, why: [], how: [], caveats: [] }).title);
  return (
    <TouchableOpacity style={[fine.row, styles.focus, last && styles.noLine]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <View style={styles.flex}>
        <Text style={fine.rowTitle}>{nameOf(m)}</Text>
        <Text style={styles.focusLine}>
          <Text style={{ color: FINE.gold }}>{valueOf(m)}</Text> · {f.side === 'below' ? t('Below its range') : t('Above its range')}
        </Text>
        {f.retest ? <Text style={styles.focusLine}>{`${t('Suggested retest in {n} months', { n: f.retest.months })}: ${reason}.`}</Text> : null}
        {actions.length ? <Text style={styles.focusLine}>{t('In your plan: {actions}', { actions: actions.join(' · ') })}</Text> : null}
      </View>
      <Chev />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  noLine: { borderBottomWidth: 0 },
  date: { marginTop: 0 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  headline: { ...ff('light'), flex: 1, color: FINE.ivory, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  group: { marginTop: 18 },
  names: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 21, marginTop: 6 },
  change: { ...ff('regular'), color: FINE.mute, fontSize: 13, fontVariant: ['tabular-nums'] },
  line: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 20, marginTop: 16 },
  focus: { alignItems: 'flex-start' },
  focusLine: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18, marginTop: 3 },
  all: { marginTop: 22, borderTopWidth: 1, borderTopColor: FINE.rule },
});
