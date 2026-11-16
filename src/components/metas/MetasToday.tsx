// La sección de Hoy que sustituye al plan: al cerrar tu semana, la enhorabuena (o ánimo); después,
// «Tus objetivos» con su (i) y una línea cometa por área (cada una abre su área, donde se marca y se
// edita). Fundador, 2026-11-05: sin flecha en el título ni «Toca para marcar». 2026-11-16: líneas aquí
// y círculos en los objetivos del día (antes, al revés).
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { CometLine } from '@/components/CometLine';
import { TourTarget } from '@/components/tour/TourTarget';
import type { TourScroll } from '@/components/tour/tourStore';
import { useMetas } from '@/hooks/useMetas';
import { AREAS, AREA_NAME, GOALS, areaScore, metaText, rangeText, resolveMeta, reviewClosing, selectedIds } from '@/logic/metas';
import { AREA_COLOR, AREA_ICON, AREA_RING, pct, takePop, usePop } from './MetaParts';
import type { Area, Congrats, ReviewArea } from '@/logic/metas';

// El % de un área en Hoy: si acabas de completarla (en su pantalla), al volver crece y vuelve una vez
function TodayPct({ area, score }: { area: Area; score: number | null }) {
  const { scale, pop } = usePop();
  useEffect(() => {
    if (takePop(area)) {
      const t0 = setTimeout(() => pop(), 350); // cuando ya se ve Hoy
      return () => clearTimeout(t0);
    }
  });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Text style={styles.areaPct}>
        {score == null ? '—' : Math.round(score * 100)}
        {score != null && <Text style={styles.areaPctSign}>%</Text>}
      </Text>
    </Animated.View>
  );
}
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

export function MetasToday({ tourScroll }: { tourScroll?: TourScroll }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, week, vals, known, congrats, review, update } = useMetas();
  const [info, setInfo] = useState(false);
  if (!data) return null;
  const s = data.state;
  const none = selectedIds(s).length === 0;
  const go = (path: '/metas' | '/metas-objetivos') => {
    setInfo(false);
    router.push(path);
  };

  return (
    <View>
      {congrats && <WeekBlock congrats={congrats} review={review} onClose={() => update({ ...s, closedWeek: congrats.week })} />}
      <View style={styles.titleRow}>
        {/* «Your goals» (fundador, 2026-11-16; antes «Meet your goals») */}
        <Text style={styles.title}>{t('Your goals')}</Text>
        <TouchableOpacity onPress={() => setInfo(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('About your goals')}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <TourTarget id="today.plan" scroll={tourScroll} inset={20}>
        <View style={styles.block}>
          <View style={styles.areas}>
            {AREAS.map((a) => {
              const score = areaScore(s, a, vals, week ?? undefined, known);
              return (
                <TourTarget key={a} id={`today.plan.${a}`} scroll={tourScroll}>
                  <TouchableOpacity
                    onPress={() => router.push(s.sel[a].length ? { pathname: '/metas-area', params: { area: a } } : { pathname: '/metas-elegir', params: { area: a } })}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(AREA_NAME[a])}: ${score == null ? t('No data') : pct(score)}`}
                  >
                    <View style={styles.areaHead}>
                      <Ionicons name={AREA_ICON[a] as any} size={16} color={AREA_COLOR[a]} style={styles.areaIcon} />
                      <Text style={[styles.areaName, { color: AREA_COLOR[a] }]}>{t(AREA_NAME[a])}</Text>
                      <TodayPct area={a} score={score} />
                      <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                    </View>
                    <CometLine progress={score ?? 0} colors={AREA_RING[a]} thickness={4} style={styles.areaLine} />
                  </TouchableOpacity>
                </TourTarget>
              );
            })}
          </View>
          {none ? (
            <TouchableOpacity style={styles.start} onPress={() => router.push({ pathname: '/metas-elegir', params: { area: 'ej' } })} activeOpacity={0.85}>
              <Text style={styles.startText}>{t('Choose your targets')}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.note}>{week ? t('This week: {range}.', { range: rangeText(week.days[Math.min(week.from, 6)], week.days[6]) }) : ''}</Text>
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
                    <Ionicons name={GOALS[g].icon as any} size={14} color={Colors.accent} />
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
  cgTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  cgBody: { color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  cgMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  cgMore: { fontSize: 13, fontWeight: '700' },
  rv: { marginTop: 14, marginLeft: 34, gap: 16 },
  rvArea: { gap: 2 },
  rvAreaHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rvAreaName: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  rvPct: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rvLine: { marginHorizontal: -8, marginBottom: 2 },
  rvRow: { flexDirection: 'row', gap: 10, alignItems: 'baseline', paddingVertical: 3 },
  rvTarget: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  rvDone: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'right', maxWidth: '45%' },
  rvClosing: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginTop: 16, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  // Sin tarjeta (rediseño «Emerald Luxury», 2026-11-15): las líneas flotan sobre el fondo
  block: { marginHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  // Una línea cometa por área: icono, nombre y % arriba (toca para abrir el área)
  areas: { gap: 14 },
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  areaIcon: { width: 20, textAlign: 'center' },
  areaName: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  areaPct: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  areaPctSign: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  areaLine: { marginTop: 2, marginLeft: 20, marginRight: -6 },
  note: { color: Colors.textMuted, fontSize: 11, textAlign: 'left', marginTop: 12 },
  start: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 12 },
  startText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  sheetText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.accentSoft,
  },
  goalChipText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  sheetMetas: { marginTop: 16 },
  sheetSec: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  sheetArea: { marginTop: 8, gap: 2 },
  sheetAreaName: { fontSize: 13, fontWeight: '800' },
  sheetMeta: { color: Colors.textSecondary, fontSize: 14, lineHeight: 19 },
  sheetBtn: { marginTop: 18, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  sheetBtnText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  sheetLink: { alignSelf: 'center', paddingVertical: 12 },
  sheetLinkText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});
