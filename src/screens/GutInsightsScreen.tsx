import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { TestCard } from '@/components/TestCard';
import { CometLine } from '@/components/CometLine';
import { ringTones } from '@/components/GlowRing';
import { Chev, SecHead } from '@/components/fine/Fine';
import { FineChips, measureStyles } from '@/components/fine/FineMeasure';
import { formStyles } from '@/components/fine/FineForm';
import { Colors } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { loadGutContext, usualFoodsStore } from '@/data/digestionRepository';
import { CATALOG, localizeTest } from '@/data/testCatalog';
import {
  analyseGut,
  CONFIDENCE_LABEL,
  Confidence,
  groupLabel,
  GutAnalysis,
  GutPattern,
  MIN_EPISODES,
  TestSuggestion,
  usualLabel,
} from '@/logic/gutPatterns';
import { FOOD_GROUPS, FoodGroup } from '@/logic/foodGroups';
import { USUAL_FREQUENCIES, UsualFoods, UsualFrequency } from '@/types/digestion';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// La fiabilidad de cada patrón: una línea cometa corta (un tercio, dos o entera) y su nombre en versalitas. Jade la
// alta, oro la media y apagada la baja
const CONFIDENCE_COLOR: Record<Confidence, string> = { clear: FINE.jade, probable: FINE.gold, hint: FINE.mute };
const CONFIDENCE_TONES: Record<Confidence, readonly string[]> = {
  clear: ringTones('#83D6B4'),
  probable: ringTones('#D8B978'),
  hint: ringTones('#8D9E95'),
};
const RELIABILITY: Record<Confidence, number> = { clear: 1, probable: 2 / 3, hint: 1 / 3 };
const JADE_TONES = ringTones('#83D6B4');

// Consejos que se pueden dar aunque haya alarmas o falten las preguntas de seguridad: no son pruebas
const ADVICE_ONLY: TestSuggestion['id'][] = ['reflux_advice', 'fodmap_advice', 'trigger_advice'];

