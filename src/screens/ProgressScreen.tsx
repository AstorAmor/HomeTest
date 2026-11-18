import { dateLocale, t } from '@/i18n';
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LabUpload, labUploadRepository } from '@/data/labUploads';
import { compareUpload, ChangeVerdict, ProgressResult, VERDICT_LABEL } from '@/utils/progress';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useAfterTransition } from '@/hooks/useAfterTransition';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSections } from '@/data/appPrefs';
import { LabValuesList } from '@/components/LabValuesList';
import { OutOfRangeSummary } from '@/components/OutOfRangeSummary';
import { FChips } from '@/components/fine/FineForm';
import { FineButton, FineLink } from '@/components/fine/FineMeasure';
import { getRangeStatus, rangeText } from '@/utils/rangeStatus';
import { TAB, tabHref } from '@/constants/tabs';
import { FINE, ff, fine } from '@/theme/fine';

// Sin rojos (2026-11-16): lo que mejora en jade, lo que sigue igual apagado y lo que conviene vigilar en oro
const VERDICT_COLOR: Record<ChangeVerdict, string> = {
  back_in_range: FINE.jade,
  improving: FINE.jade,
  still_in_range: FINE.mute,
  stable_out: FINE.gold,
  worsening: FINE.gold,
  newly_out: FINE.gold,
};

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

// Una analítica subida, en dos pestañas:
// - Resultados: cada marcador con su valor y si está en rango según el propio laboratorio (lo
//   mismo que se vio al escanearla). Es la que se abre desde Lab → Resultados.
// - Progreso ("Ver mi progreso"): qué ha cambiado respecto al último valor conocido de cada
//   marcador. Solo los que se han vuelto a medir. Se abre así después de escanear (?view=progress).
// Desde el 2026-11-16, en fino: las dos pestañas en chips con borde, los recuentos como cifras grandes y ligeras
// sin cajas, y cada valor en una fila con línea fina y su línea de rango.
// Recuento como en Lab: en rango, para revisar (fuera) y sin referencia
const countUpload = (u: LabUpload) => {
  const c = { in: 0, out: 0, none: 0 };
  for (const sec of u.data.secciones)
    for (const p of sec.parametros) {
      if (typeof p.valor !== 'number') continue;
      const st = getRangeStatus(p.valor, p.rango_min, p.rango_max);
      if (st === 'en_rango') c.in++;
      else if (st === 'sin_rango') c.none++;
      else c.out++;
    }
  return c;
};

// La analítica que se abre y su comparación con las anteriores (null si aún no está entre las leídas)
const pick = (all: LabUpload[] | undefined, id: string | undefined): { upload: LabUpload; result: ProgressResult } | null => {
  const u = all?.find((x) => x.id === id);
  if (!all || !u) return null;
  return { upload: u, result: compareUpload(u, all.filter((x) => x.id !== u.id && x.createdAt < u.createdAt)) };
};

// Filas de «Progreso» que se pintan mientras la pantalla se desliza; las demás, al acabar
const FIRST_ROWS = 8;

