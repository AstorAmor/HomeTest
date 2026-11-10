// La sección de Hoy que sustituye al plan: al cerrar tu semana, la enhorabuena (o ánimo); después,
// «Cumple tus objetivos» con su (i) y los tres donuts de las áreas, centrados en un mismo bloque (cada
// uno abre su área, donde se marca y se edita). Fundador, 2026-11-05: sin flecha en el título ni
// «Toca para marcar» debajo de cada círculo.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, withAlpha } from '@/constants/colors';
import { TourTarget } from '@/components/tour/TourTarget';
import type { TourScroll } from '@/components/tour/tourStore';
import { useMetas } from '@/hooks/useMetas';
import { AREAS, AREA_NAME, GOALS, areaScore, metaText, rangeText, resolveMeta, selectedIds } from '@/logic/metas';
import { AREA_COLOR, AreaRing, takePop, usePop } from './MetaParts';
import type { Area } from '@/logic/metas';

// El donut de un área en Hoy: si acabas de completarla (en su pantalla), al volver crece y vuelve una vez
function TodayRing({ area, score }: { area: Area; score: number | null }) {
  const { scale, pop } = usePop();
  useEffect(() => {
    if (takePop(area)) {
      const t0 = setTimeout(() => pop(), 350); // cuando ya se ve Hoy
      return () => clearTimeout(t0);
    }
  });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <AreaRing area={area} score={score} />
    </Animated.View>
  );
}
import { t } from '@/i18n';

export function MetasToday({ tourScroll }: { tourScroll?: TourScroll }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, week, vals, known, congrats, update } = useMetas();
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
      {congrats && (
        <View style={[styles.cg, congrats.tone === 'go' && styles.cgGo]}>
          <View style={[styles.cgIcon, congrats.tone === 'go' && { backgroundColor: withAlpha(Colors.sky, 0.16) }]}>
            <Ionicons name={congrats.tone === 'go' ? 'flash-outline' : 'trophy-outline'} size={20} color={congrats.tone === 'go' ? Colors.sky : Colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cgTitle}>{congrats.title}</Text>
            <Text style={styles.cgBody}>{congrats.body}</Text>
          </View>
          <TouchableOpacity onPress={() => update({ ...s, closedWeek: congrats.week })} accessibilityLabel={t('Close')} hitSlop={10}>
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('Meet your goals')}</Text>
        <TouchableOpacity onPress={() => setInfo(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('About your goals')}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <TourTarget id="today.plan" scroll={tourScroll} inset={20}>
        <View style={styles.block}>
          <View style={styles.levers}>
            {AREAS.map((a) => (
              <TourTarget key={a} id={`today.plan.${a}`} scroll={tourScroll}>
                <TouchableOpacity
                  style={styles.lever}
                  onPress={() => router.push(s.sel[a].length ? { pathname: '/metas-area', params: { area: a } } : { pathname: '/metas-elegir', params: { area: a } })}
                  activeOpacity={0.8}
                  accessibilityLabel={t(AREA_NAME[a])}
                >
                  <TodayRing area={a} score={areaScore(s, a, vals, week ?? undefined, known)} />
                  <Text style={[styles.leverName, { color: AREA_COLOR[a] }]}>{t(AREA_NAME[a])}</Text>
                </TouchableOpacity>
              </TourTarget>
            ))}
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
              {t('Your goals come from your lab results, following Kuova’s recommendations, and from what you set out to do yourself. To meet them, each area holds your exercise, food and habit targets: tap a circle to see them and mark your day.')}
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
  cg: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: withAlpha(Colors.gold, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(Colors.gold, 0.35),
  },
  cgGo: { backgroundColor: withAlpha(Colors.sky, 0.08), borderColor: withAlpha(Colors.sky, 0.3) },
  cgIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(Colors.gold, 0.18), alignItems: 'center', justifyContent: 'center' },
  cgTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  cgBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginTop: 16, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  block: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  levers: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' },
  lever: { alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  leverName: { fontSize: 13, fontWeight: '800' },
  note: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12 },
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
