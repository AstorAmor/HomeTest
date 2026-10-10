import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { Colors, withAlpha } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { familyHistoryStore } from '@/data/familyHistoryStore';
import { LEVEL_TEXT } from '@/logic/genetics';
import { FamilyHistoryDraft, FamilyHistoryRecord } from '@/types/familyHistory';

// "Your genetic profile": de momento, "Know your roots" (antecedentes familiares) y un hueco para
// los resultados genéticos, que llegarán más adelante (p. ej. variantes en BRCA2). No inventamos
// resultados.
export const GeneticProfileScreen = () => {
  const router = useRouter();
  const [record, setRecord] = useDeepState<FamilyHistoryRecord | null>(null);
  const [draft, setDraft] = useDeepState<FamilyHistoryDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([familyHistoryStore.getRecord(), familyHistoryStore.getDraft()]);
    setRecord(r);
    setDraft(d && d.stepKey !== 'intro' ? d : null);
    setLoaded(true);
  }, [setRecord, setDraft]);
  useReloadOnFocus(load);

  const level = record?.level;
  const tagColor = level === 'moderate' || level === 'high' ? Colors.gold : Colors.green;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your genetic profile')} showBack />

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="dna" size={30} color={Colors.gold} />
          </View>
          <Text style={styles.heroText}>
            {t('What runs in your family, and later what your genes say. Everything here is private to you.')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push(record && !draft ? { pathname: '/know-your-roots', params: { view: 'result' } } : '/know-your-roots')}
        >
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="family-tree" size={22} color={Colors.gold} />
            <Text style={styles.cardTitle}>{t('Know your roots')}</Text>
            <InfoButton topic="family_history" />
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </View>
          {!loaded ? null : draft ? (
            <>
              <Text style={styles.cardBody}>{t('You started it. Your answers are saved: continue at the same question.')}</Text>
              <Text style={styles.cardCta}>{t('Continue')}</Text>
            </>
          ) : record && level ? (
            <>
              <View style={[styles.tag, { backgroundColor: withAlpha(tagColor, 0.16) }]}>
                <Text style={[styles.tagText, { color: tagColor }]}>
                  {level === 'population' ? t('Population risk') : level === 'low' ? t('Low risk') : level === 'moderate' ? t('Moderate risk') : t('High risk')}
                </Text>
              </View>
              <Text style={styles.cardBody}>{LEVEL_TEXT[level].title}</Text>
              <Text style={styles.cardMeta}>
                Answered {new Date(record.completedAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })} · tap
                to see what to tell your doctor
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.cardBody}>
                {t('The questions a genetic counsellor asks at a first visit: cancer and heart disease in your family. You find out whether it is worth talking to a professional, and what to tell them.')}
              </Text>
              <Text style={styles.cardMeta}>{t('About 4–6 minutes · saved as you go')}</Text>
              <Text style={styles.cardCta}>{t('Start')}</Text>
            </>
          )}
        </TouchableOpacity>
        {record && !draft && (
          <TouchableOpacity style={styles.update} onPress={() => router.push({ pathname: '/know-your-roots', params: { edit: '1' } })}>
            <Ionicons name="create-outline" size={16} color={Colors.accent} />
            <Text style={styles.updateText}>{t('Update my answers')}</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.card, styles.soon]}>
          <View style={styles.cardHeader}>
            <Ionicons name="flask-outline" size={20} color={Colors.textMuted} />
            <Text style={[styles.cardTitle, { color: Colors.textSecondary }]}>{t('Your genetic results')}</Text>
            <View style={styles.soonTag}>
              <Text style={styles.soonTagText}>{t('Coming later')}</Text>
            </View>
          </View>
          <Text style={styles.cardBody}>
            {t('When you do a genetic test with us, its results will appear here, explained in plain words and reviewed by a professional.')}
          </Text>
        </View>

        <TouchableOpacity style={styles.pro} onPress={() => router.push({ pathname: '/professionals', params: { role: 'geneticist' } })}>
          <Ionicons name="people-outline" size={18} color={Colors.textPrimary} />
          <Text style={styles.proText}>{t('Talk to a genetic counsellor')}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.privacy}>
          <Ionicons name="lock-closed-outline" size={15} color={Colors.textMuted} />
          <Text style={styles.privacyText}>
            {t('Family history and genetic data are special-category health data. Only you see them, unless you choose to share them with a professional.')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, marginBottom: 18 },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: withAlpha(Colors.gold, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  cardBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  cardMeta: { color: Colors.textMuted, fontSize: 12 },
  cardCta: { color: Colors.gold, fontSize: 14, fontWeight: '800', marginTop: 2 },
  tag: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: '800' },
  update: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 24, marginBottom: 18 },
  updateText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  soon: { opacity: 0.85 },
  soonTag: { marginLeft: 'auto', backgroundColor: Colors.divider, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  soonTagText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  pro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.card,
  },
  proText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  privacy: { flexDirection: 'row', gap: 8, marginHorizontal: 24, marginTop: 18 },
  privacyText: { flex: 1, color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
});
