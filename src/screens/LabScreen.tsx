import React, { useCallback, useMemo } from 'react';
import { TourTarget } from '@/components/tour/TourTarget';
import { makeTourScroll } from '@/components/tour/tourStore';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { getRangeStatus } from '@/utils/rangeStatus';
import { countParts, DonutLegend, FineDonut, LabGauge } from '@/components/fine/FineLab';
import { SpecialistCarousel } from '@/components/SpecialistCarousel';
import { KuovaAgeSection } from '@/components/KuovaAgeSection';
import { FirstAnalysisCard } from '@/components/FirstAnalysisCard';
import { Chev, FRow, SecHead, TabHead } from '@/components/fine/Fine';
import { LAB_CENTERS } from '@/data/labCenters';
import { dateLocale, t, tn } from '@/i18n';
import { holdTabsProps } from '@/constants/tabs';
import { categoryLabel } from '@/utils/reportDisplay';
import { isStale, markerSummaries, pointsFromReports, pointsFromUploads, stateCounts } from '@/logic/labMarkers';
import type { ExtractedParametro } from '@/types/labReport';
import { mockUpcomingAnalyses } from '@/data/mockData';
import { showSamples } from '@/data/dataMode';
import { useSections } from '@/data/appPrefs';
import { labAppointmentEvents } from '@/data/labAppointments';
import { consultationEvents } from '@/data/consultations';
import { buildSchedule, SCHEDULE_COLORS, type ScheduleEvent } from '@/data/schedule';
import { LabUpload, labUploadRepository } from '@/data/labUploads';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { getMarkerValueTextEn } from '@/data/reportContentEn';
import { markerHref } from '@/utils/markerLinks';
import { FINE, ff, fine } from '@/theme/fine';
import { FineGlyph } from '@/components/fine/FineMeasure';
import { reportObservations } from '@/logic/reportObservations';
import {
  labReports,
  flaggedMarkers,
  formatReportDate,
  markerNameEn,
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
const paramCounts = (params: ExtractedParametro[]) => {
  let inRange = 0;
  let out = 0;
  for (const p of params) {
    if (typeof p.valor !== 'number') continue;
    const st = getRangeStatus(p.valor, p.rango_min, p.rango_max);
    if (st === 'en_rango') inRange++;
    else if (st !== 'sin_rango') out++;
  }
  return { inRange, out };
};
const uploadCounts = (u: LabUpload) => paramCounts(u.data.secciones.flatMap((sec) => sec.parametros));

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
  // Tus biomarcadores: el último valor de cada uno (de todas tus analíticas), cuántos en rango y cuántos fuera, y cuántos
  // son de hace más de un año
  const values = useMemo(() => {
    const list = markerSummaries([...pointsFromUploads(uploads), ...pointsFromReports(reports)]);
    return { list, counts: stateCounts(list), stale: list.filter((v) => isStale(v.latest.date)).length };
  }, [uploads, reports]);

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
          {/* 3. Tu último informe: el recuento y TODO lo que conviene mirar, con su línea de rango. La cabecera y el
              rosco abren las observaciones (sin el enlace «Informe completo»: fundador, 2026-11-18, «sobra»); cada marcador, su ficha con todos sus valores (fundador, 2026-11-17:
              «Pon todos los que estén para revisar. Al pinchar en ellos, llévame al detalle de ese marcador […] Al
              informe total quiero ir cuando pinche en "tu último informe"») */}
          {hasAny && (
            <>
              <SecHead
                title={t('Your latest report')}
                onPress={latestReport ? () => openReport(latestReport.id) : undefined}
              />
              {latestReport ? (
                (() => {
                  const { id, title, lab, report } = latestReport;
                  const counts = reportCounts(report);
                  const flagged = flaggedMarkers(report, Infinity);
                  const obs = reportObservations(report);
                  const areas = report.sections
                    .map((sec) => ({
                      id: sec.category_id,
                      label: categoryLabel(sec.category_id),
                      total: sec.markers.length,
                      inRange: sec.markers.filter((m) => m.flag === 'en_rango').length,
                    }))
                    .filter((a) => a.inRange < a.total);
                  return (
                    <>
                      <ReportRing
                        inRange={counts.inRange}
                        review={counts.needsReview}
                        note={`${formatReportDate(report.test_date)} · ${lab}${title ? ` · ${title}` : ''}`}
                        areas={areas}
                        onPress={() => openReport(id)}
                        observation={obs.compared ? { improved: obs.backInRange.length + obs.closer.length, worse: obs.worse.length } : undefined}
                      />
                      {flagged.length > 0 && <Text style={[fine.kicker, styles.flaggedHead]}>{t('Markers that need a look')}</Text>}
                      {flagged.map((m) => {
                        // Lo que conviene mirar, con su línea de rango fina (sin rojos). Fuera del rango, el valor en oro y
                        // «Por encima/debajo»; dentro pero cerca del límite, en marfil y dicho así, como en su ficha (que
                        // pone «En rango»)
                        const v = typeof m.value === 'number' ? m.value : Number(m.value);
                        const near = m.flag === 'limite_alto' || m.flag === 'limite_bajo';
                        const status = near ? t('In range, close to the limit') : m.flag === 'bajo' ? t('Below range') : t('Above range');
                        return (
                          <TouchableOpacity
                            key={m.marker_id}
                            style={fine.row}
                            onPress={() => router.push(markerHref(m.marker_id, `report:${id}`))}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.paramName} numberOfLines={1}>
                                {markerNameEn(m)}
                              </Text>
                              <Text style={[styles.paramValue, !near && { color: FINE.gold }]}>
                                {getMarkerValueTextEn(m.value, m.unit)}
                                <Text style={styles.paramStatus}> · {status}</Text>
                              </Text>
                            </View>
                            <LabGauge value={Number.isNaN(v) ? null : v} low={m.range.low} high={m.range.high} style={styles.gauge} />
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                })()
              ) : lastUpload ? (
                <UploadRow u={lastUpload} />
              ) : null}
              {/* Más separado de los roscos de las áreas y más cerca de la raya de la sección siguiente (fundador, 2026-11-18) */}
              <FRow
                title={t('Talk it over with a doctor')}
                onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}
                last
                style={styles.doctorRow}
              />
            </>
          )}

          {/* 4. Tus biomarcadores: todos los valores de tus análisis, con su historia */}
          {hasAny && (
            <>
              {/* Con el rosco de todos tus valores (en rango / fuera) y cuántos son de hace más de un año (fundador,
                  2026-11-18: «quisiera que aparezca el circulito también y que tenga una especie de "alarma de
                  caducidad", máximo 1 año») */}
              {/* «110 marcadores» y debajo cuántos en rango y cuántos fuera (fundador, 2026-11-18); «Ver todos» arriba */}
              <SecHead
                title={t('Your biomarkers')}
                more={values.list.length > 0 ? t('See all') : undefined}
                onMore={values.list.length > 0 ? () => router.push('/biomarkers') : undefined}
              />
              {values.list.length > 0 ? (
                <TouchableOpacity
                  style={[fine.row, styles.valuesRow]}
                  onPress={() => router.push('/biomarkers')}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('{n} markers', { n: values.list.length })}. ${t('See all your values')}`}
                >
                  <FineDonut size={54} stroke={3} inRange={values.counts.in} review={values.counts.out} label={`${values.list.length}`} />
                  <View style={{ flex: 1 }}>
                    <Text style={fine.rowTitle}>{t('{n} markers', { n: values.list.length })}</Text>
                    <Text style={fine.rowSub}>
                      {countParts(values.counts).map((p, i) => (
                        <Text key={p.text} style={{ color: p.color }}>
                          {i > 0 ? ' · ' : ''}
                          {p.text}
                        </Text>
                      ))}
                    </Text>
                    {values.stale > 0 && (
                      <Text style={[fine.rowSub, { color: FINE.gold }]}>{tn(values.stale, '1 value is over a year old', '{n} values are over a year old')}</Text>
                    )}
                  </View>
                  <Chev />
                </TouchableOpacity>
              ) : (
                <FRow
                  title={t('See all your values')}
                  sub={t('Each one against the range of its lab, with its history')}
                  onPress={() => router.push('/biomarkers')}
                  last
                />
              )}
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
          {/* Subir un informe que ya tienes va en Tus archivos (fundador, 2026-11-16) */}
          <TourTarget id="lab.upload" scroll={tourScroll}>
            <FRow title={t('Your files')} sub={t('Lab reports and everything you upload')} onPress={() => router.push('/files')} />
          </TourTarget>
          {olderReports.map((r) => (
            <FRow key={r.id} title={r.title} sub={`${formatReportDate(r.report.test_date)} · ${r.lab}`} onPress={() => openReport(r.id)} />
          ))}
          <FRow
            title={t('Your evolution report')}
            sub={t('How your habits and markers have changed. Create it and share it.')}
            onPress={() => router.push('/habits')}
            last
          />

          {/* 8. Pedir: qué análisis, el catálogo y laboratorios cerca. Subir un informe está en Tus archivos; seguir tu
              pedido, fuera mientras no funcione (fundador, 2026-11-16) */}
          {/* «Pedir» a secas se quedaba corto (fundador, 2026-11-18: «me gusta más "Pedir un análisis"») */}
          <SecHead title={t('Order a test')} />
          <FRow title={t('Not sure which test to order?')} sub={t('4 quick questions')} onPress={() => router.push('/test-finder')} />
          <FRow title={t('Test catalogue')} onPress={() => router.push('/store')} />
          <FRow
            title={t('Labs near you')}
            sub={t('{n} labs where you can give your sample', { n: LAB_CENTERS.length })}
            onPress={() => router.push('/book-lab')}
            last
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Tu último informe en Análisis, como «Tu informe» del prototipo (fundador, 2026-11-18, con su captura: «deberíamos
// tener algo tal que así»): el rosco con su leyenda, debajo la fecha y el laboratorio y, en roscos pequeños, las áreas
// con algo que revisar. El mismo día (fundador): dentro del rosco, el total de marcadores («quiero que pongas el total
// de marcadores», no «103 de 110 en rango»); solo el rosco grande abre las observaciones («el detalle de hierro,
// metabolismo… no quiero que deje pinchar, que pinche en los 110 de arriba»), y debajo, en una línea, cuántos han
// mejorado y si alguno ha empeorado desde la analítica anterior (src/logic/reportObservations.ts)
type ReportArea = { id: string; label: string; inRange: number; total: number };
function ReportRing({
  inRange,
  review,
  note,
  areas,
  onPress,
  observation,
}: {
  inRange: number;
  review: number;
  note: string;
  areas: ReportArea[];
  onPress: () => void;
  observation?: { improved: number; worse: number };
}) {
  return (
    <>
      <TouchableOpacity style={styles.ringRow} onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
        <FineDonut size={116} stroke={5} inRange={inRange} review={review} label={`${inRange + review}`} />
        <View style={{ flex: 1 }}>
          <DonutLegend inRange={inRange} review={review} />
        </View>
        <Chev />
      </TouchableOpacity>
      <Text style={[fine.note, { marginTop: 4 }]}>{note}</Text>
      {observation && (
        <View style={styles.obsRow}>
          <FineGlyph name="up" size={15} color={observation.improved ? FINE.jade : FINE.mute} />
          <Text style={styles.obsText}>
            {tn(observation.improved, '{n} has improved significantly', '{n} have improved significantly')}
            <Text style={{ color: observation.worse ? FINE.gold : FINE.mute }}>
              {' · '}
              {observation.worse ? tn(observation.worse, '{n} has worsened', '{n} have worsened') : t('none has worsened')}
            </Text>
          </Text>
        </View>
      )}
      {areas.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areaScroll} contentContainerStyle={styles.areaRow} {...holdTabsProps}>
          {areas.map((a) => (
            <View
              key={a.id}
              style={styles.area}
              accessible
              accessibilityLabel={`${a.label}: ${t('{n} in range', { n: a.inRange })} · ${t('{n} need a look', { n: a.total - a.inRange })}`}
            >
              <FineDonut size={60} stroke={3} inRange={a.inRange} review={a.total - a.inRange} label={`${a.inRange}/${a.total}`} />
              <Text style={styles.areaLabel} numberOfLines={2}>
                {a.label}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </>
  );
}

// La última analítica subida por ti, igual: el rosco con su recuento (en rango / fuera), de cuándo es y sus
// secciones con algo que revisar
function UploadRow({ u }: { u: LabUpload }) {
  const router = useRouter();
  const c = uploadCounts(u);
  const areas = u.data.secciones
    .map((sec, i) => {
      const n = paramCounts(sec.parametros);
      return { id: `${i}`, label: sec.titulo, inRange: n.inRange, total: n.inRange + n.out };
    })
    .filter((a) => a.total > 0 && a.inRange < a.total);
  return (
    <ReportRing
      inRange={c.inRange}
      review={c.out}
      note={`${u.testDate ? formatReportDate(u.testDate) : formatReportDate(u.createdAt.slice(0, 10))} · ${t('User upload')}${u.labName ? ` · ${u.labName}` : ''}`}
      areas={areas}
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
  paramValue: { ...ff('regular'), color: FINE.ivory, fontSize: 12.5, marginTop: 1, fontVariant: ['tabular-nums'] },
  paramStatus: { ...ff('regular'), color: FINE.mute },
  gauge: { width: 96 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingTop: 6 },
  // «17 han mejorado de forma significativa · ninguno ha empeorado», bajo la fecha
  obsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  obsText: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 13.5, lineHeight: 19 },
  // Los roscos de las áreas, de borde a borde de la pantalla
  areaScroll: { marginHorizontal: -20, marginTop: 14 },
  areaRow: { paddingHorizontal: 20, gap: 14 },
  area: { width: 72, alignItems: 'center', gap: 6 },
  areaLabel: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 14, textAlign: 'center' },
  flaggedHead: { marginTop: 18, marginBottom: 2 },
  doctorRow: { marginTop: 14, marginBottom: -16 }, // más aire arriba (roscos) que abajo (la raya)
  valuesRow: { gap: 14, borderBottomWidth: 0 },
  agendaDot: { width: 7, height: 7, borderRadius: 4 },
});
