import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { PlanVersion, planVersionRepository } from '@/data/planVersions';
import { ruleWhyForItem, STATUS_LABEL } from '@/utils/planUpdate';
import { statusColor } from '@/screens/PlanUpdateScreen';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { specialistPlans } from '@/logic/specialistPlan';
import { INTER } from '@/theme/fine';

// «El plan de tu especialista» (/plans). Desde el 2026-11-06 (fundador: «hacerlo más dependiente de médicos…
// para eso tenemos lo de los objetivos») la app ya no hace planes sola: aquí solo salen los que manda un
// especialista desde su portal (ProPlanScreen → versión con source «professional»). Lo del día a día va en
// Tus objetivos (/metas). El plan automático (/action-plan, /plan-update, /report-plan) queda en el código,
// sin enlaces.

const dayMonthYear = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

// Un plan del especialista: acciones con su estado. Abierto, se puede borrar.
const VersionCard = ({
  v,
  current,
  open,
  onToggle,
  onDelete,
}: {
  v: PlanVersion;
  current: boolean;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) => (
  <View style={[styles.card, current && styles.cardLatest]}>
    <TouchableOpacity style={styles.head} activeOpacity={0.85} onPress={onToggle}>
      <View style={[styles.icon, current && { backgroundColor: Colors.accent }]}>
        <Ionicons name={current ? 'medkit' : 'medkit-outline'} size={20} color={current ? Colors.background : Colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        {current && <Text style={styles.badge}>{t('Current plan')}</Text>}
        <Text style={styles.title}>{dayMonthYear(v.createdAt)}</Text>
        <Text style={styles.sub}>
          {v.professionalName ? t('From {name}', { name: v.professionalName }) : t('From your specialist')} ·{' '}
          {t(v.items.length === 1 ? '{n} action' : '{n} actions', { n: v.items.length })}
        </Text>
      </View>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
    </TouchableOpacity>
    {open && (
      <View style={styles.items}>
        {/* t(): la nota que pone la app («Updated from your uploaded test») se guarda en inglés; una escrita a mano sale tal cual */}
        {v.note ? <Text style={styles.note}>{t(v.note)}</Text> : null}
        {v.items.map((it, i) => (
          <View key={`${it.title}-${i}`} style={styles.item}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={[styles.itemTitle, { flex: 1 }]}>{it.title}</Text>
              {it.status !== 'not_retested' && it.status !== 'new' && (
                <Text style={[styles.status, { color: statusColor(it.status) }]}>{STATUS_LABEL[it.status]}</Text>
              )}
            </View>
            <Text style={styles.itemWhy}>{ruleWhyForItem(it)}</Text>
            {it.note && it.status !== 'not_retested' && <Text style={styles.itemNote}>{it.note}</Text>}
          </View>
        ))}
        <TouchableOpacity style={styles.deleteRow} onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteText}>{t('Delete this plan')}</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
);

export const PlansScreen = () => {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [versions, setVersions] = useDeepState<PlanVersion[] | null>(null);
  const [deleteError, setDeleteError] = useState('');
  useReloadOnFocus(
    useCallback(async () => {
      const v = specialistPlans(await planVersionRepository.getAll().catch(() => []));
      setVersions(v);
      if (v.length) setOpenId((cur) => cur ?? v[0].id);
    }, [setVersions]),
  );
  const deleteVersion = async (v: PlanVersion) => {
    const ok = await confirmAsk(t('Delete this plan?'), `${dayMonthYear(v.createdAt)} · ${t('From your specialist')}`, t('Delete'));
    if (!ok) return;
    setDeleteError('');
    try {
      await planVersionRepository.remove(v.id);
      setVersions(specialistPlans(await planVersionRepository.getAll().catch(() => [])));
    } catch {
      setDeleteError(t('This plan could not be deleted yet. Try again in a while.'));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your specialist’s plan')} showBack />
        <Text style={styles.intro}>
          {t('The plans a Kuova specialist sends you after looking at your results. Your day-to-day targets are in Your goals.')}
        </Text>

        {versions && versions.length === 0 && (
          <View style={styles.card}>
            <View style={styles.head}>
              <View style={styles.icon}>
                <Ionicons name="medkit-outline" size={20} color={Colors.accent} />
              </View>
              <Text style={[styles.title, { flex: 1, fontFamily: INTER.regular, fontSize: 15 }]}>{t('No specialist has sent you a plan yet.')}</Text>
            </View>
            <Text style={[styles.itemWhy, { marginTop: 10 }]}>
              {t('Share your results with a specialist and, if they see fit, they will send you a plan. It will appear here and in Your goals.')}
            </Text>
            <TouchableOpacity style={styles.cta} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}>
              <Text style={styles.ctaText}>{t('Talk to a specialist')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghost} onPress={() => router.push('/metas')}>
              <Text style={styles.ghostText}>{t('See your goals')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
        {(versions ?? []).map((v, i) => (
          <VersionCard
            key={v.id}
            v={v}
            current={i === 0}
            open={openId === v.id}
            onToggle={() => setOpenId(openId === v.id ? null : v.id)}
            onDelete={() => deleteVersion(v)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 32 },
  intro: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 16 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  cardLatest: { borderColor: Colors.accent },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  badge: { color: Colors.accent, fontSize: 11, fontFamily: INTER.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: Colors.textPrimary, fontSize: 17, fontFamily: INTER.medium },
  sub: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 13, marginTop: 2 },
  cta: { backgroundColor: Colors.accent, borderRadius: 22, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  ctaText: { color: Colors.background, fontSize: 14, fontFamily: INTER.medium },
  ghost: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  ghostText: { color: Colors.accent, fontSize: 14, fontFamily: INTER.medium },
  items: { marginTop: 14, gap: 12 },
  item: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 12, gap: 4 },
  itemTitle: { color: Colors.textPrimary, fontSize: 14, fontFamily: INTER.medium },
  itemWhy: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 13, lineHeight: 18 },
  note: { color: Colors.textPrimary, fontFamily: INTER.regular, fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  status: { fontSize: 11, fontFamily: INTER.medium },
  itemNote: { color: Colors.textPrimary, fontSize: 12, fontFamily: INTER.medium },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingTop: 4 },
  deleteText: { color: Colors.danger, fontSize: 13, fontFamily: INTER.medium },
  deleteError: { color: Colors.danger, fontFamily: INTER.regular, fontSize: 13, marginHorizontal: 20, marginBottom: 10 },
});