export const ProgressScreen = () => {
  const show = useSections();
  const router = useRouter();
  const { upload: uploadId, view } = useLocalSearchParams<{ upload: string; view?: string }>();
  // Fundador, 2026-11-18: al abrir el informe desde el rosco de Análisis «lo hace de forma poco fluida». La pantalla
  // esperaba vacía a Supabase (todas las analíticas, cada una con su informe entero) y luego montaba de golpe sus ~60
  // filas mientras se deslizaba. Ahora pinta al momento lo que Análisis ya leyó (peek), durante el deslizamiento solo lo
  // de arriba (recuentos y «Para revisar») y el resto al acabar, con un fundido corto. Al volver, si nada ha cambiado,
  // no se vuelve a dibujar.
  const peeked = useRef<LabUpload[] | undefined>(undefined);
  const [data, setData] = useState(() => pick((peeked.current = labUploadRepository.peek()), uploadId));
  const lastSig = useRef<string | null>(null);
  const settled = useAfterTransition();
  const [showOthers, setShowOthers] = useState(false);
  const [tab, setTab] = useState<'results' | 'progress'>(view === 'progress' ? 'progress' : 'results');
  // Tocar «En rango», «Para revisar» o «Sin referencia» baja a su grupo
  const scrollRef = useRef<ScrollView>(null);
  const groupY = useRef<Partial<Record<'in' | 'out' | 'none', number>>>({});
  const jumpTo = (g: 'in' | 'out' | 'none') => {
    const y = groupY.current[g];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  useReloadOnFocus(
    useCallback(async () => {
      const all = await labUploadRepository.getAll();
      const sig = JSON.stringify(all);
      if (lastSig.current === null && peeked.current) lastSig.current = JSON.stringify(peeked.current);
      if (sig === lastSig.current) return;
      lastSig.current = sig;
      setData(pick(all, uploadId));
    }, [uploadId]),
  );

  if (!data) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Uploaded analysis')} showBack backFallback={tabHref(TAB.analysis)} />
      </SafeAreaView>
    );
  }

  const { upload, result } = data;
  const better = result.changes.filter((c) => c.verdict === 'back_in_range' || c.verdict === 'improving').length;
  const worse = result.changes.filter((c) => c.verdict === 'worsening' || c.verdict === 'newly_out').length;
  const same = result.changes.length - better - worse;
  const counts = countUpload(upload);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Uploaded analysis')} showBack backFallback={tabHref(TAB.analysis)} />
        <Text style={[fine.lead, styles.pad]}>
          {upload.testDate ? shortDate(upload.testDate) : t('Uploaded test')} · {upload.labName ?? t('User upload')}
        </Text>

        <FChips
          options={[
            { id: 'results' as const, label: t('Results') },
            { id: 'progress' as const, label: t('Progress') },
          ]}
          value={tab}
          onChange={setTab}
          style={styles.tabs}
        />

        {tab === 'results' && (
          <>
            <View style={styles.summary}>
              <Stat value={counts.in} label={t('In range')} color={FINE.jade} onPress={() => jumpTo('in')} />
              <Stat value={counts.out} label={t('To review')} color={counts.out ? FINE.gold : FINE.ivory} onPress={() => jumpTo('out')} />
              {counts.none > 0 && <Stat value={counts.none} label={t('No reference')} color={FINE.ivory} onPress={() => jumpTo('none')} />}
            </View>
            {/* Agrupados por estado, en el mismo orden que los recuentos de arriba */}
            <View onLayout={(e) => (groupY.current.out = e.nativeEvent.layout.y)}>
              <OutOfRangeSummary report={upload.data} uploadId={upload.id} />
            </View>
            {settled && (
              <>
                <Animated.View entering={FadeIn.duration(180)} style={styles.pad} onLayout={(e) => (groupY.current.in = e.nativeEvent.layout.y)}>
                  <LabValuesList report={upload.data} group="in" title={t('In range')} uploadId={upload.id} />
                </Animated.View>
                <Animated.View entering={FadeIn.duration(180)} style={styles.pad} onLayout={(e) => (groupY.current.none = e.nativeEvent.layout.y)}>
                  <LabValuesList report={upload.data} group="none" title={t('No reference')} uploadId={upload.id} />
                </Animated.View>
              </>
            )}
          </>
        )}

        {tab === 'progress' && (
          <View style={styles.pad}>
            <Text style={[fine.note, styles.intro]}>
              {t("Compared with the last value we had for each marker. Markers that weren't in this test stay as they were.")}
            </Text>

            <View style={[styles.summary, styles.summaryIn]}>
              <Stat value={better} label={t('Better')} color={better ? FINE.jade : FINE.ivory} />
              <Stat value={same} label={t('No change')} color={FINE.ivory} />
              <Stat value={worse} label={t('To watch')} color={worse ? FINE.gold : FINE.ivory} />
            </View>

            {result.changes.length === 0 && <Text style={fine.note}>{t('None of these markers had an earlier value to compare with.')}</Text>}

            {(settled ? result.changes : result.changes.slice(0, FIRST_ROWS)).map((c, i) => (
              <View key={c.markerId} style={[fine.row, i === 0 && styles.firstRow]}>
                <View style={styles.flex}>
                  <View style={styles.changeHead}>
                    <Text style={[fine.rowTitle, styles.flex]} numberOfLines={2}>
                      {c.name}
                    </Text>
                    <Text style={[styles.verdict, { color: VERDICT_COLOR[c.verdict] }]}>{t(VERDICT_LABEL[c.verdict])}</Text>
                  </View>
                  <View style={styles.values}>
                    <Text style={styles.before}>
                      {c.before} <Text style={styles.unit}>{c.unit}</Text>
                    </Text>
                    <Ionicons name="arrow-forward" size={13} color={FINE.mute} />
                    <Text style={[styles.after, { color: c.afterStatus === 'in' ? FINE.ivory : FINE.gold }]}>
                      {c.after} <Text style={styles.unit}>{c.unit}</Text>
                    </Text>
                  </View>
                  <Text style={fine.rowSub}>
                    {t('Before: {date} ({source})', { date: shortDate(c.beforeDate), source: c.beforeSource })}
                    {rangeText(c.low, c.high) ? ` · ${t('Range: {range}', { range: rangeText(c.low, c.high)! })}` : ''}
                  </Text>
                </View>
              </View>
            ))}

            {(settled || result.changes.length <= FIRST_ROWS) && (result.firstTime.length > 0 || result.notCompared.length > 0) && (
              <TouchableOpacity
                style={styles.othersToggle}
                onPress={() => setShowOthers((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ expanded: showOthers }}
              >
                <Text style={fine.link}>
                  {result.firstTime.length + result.notCompared.length === 1
                    ? t('1 other value not compared')
                    : t('{n} other values not compared', { n: result.firstTime.length + result.notCompared.length })}
                </Text>
                <Ionicons name={showOthers ? 'chevron-up' : 'chevron-down'} size={14} color={FINE.jade} />
              </TouchableOpacity>
            )}
            {showOthers && (
              <View style={styles.others}>
                {result.firstTime.map((f) => (
                  <Text key={`f-${f.name}`} style={styles.otherLine}>
                    {f.name}: {f.value} {f.unit} · {t('first time measured')}
                  </Text>
                ))}
                {result.notCompared.map((n, i) => (
                  <Text key={`n-${n.name}-${i}`} style={styles.otherLine}>
                    {n.name} · {n.reason}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Desde el 2026-11-06 ya no hay «Actualizar mi plan»: la analítica recomienda objetivos (Tus objetivos) y,
          si quieres un plan, lo hace un especialista */}
      <View style={styles.footer}>
        {show('plan') && <FineButton label={t('Review my goals')} onPress={() => router.push('/metas-objetivos')} />}
        <FineLink label={t('Ask a doctor to review it')} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })} />
      </View>
    </SafeAreaView>
  );
};

// Un recuento: la cifra grande y ligera y su nombre pequeño debajo; al tocarlo, baja a su grupo
const Stat = ({ value, label, color, onPress }: { value: number; label: string; color: string; onPress?: () => void }) => (
  <TouchableOpacity
    style={styles.stat}
    onPress={onPress}
    disabled={!onPress || value === 0}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={`${value} · ${label}`}
  >
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={fine.kicker}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 24 },
  pad: { marginHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  tabs: { marginHorizontal: 20, marginTop: 14 },
  intro: { marginTop: 18 },
  summary: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 18 },
  summaryIn: { marginHorizontal: 0, marginBottom: 6 },
  stat: { flex: 1, gap: 2 },
  statValue: { ...fine.num, fontSize: 36, lineHeight: 42 },
  firstRow: { borderTopWidth: 1, borderTopColor: FINE.rule, marginTop: 12 },
  changeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdict: { ...ff('regular'), fontSize: 12.5 },
  values: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  before: { ...ff('light'), color: FINE.mute, fontSize: 17, fontVariant: ['tabular-nums'] },
  after: { ...ff('light'), fontSize: 20, fontVariant: ['tabular-nums'] },
  unit: { ...ff('regular'), fontSize: 11.5, color: FINE.mute },
  othersToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  others: { marginTop: 8, gap: 4 },
  otherLine: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 18 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, gap: 4 },
});
