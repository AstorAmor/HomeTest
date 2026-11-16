import React, { useCallback, useMemo } from 'react';
import { TourTarget } from '@/components/tour/TourTarget';
import { makeTourScroll } from '@/components/tour/tourStore';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { getRangeStatus } from '@/utils/rangeStatus';
import { MarkerRangeBar } from '@/components/MarkerRangeBar';
import { SpecialistCarousel } from '@/components/SpecialistCarousel';
import { KuovaAgeSection } from '@/components/KuovaAgeSection';
import { FirstAnalysisCard } from '@/components/FirstAnalysisCard';
import { Chev, FRow, SecHead, TabHead } from '@/components/fine/Fine';
import { LAB_CENTERS } from '@/data/labCenters';
import { dateLocale, t } from '@/i18n';
import { mockUpcomingAnalyses } from '@/data/mockData';
import { showSamples } from '@/data/dataMode';
import { useSections } from '@/data/appPrefs';
import { labAppointmentEvents } from '@/data/labAppointments';
import { consultationEvents } from '@/data/consultations';
import { buildSchedule, SCHEDULE_COLORS, type ScheduleEvent } from '@/data/schedule';
import { LabUpload, labUploadRepository } from '@/data/labUploads';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { getMarkerValueTextEn } from '@/data/reportContentEn';
import { FINE, ff, fine } from '@/theme/fine';
import {
  labReports,
  flagColor,
  flaggedMarkers,
  formatReportDate,
  markerNameEn,
  rangePosition,
  reportCounts,
} from '@/utils/labReportView';

// Pestaña Análisis (2026-11-16, borradores/app-estructura/ESPECIFICACION.md §5): lo que era Laboratorio, la
// Agenda y la parte de análisis de Mis datos. De arriba abajo: tu próximo análisis (o «Empieza por tu primer
// análisis»), la Edad KUOVA, tu último informe, tus biomarcadores, la agenda, hablar con un especialista, el
// archivo y pedir. El círculo «Semana 8 de 26» llega en la fase 3 (hace falta la fecha del próximo análisis).
// Con el lenguaje fino del prototipo (src/theme/fine.ts): cabeceras pequeñas, filas con línea y letra Inter.

const shortDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

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

const AGENDA_MAX = 3;

