import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FRow, SecHead } from '@/components/fine/Fine';
import { FineButton, FineGlyph, measureStyles } from '@/components/fine/FineMeasure';
import { LabFigure, LabGauge } from '@/components/fine/FineLab';
import { currentReport, findMarkerInCurrentReport } from '@/data/reportRepository';
import { getMarkerExplanation } from '@/data/markerExplanations';
import {
  getMarkerDisplayNameEn,
  getMarkerValueTextEn,
  getUnitLabelEn,
  RETEST_REASON_EN,
} from '@/data/reportContentEn';
import { FLAG_LABEL } from '@/utils/reportDisplay';
import { formatReportDate } from '@/utils/labReportView';
import { rangeText } from '@/utils/rangeStatus';
import { getLang, num, t } from '@/i18n';
import { markerHref } from '@/utils/markerLinks';
import { FINE, ff, fine } from '@/theme/fine';

// Un valor de tu último informe (desde «Tu informe»). Desde el 2026-11-16, como la ficha de un biomarcador del
// prototipo: la cifra grande y ligera con la unidad, la fecha y su estado al lado (jade en rango, oro fuera), la
// línea de rango con el rango del laboratorio debajo y lo demás en secciones pequeñas, sin tarjetas.
export const ReportMarkerDetailScreen = () => {
  const router = useRouter();
  const { markerId } = useLocalSearchParams<{ markerId: string }>();
  const marker = markerId ? findMarkerInCurrentReport(markerId) : undefined;
  const retest = currentReport.retest.find((r) => r.marker_id === markerId);
  const [testBooked, setTestBooked] = useState(false);

  if (!marker) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Marker')} showBack />
        <Text style={styles.notFound}>{t('Marker not found.')}</Text>
      </SafeAreaView>
    );
  }

  const displayName = getMarkerDisplayNameEn(marker.marker_id, marker.display_name);
  const unit = getUnitLabelEn(marker.unit);
  const value = typeof marker.value === 'number' ? marker.value : Number(marker.value);
  const range = rangeText(marker.range.low, marker.range.high);
  const direction = marker.trend?.direction;
  // El motivo de repetirlo: en español, el del informe; en inglés, su traducción
  const retestReason = retest ? (getLang() === 'es' ? retest.reason : RETEST_REASON_EN[retest.marker_id] ?? retest.reason) : '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={displayName} showBack />

        <View style={styles.body}>
          {/* La cifra, su unidad, de cuándo es y su estado */}
          <LabFigure
            value={num(marker.value)}
            unit={unit}
            lines={[formatReportDate(currentReport.test_date)]}
            status={t(FLAG_LABEL[marker.flag])}
            tone={marker.flag === 'en_rango' ? 'in' : 'out'}
          />
          <LabGauge value={Number.isNaN(value) ? null : value} low={marker.range.low} high={marker.range.high} style={styles.gauge} />
          {range ? <Text style={fine.note}>{t('Lab range: {range} {unit}', { range, unit }).trim()}</Text> : null}

          {marker.trend && (
            <View style={styles.trend}>
              {direction === 'sube' || direction === 'baja' ? <FineGlyph name={direction === 'sube' ? 'up' : 'down'} size={16} color={FINE.mute} /> : null}
              <Text style={styles.trendText}>
                {t('Previous test: {v} ({date})', {
                  v: getMarkerValueTextEn(marker.trend.previous_value, marker.unit),
                  date: formatReportDate(marker.trend.previous_date),
                })}
              </Text>
            </View>
          )}

          <FRow
            title={t('See all your results in My Data')}
            onPress={() => router.push(markerHref(marker.marker_id, 'report:current'))}
            style={styles.history}
            last
          />

          <SecHead title={t('What this means')} />
          <Text style={measureStyles.p}>{t(getMarkerExplanation(marker.marker_id))}</Text>

          {retest && (
            <View style={styles.retest}>
              <Ionicons name="calendar-outline" size={15} color={FINE.mute} />
              <Text style={styles.retestText}>
                {t('Suggested retest in {n} months', { n: retest.months })} — {retestReason}
              </Text>
            </View>
          )}

          {retest &&
            (testBooked ? (
              <View style={styles.booked}>
                <Ionicons name="checkmark" size={16} color={FINE.jade} />
                <Text style={styles.bookedText}>{t("Noted — a real booking flow isn't wired up in this prototype yet.")}</Text>
              </View>
            ) : (
              <FineButton label={t('Book a new test')} onPress={() => setTestBooked(true)} style={styles.book} />
            ))}

          <Text style={[fine.note, styles.disclaimer]}>{t('A value out of range is not a diagnosis. Your doctor puts it in context.')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  notFound: { ...fine.note, textAlign: 'center', marginTop: 40 },
  gauge: { marginTop: 14 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  trendText: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 12.5, lineHeight: 18 },
  history: { marginTop: 10, borderTopWidth: 1, borderTopColor: FINE.line },
  retest: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: FINE.line },
  retestText: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 13, lineHeight: 19 },
  book: { marginTop: 18 },
  booked: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 18 },
  bookedText: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 13, lineHeight: 19 },
  disclaimer: { marginTop: 20 },
});
