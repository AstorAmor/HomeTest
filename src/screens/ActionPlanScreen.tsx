import { dateLocale, t } from '@/i18n';
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ActionPlanList } from '@/components/ActionPlanList';
import { SharePlanButton } from '@/components/SharePlanButton';
import { BlobArt } from '@/components/BlobArt';
import { IconBadge } from '@/components/HealthIcons';
import { Colors } from '@/constants/colors';
import { currentReport } from '@/data/reportRepository';
import { PlanVersion, planVersionRepository } from '@/data/planVersions';
import { buildPlan, PlanItem } from '@/data/planRepository';
import { profileRepository } from '@/data/profileRepository';
import { actionCategory, KIND_ART, KIND_CATEGORY, PLAN_CATEGORIES, planItemRoute, planItemTitle } from '@/data/planCategories';
import { STATUS_LABEL } from '@/utils/planUpdate';
import { statusColor } from '@/screens/PlanUpdateScreen';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useSections } from '@/data/appPrefs';

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

// "Plan completo" desde Today → Tu plan: el plan entero en tres bloques (hábitos, actividad física,
// nutrición y suplementación). Cada bloque trae primero las acciones del día a día (las mismas que
// el avance de Today, con su porqué y cómo hacerlo) y después lo que dice la última analítica.
export const ActionPlanScreen = () => {
  const show = useSections();
  const router = useRouter();
  const [latest, setLatest] = useDeepState<PlanVersion | null>(null);
  const [plan, setPlan] = useDeepState<PlanItem[]>([]);
  useReloadOnFocus(
    useCallback(async () => {
      setLatest(await planVersionRepository.latest().catch(() => null));
      setPlan(buildPlan(await profileRepository.get().catch(() => null)));
    }, [setLatest, setPlan]),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your full plan')} showBack />
        <Text style={styles.intro}>
          {t('Built from your answers, your blood test of {date} and your wearable data, in three blocks: habits, physical activity, and nutrition and supplements.', {
            date: longDate(currentReport.test_date),
          })}
        </Text>
        <View style={styles.share}>
          <SharePlanButton />
        </View>

        {latest && (
          <View style={styles.updated}>
            <Text style={styles.updatedTitle}>{t('Your plan today')}</Text>
            <Text style={styles.updatedSub}>{t('Updated {date} with your latest results', { date: longDate(latest.createdAt.slice(0, 10)) })}</Text>
            {latest.items.map((it, i) => (
              <View key={`${it.title}-${i}`} style={styles.updatedRow}>
                <View style={[styles.dot, { backgroundColor: statusColor(it.status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.updatedItem}>{it.title}</Text>
                  {it.note && <Text style={styles.updatedNote}>{it.note}</Text>}
                </View>
                <Text style={[styles.updatedStatus, { color: statusColor(it.status) }]}>{t(STATUS_LABEL[it.status])}</Text>
              </View>
            ))}
          </View>
        )}

        {PLAN_CATEGORIES.map((c) => {
          const items = plan.filter((i) => KIND_CATEGORY[i.kind] === c.id);
          const fromTest = currentReport.action_plan.some((a) => actionCategory(a.action_id) === c.id);
          if (!items.length && !fromTest) return null;
          return (
            <View key={c.id} style={styles.block}>
              <View style={styles.blockHeader}>
                <IconBadge name={c.icon} color={Colors[c.color]} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockTitle}>{t(c.title)}</Text>
                  <Text style={styles.blockSub}>{t(c.subtitle)}</Text>
                </View>
              </View>

              {items.map((item) => (
                <TouchableOpacity key={item.kind} style={styles.item} onPress={() => router.push(planItemRoute(item.kind) as any)} activeOpacity={0.85}>
                  <View style={styles.itemHead}>
                    <BlobArt seed={item.kind} palette={KIND_ART[item.kind].palette} icon={KIND_ART[item.kind].icon} size={44} radius={12} iconSize={22} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{planItemTitle(item, t)}</Text>
                      <Text style={styles.itemSub}>{item.kind === 'nutrition' ? t(item.title) : t(item.subtitle)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.itemWhy}>{item.why}</Text>
                  {item.how.map((h) => (
                    <View key={h} style={styles.howRow}>
                      <Ionicons name="checkmark" size={14} color={Colors.accent} />
                      <Text style={styles.howText}>{h}</Text>
                    </View>
                  ))}
                </TouchableOpacity>
              ))}

              {fromTest && <Text style={styles.fromTest}>{t('From your blood test')}</Text>}
              <ActionPlanList category={c.id} compact />
            </View>
          );
        })}

        <View style={styles.links}>
          {show('wearables') && (
            <TouchableOpacity style={styles.link} onPress={() => router.push('/habits')}>
              <Ionicons name="stats-chart-outline" size={18} color={Colors.accent} />
              <Text style={styles.linkText}>{t('Your habits and 6-month trends')}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.link} onPress={() => router.push('/plans')}>
            <Ionicons name="time-outline" size={18} color={Colors.accent} />
            <Text style={styles.linkText}>{t('Earlier plans')}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={() => router.push('/talk-to-specialist')}>
            <Ionicons name="chatbubbles-outline" size={18} color={Colors.accent} />
            <Text style={styles.linkText}>{t('Talk to a specialist about your plan')}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 12 },
  share: { marginHorizontal: 20, marginBottom: 16 },
  links: { marginHorizontal: 20, marginTop: 8, gap: 8 },
  updated: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 18,
    gap: 10,
  },
  updatedTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  updatedSub: { color: Colors.textSecondary, fontSize: 12, marginTop: -6 },
  updatedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  updatedItem: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  updatedNote: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  updatedStatus: { fontSize: 11, fontWeight: '800' },
  block: { marginBottom: 14 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 12, marginTop: 6 },
  blockTitle: { color: Colors.textPrimary, fontSize: 19, fontWeight: '800' },
  blockSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  item: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 6,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  itemTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  itemSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  itemWhy: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  howText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, flex: 1 },
  fromTest: { color: Colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginHorizontal: 20, marginTop: 4, marginBottom: 8 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  linkText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
});
