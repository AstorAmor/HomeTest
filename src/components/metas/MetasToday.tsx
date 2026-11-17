// Tus metas de la semana. Desde las 4 pestañas (2026-11-16) se usa dos veces: en Hoy, solo la enhorabuena (o el
// ánimo) al cerrar la semana (fundador: «Esta semana me sobra»; el círculo «Semana» ya lleva a Plan); en Plan,
// «Tu semana» en una cifra (WeekHero, el círculo «Semana» de Hoy en grande) y «Tus metas» en filas con sus nombres.
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { CometLine } from '@/components/CometLine';
import { AppIcon } from '@/components/HealthIcons';
import { TourTarget } from '@/components/tour/TourTarget';
import type { TourScroll } from '@/components/tour/tourStore';
import { useMetas } from '@/hooks/useMetas';
import { AREAS, AREA_NAME, GOALS, metaText, resolveMeta, reviewClosing, selectedIds, weekScore } from '@/logic/metas';
import { AREA_COLOR, AREA_RING, pct } from './MetaParts';
import { WeekHero } from './WeekHero';
import { FINE, ff, fine } from '@/theme/fine';
import type { Area, Congrats, ReviewArea } from '@/logic/metas';

import { t } from '@/i18n';

// Un brillo suave detrás del bloque, en vez de una caja (rediseño «Emerald Luxury», 2026-11-16)
function SoftGlow({ color }: { color: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={styles.glow}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 && (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <RadialGradient id="weekGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color} stopOpacity={Colors.isLight ? 0.18 : 0.16} />
              <Stop offset="0.55" stopColor={color} stopOpacity={Colors.isLight ? 0.07 : 0.06} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* Cabe entero en su lienzo (más grande que el bloque): se apaga antes del borde, sin esquinas */}
          <Ellipse cx={box.w / 2} cy={box.h / 2} rx={box.w / 2} ry={box.h / 2} fill="url(#weekGlow)" />
        </Svg>
      )}
    </View>
  );
}

