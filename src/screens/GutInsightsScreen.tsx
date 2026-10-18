import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { TestCard } from '@/components/TestCard';
import { Colors, withAlpha } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { ChoiceChips } from '@/components/ChoiceChips';
import { loadGutContext, usualFoodsStore } from '@/data/digestionRepository';
import { CATALOG, localizeTest } from '@/data/testCatalog';
import { analyseGut, CONFIDENCE_LABEL, Confidence, groupLabel, GutAnalysis, GutPattern, MIN_EPISODES, TestSuggestion } from '@/logic/gutPatterns';
import { FOOD_GROUPS, FoodGroup } from '@/logic/foodGroups';
import { USUAL_FREQUENCIES, UsualFoods, UsualFrequency } from '@/types/digestion';
import { t } from '@/i18n';

const CONFIDENCE_COLOR: Record<Confidence, string> = { clear: Colors.ok, probable: Colors.gold, hint: Colors.textMuted };

// Consejos que se pueden dar aunque haya alarmas o falten las preguntas de seguridad: no son pruebas
const ADVICE_ONLY: TestSuggestion['id'][] = ['reflux_advice', 'fodmap_advice', 'trigger_advice'];

// Lo que vemos en tu digestión: alarmas primero (médico antes que pruebas), luego lo que se
// repite en tus datos con lo seguros que estamos y la prueba que tiene sentido. Lógica en
// src/logic/gutPatterns.ts. Orientación, no diagnóstico.
export const GutInsightsScreen = () => {
  const router = useRouter();
  const [analysis, setAnalysis] = useDeepState<GutAnalysis | null>(null);
  const [sample, setSample] = useState(false);
  const [usual, setUsual] = useDeepState<UsualFoods>({});
  const [openTest, setOpenTest] = useState<string | null>(null);
  const tests = useMemo(() => new Map(CATALOG.map((p) => [p.id, localizeTest(p)])), []);

  const load = useCallback(async () => {
    const ctx = await loadGutContext();
    setSample(ctx.sample);
    setUsual(ctx.usual);
    setAnalysis(analyseGut(ctx));
  }, [setAnalysis, setUsual]);

  const setUsualFor = async (g: FoodGroup, f: UsualFrequency) => {
    await usualFoodsStore.merge({ [g]: f });
    load();
  };
  useReloadOnFocus(load);

  const findDoctor = () => router.push({ pathname: '/professionals', params: { role: 'doctor' } });

  const renderSuggestion = (s: TestSuggestion, a: GutAnalysis) => {
    const isAdvice = ADVICE_ONLY.includes(s.id);
    if (!isAdvice && !a.showTests) {
      return (
        <Text style={styles.gated}>
          {a.alarms.length
            ? t('With the signs above, a doctor first: we do not suggest tests for now.')
            : t('Answer the questions before any test to see which one makes sense.')}
        </Text>
      );
    }
    return (
      <View style={styles.suggestion}>
        <Text style={styles.suggestionTitle}>{s.title}</Text>
        <Text style={styles.body}>{s.body}</Text>
        {s.warning && (
          <View style={styles.warning}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.attention} />
            <Text style={styles.warningText}>{s.warning}</Text>
          </View>
        )}
        {s.prep && <Text style={styles.prep}>{s.prep}</Text>}
        {s.storeIds
          .filter((id) => tests.has(id))
          .map((id) => (
            <View key={id} style={{ marginTop: 8 }}>
              <TestCard
                test={tests.get(id)!}
                open={openTest === `${s.id}:${id}`}
                onToggle={() => setOpenTest(openTest === `${s.id}:${id}` ? null : `${s.id}:${id}`)}
                onOrder={() => router.push({ pathname: '/checkout', params: { id } })}
              />
            </View>
          ))}
      </View>
    );
  };

  const renderPattern = (p: GutPattern, a: GutAnalysis) => (
    <View key={p.id} style={[styles.card, { borderColor: withAlpha(CONFIDENCE_COLOR[p.confidence], 0.5) }]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{p.title}</Text>
        <View style={[styles.badge, { backgroundColor: withAlpha(CONFIDENCE_COLOR[p.confidence], 0.16) }]}>
          <Text style={[styles.badgeText, { color: CONFIDENCE_COLOR[p.confidence] }]}>{t(CONFIDENCE_LABEL[p.confidence])}</Text>
        </View>
      </View>
      <Text style={styles.numbers}>{p.numbers}</Text>
      {p.body ? <Text style={styles.body}>{p.body}</Text> : null}
      {p.suggestion && renderSuggestion(p.suggestion, a)}
    </View>
  );

  const a = analysis;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('What we see in your digestion')} showBack backFallback="/digestive?part=gut" />
        <Text style={styles.intro}>
          {t('We look at what you ate before each symptom and compare it with how often you usually have it. Loose stools are linked to those meals by the time.')}
        </Text>
        {sample && (
          <View style={styles.sample}>
            <Ionicons name="flask-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.sampleText}>{t('Sample month: log your own days to see yours.')}</Text>
          </View>
        )}

        {a && (
          <>
            {a.alarms.map((al) => (
              <View key={al.id} style={[styles.card, styles.alarm]}>
                <View style={styles.cardHead}>
                  <Ionicons name="medkit-outline" size={18} color={Colors.danger} />
                  <Text style={styles.cardTitle}>{al.title}</Text>
                </View>
                <Text style={styles.body}>{al.body}</Text>
                <Text style={[styles.body, { fontWeight: '700', color: Colors.textPrimary }]}>{t('Before any test, talk to a doctor.')}</Text>
                <TouchableOpacity onPress={findDoctor}>
                  <Text style={styles.link}>{t('Find a doctor')}</Text>
                </TouchableOpacity>
              </View>
            ))}

            {a.safety === 'needed' && (
              <TouchableOpacity style={[styles.card, styles.safety]} onPress={() => router.push('/gut-safety')} activeOpacity={0.85}>
                <View style={styles.cardHead}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={Colors.gold} />
                  <Text style={styles.cardTitle}>{t('Before suggesting any test: a few quick questions')}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>
                <Text style={styles.body}>{t('Some signs need a doctor rather than a test. It takes 30 seconds.')}</Text>
              </TouchableOpacity>
            )}

            {!a.ready && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('Still learning how food sits with you')}</Text>
                <Text style={styles.body}>{t('{m} of {M} times with what you ate before, so far.', { m: a.foodEpisodes, M: MIN_EPISODES })}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (a.foodEpisodes / MIN_EPISODES) * 100)}%` }]} />
                </View>
                <Text style={styles.prep}>{t('Each time you note something in Digestion, tell us what you ate before. On good days, tap "All good today".')}</Text>
              </View>
            )}

            {a.ready && !a.patterns.length && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('Nothing stands out yet')}</Text>
                <Text style={styles.body}>{t('With what you have logged, no food stands out. Keep logging: with more days we will see more.')}</Text>
              </View>
            )}

            {a.patterns.map((p) => renderPattern(p, a))}

            {/* Cada cuánto sueles tomarlo: es la comparación; lo que falta, primero */}
            {!sample && (a.missingUsual.length > 0 || Object.keys(usual).length > 0) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('How often you usually have them')}</Text>
                <Text style={styles.body}>{t('We compare with this. Change it if it is not right.')}</Text>
                {[...a.missingUsual, ...FOOD_GROUPS.map((g) => g.id).filter((g) => usual[g])].map((g) => (
                  <View key={g} style={styles.usualRow}>
                    <Text style={styles.usualTitle}>
                      {groupLabel(g)}
                      {!usual[g] ? ` · ${t('Not answered yet')}` : ''}
                    </Text>
                    <ChoiceChips
                      options={USUAL_FREQUENCIES.map((o) => ({ id: o.id, label: t(o.label) }))}
                      value={usual[g]}
                      onChange={(v) => setUsualFor(g, v)}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.footer}>
            {t('This is guidance from your own notes, not a diagnosis. We do not recommend IgG "food intolerance" tests: the allergy societies (EAACI, AAAAI) advise against using them for diagnosis.')}
          </Text>
          <InfoButton topic="gut_patterns" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginBottom: 12 },
  sample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
  },
  sampleText: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 6,
  },
  alarm: { borderColor: withAlpha(Colors.danger, 0.5) },
  safety: { borderColor: withAlpha(Colors.gold, 0.5) },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  numbers: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  gated: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, fontStyle: 'italic', marginTop: 4 },
  suggestion: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider, gap: 6 },
  suggestionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  warning: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: withAlpha(Colors.attention, 0.1),
  },
  warningText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  prep: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  usualRow: { gap: 8, marginTop: 10 },
  usualTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.divider, overflow: 'hidden', marginVertical: 4 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.green },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 20, marginTop: 8 },
  footer: { flex: 1, color: Colors.textMuted, fontSize: 11, lineHeight: 16 },
});