// Lo que vemos en tu digestión: alarmas primero (médico antes que pruebas), luego lo que se
// repite en tus datos con lo seguros que estamos y la prueba que tiene sentido. Lógica en
// src/logic/gutPatterns.ts. Orientación, no diagnóstico.
// Desde el 2026-11-17, en el lenguaje fino (fundador: «la estética de esta subsección tampoco es coherente con la
// nueva estética: mucho icono, otra fuente, barras de progreso poco coherentes»): sin tarjetas ni iconos, cada
// parte entre rayas finas, Inter en todo (sin cursiva, que en Android salía con otra letra), las barras como líneas
// cometa (lo que llevas apuntado y la fiabilidad de cada patrón) y lo de ir al médico en ámbar, sin rojo. La
// frecuencia con la que tomas cada alimento se llama «Frecuencia de alimentos» (antes «Frecuencia habitual», que
// no cuadraba con un «Casi nunca») y va en filas: el alimento y lo que contestaste; al tocarlo, las opciones.
export const GutInsightsScreen = () => {
  const router = useRouter();
  const [analysis, setAnalysis] = useDeepState<GutAnalysis | null>(null);
  const [sample, setSample] = useState(false);
  const [usual, setUsual] = useDeepState<UsualFoods>({});
  const [openTest, setOpenTest] = useState<string | null>(null);
  const [openUsual, setOpenUsual] = useState<FoodGroup | null>(null);
  const tests = useMemo(() => new Map(CATALOG.map((p) => [p.id, localizeTest(p)])), []);

  const load = useCallback(async () => {
    const ctx = await loadGutContext();
    setSample(ctx.sample);
    setUsual(ctx.usual);
    setAnalysis(analyseGut(ctx));
  }, [setAnalysis, setUsual]);

  const setUsualFor = async (g: FoodGroup, f: UsualFrequency) => {
    setOpenUsual(null);
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
        {/* Lo que hay que tener en cuenta antes de la prueba: en oro, sin icono ni caja de color */}
        {s.warning ? <Text style={formStyles.warn}>{s.warning}</Text> : null}
        {s.prep ? <Text style={styles.prep}>{s.prep}</Text> : null}
        {s.storeIds
          .filter((id) => tests.has(id))
          .map((id) => (
            <View key={id} style={styles.test}>
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
    <View key={p.id} style={styles.block}>
      {/* La fiabilidad, arriba y sobria: una línea cometa corta y su nombre en versalitas (fundador, 2026-11-16 y 17) */}
      <View style={styles.reliability} accessible accessibilityLabel={t(CONFIDENCE_LABEL[p.confidence])}>
        <CometLine progress={RELIABILITY[p.confidence]} colors={CONFIDENCE_TONES[p.confidence]} thickness={3} style={styles.reliabilityLine} />
        <Text style={[fine.kicker, { color: CONFIDENCE_COLOR[p.confidence] }]}>{t(CONFIDENCE_LABEL[p.confidence])}</Text>
      </View>
      <Text style={fine.rowTitle}>{p.title}</Text>
      <Text style={styles.numbers}>{p.numbers}</Text>
      {p.body ? <Text style={styles.body}>{p.body}</Text> : null}
      {p.suggestion && renderSuggestion(p.suggestion, a)}
    </View>
  );

  const a = analysis;
  // Cada cuánto tomas cada alimento: lo que falta por contestar, primero
  const usualGroups = a ? [...a.missingUsual, ...FOOD_GROUPS.map((g) => g.id).filter((g) => usual[g])] : [];
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('What we see in your digestion')} showBack backFallback="/digestive?part=gut" />
        <View style={styles.pad}>
          <Text style={styles.intro}>
            {t('We look at what you ate before each symptom and compare it with how often you usually have it. Loose stools are linked to those meals by the time.')}
          </Text>
          {sample && <Text style={styles.sample}>{t('Sample month: log your own days to see yours.')}</Text>}

          {a && (
            <View style={styles.blocks}>
              {/* Señales para ir al médico antes que a una prueba: en ámbar, sin rojo */}
              {a.alarms.length > 0 && (
                <View style={styles.block}>
                  {a.alarms.map((al) => (
                    <View key={al.id} style={styles.alarm}>
                      <View style={styles.alarmHead}>
                        <View style={styles.alarmDot} />
                        <Text style={[fine.rowTitle, styles.flex]}>{al.title}</Text>
                      </View>
                      <Text style={[styles.body, styles.alarmBody]}>{al.body}</Text>
                    </View>
                  ))}
                  <Text style={styles.doctor}>{t('Before any test, talk to a doctor.')}</Text>
                  <TouchableOpacity onPress={findDoctor} hitSlop={8} style={styles.doctorLink} accessibilityRole="link">
                    <Text style={fine.link}>{t('Find a doctor')} ›</Text>
                  </TouchableOpacity>
                </View>
              )}

              {a.safety === 'needed' && (
                <TouchableOpacity style={[styles.block, styles.rowBlock]} onPress={() => router.push('/gut-safety')} activeOpacity={0.7} accessibilityRole="button">
                  <View style={styles.flex}>
                    <Text style={fine.rowTitle}>{t('Before suggesting any test: a few quick questions')}</Text>
                    <Text style={fine.rowSub}>{t('Some signs need a doctor rather than a test. It takes 30 seconds.')}</Text>
                  </View>
                  <Chev />
                </TouchableOpacity>
              )}

              {!a.ready && (
                <View style={styles.block}>
                  <Text style={fine.rowTitle}>{t('Still learning how food sits with you')}</Text>
                  {/* Lo que llevas apuntado, en una línea cometa (como los objetivos de Hoy) */}
                  <CometLine progress={Math.min(1, a.foodEpisodes / MIN_EPISODES)} colors={JADE_TONES} thickness={3.5} style={styles.learnLine} />
                  <Text style={styles.body}>{t('{m} of {M} times with what you ate before, so far.', { m: a.foodEpisodes, M: MIN_EPISODES })}</Text>
                  <Text style={styles.prep}>{t('Each time you note something in Digestion, tell us what you ate before. On good days, tap "All good today".')}</Text>
                </View>
              )}

              {a.ready && !a.patterns.length && (
                <View style={styles.block}>
                  <Text style={fine.rowTitle}>{t('Nothing stands out yet')}</Text>
                  <Text style={styles.body}>{t('With what you have logged, no food stands out. Keep logging: with more days we will see more.')}</Text>
                </View>
              )}

              {a.patterns.map((p) => renderPattern(p, a))}
            </View>
          )}

          {/* Cada cuánto tomas cada alimento: es la comparación. Una fila por alimento con lo que contestaste; al
              tocarla salen las opciones. Lo que falta por contestar va primero y ya con las opciones a la vista */}
          {a && !sample && usualGroups.length > 0 && (
            <>
              <SecHead title={t('Food frequency')} />
              <Text style={styles.usualLead}>{t('We compare with this. Change it if it is not right.')}</Text>
              {usualGroups.map((g, i) => {
                const answered = !!usual[g];
                const open = !answered || openUsual === g;
                return (
                  <View key={g} style={[styles.usualRow, i === usualGroups.length - 1 && styles.lastRow]}>
                    <TouchableOpacity
                      style={styles.usualHead}
                      onPress={() => setOpenUsual(openUsual === g ? null : g)}
                      disabled={!answered}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      accessibilityLabel={`${groupLabel(g)}: ${answered ? usualLabel(usual[g]!) : t('Not answered yet')}`}
                    >
                      <Text style={[fine.rowTitle, styles.flex]}>{groupLabel(g)}</Text>
                      <Text style={[styles.usualValue, !answered && styles.usualMissing]} numberOfLines={1}>
                        {answered ? usualLabel(usual[g]!) : t('Not answered yet')}
                      </Text>
                    </TouchableOpacity>
                    {open && (
                      <FineChips
                        options={USUAL_FREQUENCIES.map((o) => ({ id: o.id, label: t(o.label) }))}
                        value={usual[g]}
                        onChange={(v) => setUsualFor(g, v)}
                        style={styles.usualChips}
                      />
                    )}
                  </View>
                );
              })}
            </>
          )}

          <View style={styles.footerRow}>
            <Text style={styles.footer}>
              {t('This is guidance from your own notes, not a diagnosis. We do not recommend IgG "food intolerance" tests: the allergy societies (EAACI, AAAAI) advise against using them for diagnosis.')}
            </Text>
            <InfoButton topic="gut_patterns" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  intro: { ...fine.note, fontSize: 13.5, lineHeight: 19, marginTop: 0 },
  sample: { ...fine.note, fontSize: 11.5 },
  // Cada parte, entre rayas finas (sin tarjeta)
  blocks: { marginTop: 16, borderTopWidth: 1, borderTopColor: FINE.line },
  block: { paddingVertical: 14, gap: 6, borderBottomWidth: 1, borderBottomColor: FINE.line },
  rowBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  body: { ...measureStyles.p, fontSize: 13.5, lineHeight: 19 },
  numbers: { ...ff('medium'), color: FINE.ivory, fontSize: 13.5, lineHeight: 19 },
  prep: { ...fine.note, marginTop: 0 },
  gated: { ...fine.note, marginTop: 4 },
  // Para ir al médico: un punto ámbar (no rojo) y el texto debajo
  alarm: { gap: 4, marginBottom: 6 },
  alarmHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  alarmDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: Colors.attention },
  alarmBody: { paddingLeft: 15 },
  doctor: { ...ff('medium'), color: FINE.ivory, fontSize: 13.5, lineHeight: 19, paddingLeft: 15 },
  doctorLink: { alignSelf: 'flex-start', paddingVertical: 4, paddingLeft: 15 },
  // La fiabilidad: línea cometa corta (su brillo sobresale 7 px a cada lado) y el nombre en versalitas
  reliability: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -7, marginBottom: 2 },
  reliabilityLine: { width: 62 },
  learnLine: { marginHorizontal: -8, marginVertical: 2 },
  // La prueba que tiene sentido, bajo una raya fina
  suggestion: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: FINE.line, gap: 6 },
  suggestionTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  test: { marginTop: 8 },
  // Frecuencia de alimentos: el alimento y, a la derecha, lo que contestaste (en jade: se puede cambiar)
  usualLead: { ...fine.note, marginTop: 0, marginBottom: 4 },
  usualRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: FINE.line },
  usualHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 26 },
  usualValue: { ...ff('regular'), color: FINE.jade, fontSize: 13.5, maxWidth: '55%' },
  usualMissing: { color: FINE.gold },
  usualChips: { marginTop: 10 },
  lastRow: { borderBottomWidth: 0 },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 24 },
  footer: { ...fine.note, flex: 1, fontSize: 11.5, lineHeight: 16, marginTop: 0 },
});