export const LabScreen = () => {
  const tourScroll = useMemo(makeTourScroll, []);
  const router = useRouter();
  const show = useSections();
  const [uploads, setUploads] = useDeepState<LabUpload[]>([]);
  // Citas de extracción reservadas (las de verdad; en las cuentas de prueba, además, las de ejemplo)
  const [draws, setDraws] = useDeepState<ScheduleEvent[]>([]);
  // Agenda: lo que viene (pruebas, envíos, resultados, citas en el laboratorio y consultas)
  const [agenda, setAgenda] = useDeepState<ScheduleEvent[]>([]);
  const samples = showSamples();
  const reports = labReports();
  useReloadOnFocus(
    useCallback(async () => {
      setUploads(await labUploadRepository.getAll().catch(() => []));
      const today = new Date().toISOString().slice(0, 10);
      const [lab, consults] = await Promise.all([labAppointmentEvents().catch(() => []), consultationEvents().catch(() => [])]);
      setDraws(lab.filter((e) => e.date >= today));
      setAgenda(
        [...buildSchedule(), ...lab, ...consults]
          .filter((e) => e.date >= today && e.type !== 'sample')
          .sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? ''))),
      );
    }, [setUploads, setDraws, setAgenda]),
  );

  const openReport = (id: 'current' | 'baseline') => {
    // El informe más reciente abre el recorrido completo (resumen + plan);
    // los anteriores, la vista de resultados por secciones.
    if (id === 'current') router.push('/report-summary');
    else router.push({ pathname: '/lab-report', params: { id } });
  };

  const hasAny = reports.length > 0 || uploads.length > 0;
  const upcoming = draws.length > 0 || (samples && mockUpcomingAnalyses.length > 0);
  // Tu último informe: el más reciente de los del laboratorio o, si no hay, la última analítica subida
  const [latestReport, ...olderReports] = reports;
  const lastUpload = [...uploads].sort((a, b) => (b.testDate ?? b.createdAt).localeCompare(a.testDate ?? a.createdAt))[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          <TabHead title={t('Analysis')} lead={t('Your next test, your results and your appointments')} />

          {/* 1. Tu próximo análisis o, sin ninguno todavía, cómo empezar */}
          {upcoming ? (
            <>
              <SecHead title={t('Your next test')} />
              {draws.map((e) => (
                <FRow
                  key={e.id}
                  title={e.title}
                  sub={`${e.start ? `${e.start} · ` : ''}${e.detail ?? ''}`}
                  value={shortDate(e.date)}
                  onPress={() => router.push({ pathname: '/lab-appointment', params: { id: e.id } })}
                />
              ))}
              {samples &&
                mockUpcomingAnalyses.map((item) => (
                  <FRow
                    key={item.id}
                    title={item.nombre}
                    sub={item.descripcion}
                    value={shortDate(item.fecha)}
                    onPress={() => router.push({ pathname: '/upcoming-analysis', params: { id: item.id } })}
                  />
                ))}
            </>
          ) : !hasAny ? (
            <FirstAnalysisCard variant="analysis" />
          ) : null}
        </View>

        {/* 2. Edad KUOVA, con su cobertura (lo que falta para calcularla) */}
        <KuovaAgeSection tourScroll={tourScroll} />

        <View style={styles.pad}>
          {/* 3. Tu último informe: el recuento y lo que conviene mirar, con su línea de rango */}
          {hasAny && (
            <>
              <SecHead title={t('Your latest report')} />
              {latestReport ? (
                (() => {
                  const { id, title, lab, report } = latestReport;
                  const counts = reportCounts(report);
                  const flagged = flaggedMarkers(report);
                  return (
                    <>
                      <TouchableOpacity style={fine.row} onPress={() => openReport(id)} activeOpacity={0.7}>
                        <View style={{ flex: 1 }}>
                          <Text style={fine.rowTitle}>
                            {t('{n} in range', { n: counts.inRange })} · {t('{n} need a look', { n: counts.needsReview })}
                          </Text>
                          <Text style={fine.rowSub}>
                            {formatReportDate(report.test_date)} · {lab}
                            {title ? ` · ${title}` : ''}
                          </Text>
                        </View>
                        <Chev />
                      </TouchableOpacity>
                      {flagged.map((m) => {
                        const pos = rangePosition(m);
                        return (
                          <TouchableOpacity key={m.marker_id} style={fine.row} onPress={() => openReport(id)} activeOpacity={0.7}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.paramName} numberOfLines={1}>
                                {markerNameEn(m)}
                              </Text>
                              <Text style={[styles.paramValue, { color: flagColor(m) }]}>{getMarkerValueTextEn(m.value, m.unit)}</Text>
                            </View>
                            {pos !== null && <MarkerRangeBar position={pos} color={flagColor(m)} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                })()
              ) : lastUpload ? (
                <UploadRow u={lastUpload} />
              ) : null}
              <FRow title={t('Talk it over with a doctor')} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })} last />
            </>
          )}

          {/* 4. Tus biomarcadores: todos los valores de tus análisis, con su historia */}
          {hasAny && (
            <>
              <SecHead title={t('Your biomarkers')} />
              <FRow
                title={t('See all your values')}
                sub={t('Each one against the range of its lab, with its history')}
                onPress={() => router.push('/biomarkers')}
                last
              />
            </>
          )}

          {/* 5. Agenda: lo próximo en lista; el mes entero en «Ver calendario» */}
          <SecHead title={t('Schedule')} more={t('See calendar')} onMore={() => router.push('/schedule')} />
          {agenda.length === 0 ? (
            <Text style={fine.note}>{t('Nothing scheduled.')}</Text>
          ) : (
            agenda.slice(0, AGENDA_MAX).map((e, i, all) => {
              // Las citas de laboratorio abren su ficha; una videoconsulta confirmada, la llamada (como en el calendario)
              const target = (e.type === 'lab' ? { pathname: '/lab-appointment', params: { id: e.id } } : e.action) as Href | undefined;
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[fine.row, i === all.length - 1 && { borderBottomWidth: 0 }]}
                  disabled={!target}
                  onPress={() => target && router.push(target)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.agendaDot, { backgroundColor: SCHEDULE_COLORS[e.type] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={fine.rowTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={fine.rowSub}>
                      {new Date(`${e.date}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })}
                      {e.start ? ` · ${e.start}` : ''}
                    </Text>
                  </View>
                  {target ? <Chev /> : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* 6. Habla con un especialista (antes en Hoy) */}
        {show('specialists') && (
          <>
            <SecHead title={t('Talk to a specialist')} style={styles.padM} />
            <SpecialistCarousel loop onSelect={(s) => router.push({ pathname: '/professionals', params: { role: s.id } })} />
          </>
        )}

        <View style={styles.pad}>
          {/* 7. Archivo: informes, originales y el informe de evolución */}
          <SecHead title={t('Archive')} />
          <FRow title={t('Your files')} sub={t('Lab reports and everything you upload')} onPress={() => router.push('/files')} />
          {olderReports.map((r) => (
            <FRow key={r.id} title={r.title} sub={`${formatReportDate(r.report.test_date)} · ${r.lab}`} onPress={() => openReport(r.id)} />
          ))}
          <FRow
            title={t('Your evolution report')}
            sub={t('How your habits and markers have changed. Create it and share it.')}
            onPress={() => router.push('/habits')}
            last
          />

          {/* 8. Pedir: qué análisis, el catálogo, laboratorios cerca, subir un informe y seguir tu pedido */}
          <SecHead title={t('Order')} />
          <FRow title={t('Not sure which test to order?')} sub={t('4 quick questions')} onPress={() => router.push('/test-finder')} />
          <FRow title={t('Test catalogue')} onPress={() => router.push('/store')} />
          <FRow
            title={t('Labs near you')}
            sub={t('{n} labs where you can give your sample', { n: LAB_CENTERS.length })}
            onPress={() => router.push('/book-lab')}
          />
          <TourTarget id="lab.upload" scroll={tourScroll}>
            <FRow title={samples ? t('Upload lab report (test)') : t('Upload a lab report you already have')} onPress={() => router.push('/upload-test')} />
          </TourTarget>
          <FRow title={t('Track your tests')} onPress={() => router.push('/track-tests')} last />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// La última analítica subida por ti: el recuento (en rango / fuera) y de cuándo es
function UploadRow({ u }: { u: LabUpload }) {
  const router = useRouter();
  const c = uploadCounts(u);
  return (
    <FRow
      title={`${t('{n} in range', { n: c.inRange })} · ${t('{n} need a look', { n: c.out })}`}
      sub={`${u.testDate ? formatReportDate(u.testDate) : formatReportDate(u.createdAt.slice(0, 10))} · ${t('User upload')}${u.labName ? ` · ${u.labName}` : ''}`}
      onPress={() => router.push({ pathname: '/progress', params: { upload: u.id } })}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent', // deja ver el fondo ambiental de las pestañas
  },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  padM: { marginHorizontal: 20 },
  paramName: { ...ff('regular'), color: FINE.ivory, fontSize: 14 },
  paramValue: { ...ff('regular'), fontSize: 12.5, marginTop: 1, fontVariant: ['tabular-nums'] },
  agendaDot: { width: 7, height: 7, borderRadius: 4 },
});