// La enhorabuena (o el ánimo) de la semana que se cierra, sin caja. Al tocarla se abre lo que te
// propusiste y lo que hiciste en cada área, con su línea cometa, y una frase para la semana nueva
// (fundador, 2026-11-16: «que todavía hay margen, que no se rinda»; cálido y sin culpa).
function WeekBlock({ congrats, review, onClose }: { congrats: Congrats; review: ReviewArea[] | null; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const go = congrats.tone === 'go';
  const accent = go ? (Colors.isLight ? '#2E9A72' : '#83D6B4') : Colors.gold;
  const canOpen = !!review?.length;
  return (
    <View style={styles.cg}>
      <SoftGlow color={accent} />
      <View style={styles.cgHead}>
        <Ionicons name={go ? 'flash-outline' : 'trophy-outline'} size={20} color={accent} style={styles.cgIcon} />
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => setOpen(!open)}
          activeOpacity={0.8}
          disabled={!canOpen}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Text style={styles.cgTitle}>{congrats.title}</Text>
          <Text style={styles.cgBody}>{congrats.body}</Text>
          {canOpen && (
            <View style={styles.cgMoreRow}>
              <Text style={[styles.cgMore, { color: accent }]}>{open ? t('Hide') : t('See how your week went')}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={accent} />
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} accessibilityLabel={t('Close')} hitSlop={10}>
          <Ionicons name="close" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      {open && review && (
        <View style={styles.rv}>
          {review.map((a) => (
            <View key={a.area} style={styles.rvArea}>
              <View style={styles.rvAreaHead}>
                <Text style={[styles.rvAreaName, { color: AREA_COLOR[a.area] }]}>{t(AREA_NAME[a.area])}</Text>
                <Text style={styles.rvPct}>{a.score == null ? '—' : pct(a.score)}</Text>
              </View>
              <CometLine progress={a.score ?? 0} colors={AREA_RING[a.area]} thickness={3.5} style={styles.rvLine} />
              {a.rows.map((r) => (
                <View key={r.id} style={styles.rvRow}>
                  <Text style={styles.rvTarget}>{r.target}</Text>
                  <Text style={styles.rvDone}>{r.done}</Text>
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.rvClosing}>{reviewClosing(congrats.tone)}</Text>
        </View>
      )}
    </View>
  );
}

export function MetasToday({ tourScroll, variant = 'today' }: { tourScroll?: TourScroll; variant?: 'today' | 'plan' }) {
  const today = variant === 'today';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, week, vals, known, congrats, review, update, weekView } = useMetas();
  const [info, setInfo] = useState(false);
  // En Plan, la semana pasada (para compararla con esta)
  const lastView = useMemo(() => (today ? null : weekView(-1)), [today, weekView]);
  if (!data) return null;
  const s = data.state;
  const none = selectedIds(s).length === 0;
  const last = lastView && lastView.week.from <= 6 ? weekScore(s, lastView.vals, lastView.week, lastView.known) : null;
  const go = (path: '/metas' | '/metas-objetivos') => {
    setInfo(false);
    router.push(path);
  };
  const openArea = (a: Area) =>
    router.push(s.sel[a].length ? { pathname: '/metas-area', params: { area: a } } : { pathname: '/metas-elegir', params: { area: a } });
  // Las metas de cada área, en corto («Pasos · Cardio · Fuerza»)
  const areaNames = Object.fromEntries(
    AREAS.map((a) => [
      a,
      s.sel[a]
        .map((id) => resolveMeta(s, id))
        .map((m) => (m ? (m.def ? t(m.def.short) : m.custom?.name) : null))
        .filter(Boolean)
        .join(' · '),
    ]),
  ) as Record<Area, string>;
  const startBtn = (
    <TouchableOpacity style={styles.start} onPress={() => router.push({ pathname: '/metas-elegir', params: { area: 'ej' } })} activeOpacity={0.85}>
      <Text style={styles.startText}>{t('Choose your targets')}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
    </TouchableOpacity>
  );

  // Hoy ya no lleva «Esta semana» con las tres líneas (fundador, 2026-11-16: «me sobra; la gracia era que al
  // pinchar en el círculo Semana te llevase a Plan»): solo queda, al cerrar la semana, la enhorabuena o el ánimo
  if (today) return congrats ? <WeekBlock congrats={congrats} review={review} onClose={() => update({ ...s, closedWeek: congrats.week })} /> : null;

  return (
    <View>
      <View style={[fine.secHead, styles.titleRow]}>
        <Text style={fine.secTitle} accessibilityRole="header">
          {t('Your week')}
        </Text>
        <TouchableOpacity onPress={() => setInfo(true)} hitSlop={10} style={{ marginLeft: 'auto' }} accessibilityRole="button" accessibilityLabel={t('About your goals')}>
          <Ionicons name="information-circle-outline" size={18} color={FINE.mute} />
        </TouchableOpacity>
      </View>
      {/* Tu semana en una cifra, el mismo círculo «Semana» de Hoy en grande (fundador, 2026-11-16: «al pinchar en
          Semana te lleva a Plan y ahí tendría que haber alguna métrica que aglutinase»); justo debajo, tus metas de
          cada área, una sola vez (antes se repetían en una sección «Tus metas» aparte) */}
      <TourTarget id="plan.targets" scroll={tourScroll} inset={20}>
        <View style={styles.block}>
          {none || !week ? (
            startBtn
          ) : (
            <WeekHero s={s} week={week} vals={vals} known={known} last={last} names={areaNames} onArea={openArea} tourScroll={tourScroll} />
          )}
        </View>
      </TourTarget>

      <Modal visible={info} transparent animationType="slide" onRequestClose={() => setInfo(false)}>
        <Pressable style={styles.backdrop} onPress={() => setInfo(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t('Your goals')}</Text>
              <TouchableOpacity onPress={() => setInfo(false)} hitSlop={10} accessibilityLabel={t('Close')}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetText}>
              {t('Your goals come from your lab results, following Kuova’s recommendations, and from what you set out to do yourself. To meet them, each area holds your exercise, food and habit targets: tap an area to see them and mark your day.')}
            </Text>
            {s.goals.length > 0 && (
              <View style={styles.goals}>
                {s.goals.map((g) => (
                  <View key={g} style={styles.goalChip}>
                    {/* AppIcon: las pesas («Ponerte en forma») salen con el dibujo único de la app (fine/dumbbell.ts) */}
                    <AppIcon name={GOALS[g].icon} size={14} color={Colors.accent} />
                    <Text style={styles.goalChipText}>{t(GOALS[g].name)}</Text>
                  </View>
                ))}
              </View>
            )}
            {/* Debajo de los objetivos, tus metas de cada área (fundador, 2026-11-06) */}
            {!none && (
              <View style={styles.sheetMetas}>
                <Text style={styles.sheetSec}>{t('Your targets')}</Text>
                {AREAS.filter((a) => s.sel[a].length > 0).map((a) => (
                  <View key={a} style={styles.sheetArea}>
                    <Text style={[styles.sheetAreaName, { color: AREA_COLOR[a] }]}>{t(AREA_NAME[a])}</Text>
                    {s.sel[a].map((id) => {
                      const m = resolveMeta(s, id);
                      return m ? (
                        <Text key={id} style={styles.sheetMeta}>
                          {metaText(m)}
                        </Text>
                      ) : null;
                    })}
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.sheetBtn} onPress={() => go('/metas')} activeOpacity={0.85}>
              <Text style={styles.sheetBtnText}>{t('See your goals')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetLink} onPress={() => go('/metas-objetivos')} hitSlop={8}>
              <Text style={styles.sheetLinkText}>{t('Change my goals')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sin caja (2026-11-16): un brillo detrás, el texto y, al abrirlo, las áreas con su línea cometa
  cg: { marginHorizontal: 20, marginTop: 16, paddingVertical: 8 },
  glow: { position: 'absolute', top: -36, bottom: -36, left: -30, right: -30 },
  cgHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cgIcon: { width: 22, marginTop: 1, textAlign: 'center' },
  cgTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 16 },
  cgBody: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  cgMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  cgMore: { ...ff('regular'), fontSize: 13 },
  rv: { marginTop: 14, marginLeft: 34, gap: 16 },
  rvArea: { gap: 2 },
  rvAreaHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rvAreaName: { ...ff('medium'), fontSize: 14 },
  rvPct: { ...ff('regular'), color: FINE.mute, fontSize: 14, fontVariant: ['tabular-nums'] },
  rvLine: { marginHorizontal: -8, marginBottom: 2 },
  rvRow: { flexDirection: 'row', gap: 10, alignItems: 'baseline', paddingVertical: 3 },
  rvTarget: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 13, lineHeight: 18 },
  rvDone: { ...ff('medium'), color: FINE.ivory, fontSize: 13, textAlign: 'right', maxWidth: '45%' },
  rvClosing: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  titleRow: { marginHorizontal: 20 },
  // Sin tarjeta (rediseño «Emerald Luxury», 2026-11-15): las líneas flotan sobre el fondo
  block: { marginHorizontal: 20, paddingBottom: 4 },
  start: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 12 },
  startText: { ...ff('regular'), color: FINE.jade, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0A2019', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: FINE.line, paddingHorizontal: 20, paddingTop: 18 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 20 },
  sheetText: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20 },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: FINE.tile,
    borderWidth: 1,
    borderColor: FINE.line,
  },
  goalChipText: { ...ff('regular'), color: FINE.ivory, fontSize: 13 },
  sheetMetas: { marginTop: 16 },
  sheetSec: { ...fine.secTitle, marginBottom: 4 },
  sheetArea: { marginTop: 8, gap: 2 },
  sheetAreaName: { ...ff('medium'), fontSize: 13 },
  sheetMeta: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 19 },
  sheetBtn: { marginTop: 18, backgroundColor: FINE.emerald, borderRadius: 22, paddingVertical: 13, alignItems: 'center' },
  sheetBtnText: { ...ff('medium'), color: '#F0EFE6', fontSize: 15 },
  sheetLink: { alignSelf: 'center', paddingVertical: 12 },
  sheetLinkText: { ...ff('regular'), color: FINE.jade, fontSize: 14 },
});
