// Tu semana, en grande, arriba de Plan (fundador, 2026-11-16: «al pinchar en Semana te lleva a Plan y ahí
// tendría que haber alguna métrica que aglutinase»; antes Plan repetía las tres líneas de Hoy). Es el mismo
// círculo dorado de «Semana» de Hoy, más grande, con lo que lleva cada área al lado, los días que quedan y la
// semana pasada; debajo, tus metas de cada área (que se tocan para entrar) y, día a día, cuánto hiciste de tus
// metas diarias.
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TourTarget } from '@/components/tour/TourTarget';
import type { TourScroll } from '@/components/tour/tourStore';
import { Colors } from '@/constants/colors';
import { GlowRing, ringTones } from '@/components/GlowRing';
import { AREAS, AREA_NAME, areaScore, dayFills, rangeText, weekScore, weekdayLetter } from '@/logic/metas';
import type { Area, MetasState, ValuesById, Week } from '@/logic/metas';
import { AREA_RING } from './MetaParts';
import { CometLine } from '@/components/CometLine';
import { FINE, ff, fine } from '@/theme/fine';
import { t } from '@/i18n';

const pctOf = (f: number | null) => (f == null ? null : Math.round(f * 100));

export function WeekHero({
  s,
  week,
  vals,
  known,
  last,
  names,
  onArea,
  tourScroll,
}: {
  s: MetasState;
  week: Week;
  vals: ValuesById;
  known: Record<string, boolean>;
  last: number | null; // la semana pasada, 0..1 (null: no la empezaste o no hay datos)
  names: Record<Area, string>; // las metas de cada área, en corto («Pasos · Cardio · Fuerza»)
  onArea: (a: Area) => void;
  tourScroll?: TourScroll;
}) {
  const tones = ringTones(Colors.gold);
  const total = pctOf(weekScore(s, vals, week, known));
  const range = rangeText(week.days[Math.min(week.from, 6)], week.days[6]);
  const left = week.current ? 6 - week.to : 0;
  const fills = dayFills(s, vals, week);
  const hasDaily = fills.some((f) => f != null);
  const T = week.current ? week.to : -1;
  const lastPct = pctOf(last);

  return (
    <View>
      <View style={styles.hero}>
        <View accessible accessibilityLabel={t('Your week: {n} percent', { n: total ?? 0 })}>
          <GlowRing progress={(total ?? 0) / 100} colors={tones} size={132} stroke={6}>
            <Text style={styles.num}>
              {total ?? '—'}
              {total != null && <Text style={styles.sign}> %</Text>}
            </Text>
            <Text style={styles.ringSub}>{t('of your week')}</Text>
          </GlowRing>
        </View>
        <View style={styles.side}>
          <Text style={styles.range}>
            {range.charAt(0).toUpperCase() + range.slice(1)}
            {week.current ? ` · ${left === 0 ? t('last day') : left === 1 ? t('1 day left') : t('{n} days left', { n: left })}` : ''}
          </Text>
          {lastPct != null && <Text style={styles.last}>{t('Last week: {n} %', { n: lastPct })}</Text>}
        </View>
      </View>

      {/* Tus metas, justo debajo del círculo: cada área con lo que lleva esta semana en su línea cometa (estrecha al
          principio y con el punto de luz en la cabeza, como los aros) y sus metas en corto; se toca para entrar.
          Antes había aquí las tres barras y, más abajo, «Tus metas» con las mismas tres áreas (fundador,
          2026-11-16: «eso son tus metas, no lo repitas… debajo del círculo principal pueden aparecer "Tus metas"
          y ya te lo ahorras después») */}
      <Text style={styles.areasHead} accessibilityRole="header">
        {t('Your targets')}
      </Text>
      <View>
        {AREAS.map((a, i) => {
          const f = areaScore(s, a, vals, week, known);
          const p = pctOf(f);
          return (
            <TourTarget key={a} id={`plan.targets.${a}`} scroll={tourScroll}>
              <TouchableOpacity
                style={[styles.area, i === AREAS.length - 1 && styles.areaLast]}
                onPress={() => onArea(a)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${t(AREA_NAME[a])}: ${p == null ? t('No data') : `${p} %`}. ${names[a] || t('No targets')}`}
              >
                <View style={styles.areaRow}>
                  <Text style={styles.areaName} numberOfLines={1}>
                    {t(AREA_NAME[a])}
                  </Text>
                  <Text style={styles.areaPct}>{p == null ? '—' : `${p} %`}</Text>
                  <Ionicons name="chevron-forward" size={15} color={FINE.mute} />
                </View>
                <Text style={styles.areaSub} numberOfLines={1}>
                  {names[a] || t('No targets')}
                </Text>
                <CometLine progress={f ?? 0} colors={AREA_RING[a]} thickness={3.5} style={styles.comet} />
              </TouchableOpacity>
            </TourTarget>
          );
        })}
      </View>

      {/* Día a día: un círculo por día con lo hecho de tus metas diarias; los que no cuentan, apagados */}
      {hasDaily && (
        <>
          <View style={styles.days}>
            {week.days.map((d, i) => {
              const f = fills[i];
              const today = i === T;
              return (
                <View
                  key={d}
                  style={styles.day}
                  accessible
                  accessibilityLabel={`${weekdayLetter(d)}: ${f == null ? t('No data') : `${Math.round(f * 100)} %`}`}
                >
                  {f == null ? <View style={[styles.empty, i > T && week.current && styles.future]} /> : <GlowRing progress={f} colors={tones} size={34} stroke={3} />}
                  <Text style={[styles.letter, today && styles.letterToday]}>{weekdayLetter(d)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={fine.note}>{t('Each circle is a day: how much of your daily targets you did.')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 4 },
  num: { ...ff('light'), fontSize: 38, lineHeight: 44, color: FINE.ivory, fontVariant: ['tabular-nums'] },
  sign: { ...ff('regular'), fontSize: 15, color: FINE.mute },
  ringSub: { ...ff('regular'), fontSize: 11, color: FINE.mute, marginTop: -2 },
  side: { flex: 1, gap: 7 },
  range: { ...ff('regular'), fontSize: 12.5, lineHeight: 17, color: FINE.mute, marginBottom: 2 },
  areasHead: { ...fine.kicker, marginTop: 22, marginBottom: 2 },
  // Sin raya entre filas: la línea cometa ya hace de separación, como en las metas del día de Hoy
  area: { paddingTop: 12, paddingBottom: 2 },
  areaLast: {},
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  areaName: { ...ff('medium'), flex: 1, fontSize: 15, color: FINE.ivory },
  areaSub: { ...ff('regular'), fontSize: 12.5, color: FINE.mute, marginTop: 2 },
  // La línea cometa deja sitio a su brillo a los lados: se saca ese margen para que empiece donde el nombre
  comet: { marginHorizontal: -8, marginTop: -4, marginBottom: -6 },
  areaPct: { ...ff('regular'), fontSize: 13.5, color: FINE.mute, fontVariant: ['tabular-nums'] },
  last: { ...ff('regular'), fontSize: 12.5, color: FINE.mute, marginTop: 2 },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  day: { alignItems: 'center', gap: 6, width: 38 },
  empty: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: FINE.line },
  future: { borderStyle: 'dashed' },
  letter: { ...ff('regular'), fontSize: 11.5, color: FINE.mute },
  letterToday: { ...ff('semibold'), color: FINE.ivory },
});
