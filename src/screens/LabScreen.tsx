import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getRangeStatus } from '@/utils/rangeStatus';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DonutChart } from '@/components/DonutChart';
import { MarkerRangeBar } from '@/components/MarkerRangeBar';
import { TileMap } from '@/components/TileMap';
import { LAB_CENTERS } from '@/data/labCenters';
import { t } from '@/i18n';
import { Colors } from '@/constants/colors';
import { TAB } from '@/constants/tabs';
import { mockUpcomingAnalyses } from '@/data/mockData';
import { showSamples } from '@/data/dataMode';
import { labAppointmentEvents } from '@/data/labAppointments';
import type { ScheduleEvent } from '@/data/schedule';
import { LabUpload, labUploadRepository } from '@/data/labUploads';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { getMarkerValueTextEn } from '@/data/reportContentEn';
import {
  labReports,
  flagColor,
  flaggedMarkers,
  formatReportDate,
  markerNameEn,
  rangePosition,
  reportCounts,
} from '@/utils/labReportView';

const formatShortDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getDate()}/${date.getMonth() + 1}`;
};

// Recuento en rango / fuera de rango de una analítica subida (con los rangos del propio laboratorio;
// "< 200" cuenta como rango). Lo que no trae ninguna referencia no suma en ninguno de los dos.
const uploadCounts = (u: LabUpload) => {
  let inRange = 0;
  let out = 0;
  for (const sec of u.data.secciones)
    for (const p of sec.parametros) {
      if (typeof p.valor !== 'number') continue;
      const st = getRangeStatus(p.valor, p.rango_min, p.rango_max);
      if (st === 'en_rango') inRange++;
      else if (st !== 'sin_rango') out++;
    }
  return { inRange, out };
};

export const LabScreen = () => {
  const router = useRouter();
  const [uploads, setUploads] = useDeepState<LabUpload[]>([]);
  // Citas de extracción reservadas (las de verdad; en las cuentas de prueba, además, las de ejemplo)
  const [draws, setDraws] = useDeepState<ScheduleEvent[]>([]);
  const samples = showSamples();
  const reports = labReports();
  useReloadOnFocus(
    useCallback(async () => {
      setUploads(await labUploadRepository.getAll().catch(() => []));
      const today = new Date().toISOString().slice(0, 10);
      setDraws((await labAppointmentEvents().catch(() => [])).filter((e) => e.date >= today));
    }, [setUploads, setDraws]),
  );

  const openReport = (id: 'current' | 'baseline') => {
    // El informe más reciente abre el recorrido completo (resumen + plan);
    // los anteriores, la vista de resultados por secciones.
    if (id === 'current') router.push('/report-summary');
    else router.push({ pathname: '/lab-report', params: { id } });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Lab')} />

        {/* El plan personalizado vive en Today ("Tu plan"), no en Lab (fundador, 2026-10-17) */}
        <Text style={styles.sectionTitle}>{t('Upcoming Analysis')}</Text>
        <View style={styles.sectionBlock}>
          {draws.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={styles.upcomingCard}
              onPress={() => router.push({ pathname: '/lab-appointment', params: { id: e.id } })}
              activeOpacity={0.85}
            >
              <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingName}>{e.title}</Text>
                <Text style={styles.upcomingDesc} numberOfLines={2}>{e.start ? `${e.start} · ` : ''}{e.detail}</Text>
              </View>
              <View style={styles.upcomingRight}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{formatShortDate(e.date)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
          {!samples && draws.length === 0 && (
            <Text style={styles.emptyText}>{t('Nothing on the way. When you order a test or book a blood draw, you will see it here.')}</Text>
          )}
          {samples && mockUpcomingAnalyses.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.upcomingCard}
              onPress={() => router.push({ pathname: '/upcoming-analysis', params: { id: item.id } })}
              activeOpacity={0.85}
            >
              <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingName}>{item.nombre}</Text>
                <Text style={styles.upcomingDesc}>{item.descripcion}</Text>
              </View>
              <View style={styles.upcomingRight}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{formatShortDate(item.fecha)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Entre las analíticas de la suscripción y los resultados: ayuda para elegir qué pedir */}
        <View style={styles.finderCard}>
          <View style={styles.finderHead}>
            <View style={styles.finderIcon}>
              <Ionicons name="help-buoy-outline" size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.finderTitle}>{t('Feeling different and not sure which test to order?')}</Text>
              <Text style={styles.finderSub}>{t('Answer 4 quick questions or ask a doctor.')}</Text>
            </View>
          </View>
          <View style={styles.finderButtons}>
            <TouchableOpacity
              style={[styles.finderBtn, styles.finderBtnGhost]}
              onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}
            >
              <Ionicons name="medkit-outline" size={17} color={Colors.accent} />
              <Text style={[styles.finderBtnText, { color: Colors.accent }]}>{t('Talk to a specialist')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finderBtn} onPress={() => router.push('/test-finder')}>
              <Ionicons name="list-outline" size={17} color={Colors.background} />
              <Text style={styles.finderBtnText}>{t('Take this short quiz')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('Lab Results')}</Text>
        <View style={styles.sectionBlock}>
          {reports.length === 0 && uploads.length === 0 && (
            <Text style={styles.emptyText}>{t('No lab results yet. Upload one you already have (PDF or photo) and Kuova will read it for you.')}</Text>
          )}
          {reports.map(({ id, title, lab, report }) => {
            const counts = reportCounts(report);
            const flagged = flaggedMarkers(report);
            return (
              <TouchableOpacity key={id} style={styles.resultCard} onPress={() => openReport(id)} activeOpacity={0.85}>
                <View style={styles.resultTop}>
                  <DonutChart
                    size={58}
                    strokeWidth={7}
                    segments={[
                      { value: counts.inRange, color: Colors.ok },
                      { value: counts.needsReview, color: Colors.attention },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{title}</Text>
                    <Text style={styles.resultDate}>
                      {formatReportDate(report.test_date)}
                      <Text style={styles.resultLab}> · {lab}</Text>
                    </Text>
                    <Text style={styles.resultCounts}>
                      <Text style={{ color: Colors.ok }}>{t('{n} in range', { n: counts.inRange })}</Text>
                      {'  ·  '}
                      <Text style={{ color: Colors.attention }}>{t('{n} need a look', { n: counts.needsReview })}</Text>
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>

                {flagged.length > 0 && (
                  <View style={styles.paramsList}>
                    {flagged.map((m) => {
                      const pos = rangePosition(m);
                      return (
                        <View key={m.marker_id} style={styles.paramRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.paramText} numberOfLines={1}>
                              {markerNameEn(m)}
                            </Text>
                            <Text style={[styles.paramValue, { color: flagColor(m) }]}>
                              {getMarkerValueTextEn(m.value, m.unit)}
                            </Text>
                          </View>
                          {pos !== null && <MarkerRangeBar position={pos} color={flagColor(m)} />}
                        </View>
                      );
                    })}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {uploads.map((u) => {
            const c = uploadCounts(u);
            return (
              <TouchableOpacity
                key={u.id}
                style={styles.resultCard}
                onPress={() => router.push({ pathname: '/progress', params: { upload: u.id } })}
                activeOpacity={0.85}
              >
                <View style={styles.resultTop}>
                  <DonutChart
                    size={58}
                    strokeWidth={7}
                    segments={[
                      { value: c.inRange, color: Colors.ok },
                      { value: c.out, color: Colors.attention },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{t('Uploaded analysis')}</Text>
                    <Text style={styles.resultDate}>
                      {u.testDate ? formatReportDate(u.testDate) : formatReportDate(u.createdAt.slice(0, 10))}
                      <Text style={styles.resultLab}> · {t('User upload')}{u.labName ? ` · ${u.labName}` : ''}</Text>
                    </Text>
                    <Text style={styles.resultCounts}>
                      <Text style={{ color: Colors.ok }}>{t('{n} in range', { n: c.inRange })}</Text>
                      {'  ·  '}
                      <Text style={{ color: Colors.attention }}>{t('{n} need a look', { n: c.out })}</Text>
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Laboratorios cerca: el mapa de tu zona; tocarlo abre la reserva de cita */}
        <Text style={styles.sectionTitle}>{t('Find a lab near you')}</Text>
        <View style={styles.mapCard}>
          <TileMap points={LAB_CENTERS} height={200} onSelect={() => router.push('/book-lab')} />
          <TouchableOpacity style={styles.mapFooter} onPress={() => router.push('/book-lab')} activeOpacity={0.85}>
            <Ionicons name="location-outline" size={18} color={Colors.accent} />
            <Text style={styles.mapFooterText}>{t('{n} labs where you can give your sample', { n: LAB_CENTERS.length })}</Text>
            <Text style={styles.mapFooterLink}>{t('Book')}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.requestButton} onPress={() => router.push('/store')}>
          <Ionicons name="flask-outline" size={20} color={Colors.background} />
          <Text style={styles.requestButtonText}>{t('Request a new test')}</Text>
        </TouchableOpacity>


        <TouchableOpacity style={styles.uploadButton} onPress={() => router.push('/upload-test')}>
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.accent} />
          <Text style={styles.uploadButtonText}>{samples ? t('Upload lab report (test)') : t('Upload a lab report you already have')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  finderCard: {
    marginHorizontal: 20,
    marginTop: -8,
    marginBottom: 28,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    gap: 14,
  },
  finderHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  finderIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  finderTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  finderSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  finderButtons: { flexDirection: 'row', gap: 10 },
  finderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  finderBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.accent },
  finderBtnText: { color: Colors.background, fontSize: 13, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  mapCard: {
    marginHorizontal: 20,
    marginBottom: 28,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  mapFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  mapFooterText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  mapFooterLink: { color: Colors.accent, fontSize: 14, fontWeight: '800' },
  sectionBlock: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 28,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  upcomingCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upcomingLeft: {
    flex: 1,
    marginRight: 12,
  },
  upcomingName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  upcomingDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  upcomingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateBadge: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateBadgeText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  resultName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  resultDate: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  resultLab: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  resultCounts: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    color: Colors.textMuted,
  },
  paramsList: {
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  paramText: {
    color: Colors.textPrimary,
    fontSize: 13,
  },
  paramValue: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    marginHorizontal: 20,
  },
  requestButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 30,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 12,
  },
  uploadButtonText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
