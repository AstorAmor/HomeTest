import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TestCard } from '@/components/TestCard';
import { Colors, withAlpha } from '@/constants/colors';
import { CATALOG, formatPrice, localizeTest, MEMBERSHIP } from '@/data/testCatalog';
import { getMySubscription } from '@/data/orders';
import { profileRepository, Sex } from '@/data/profileRepository';
import { getLang, t, tn } from '@/i18n';
import {
  COVERED_BY_PANEL,
  FINDER_STEPS,
  FinderAnswers,
  FinderOption,
  genderOf,
  recommend,
  toggleOption,
  visibleOptions,
} from '@/logic/testFinder';
import { TAB, tabHref } from '@/constants/tabs';

const PRICES = Object.fromEntries(CATALOG.filter((p) => p.category !== 'consultation').map((p) => [p.id, p.price]));
const TOP = 3;

const OptionIcon = ({ icon, color }: { icon: string; color: string }) =>
  icon.startsWith('mci:') ? (
    <MaterialCommunityIcons name={icon.slice(4) as any} size={17} color={color} />
  ) : (
    <Ionicons name={icon as any} size={17} color={color} />
  );

// "¿Te sientes diferente y no sabes qué analítica pedir?": 4 preguntas rápidas y, al final,
// los tests del catálogo que encajan, con la misma ficha que la tienda, para marcarlos y
// pedirlos juntos. No es consejo médico: el aviso y el acceso al médico salen siempre.
export const TestFinderScreen = () => {
  const router = useRouter();
  const scroll = useRef<ScrollView>(null);
  const [sex, setSex] = useState<Sex | undefined>();
  const [subscribed, setSubscribed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<FinderAnswers>({});
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    profileRepository.get().then((p) => setSex(p.sex)).catch(() => undefined);
    getMySubscription().then((s) => setSubscribed(!!s)).catch(() => undefined);
  }, []);

  const gender = genderOf(sex);
  const label = (o: FinderOption) => (getLang() === 'es' && o.es ? o.es[gender] : t(o.label));

  const result = useMemo(() => (done ? recommend(answers, sex, PRICES) : null), [done, answers, sex]);
  const tests = useMemo(() => new Map(CATALOG.map((p) => [p.id, localizeTest(p)])), []);

  const step = FINDER_STEPS[stepIndex];
  const chosen = answers[step.id] ?? [];

  const next = () => {
    if (stepIndex < FINDER_STEPS.length - 1) setStepIndex(stepIndex + 1);
    else {
      const r = recommend(answers, sex, PRICES);
      setSelected(r.picks.slice(0, 1).map((p) => p.id)); // el primero ya marcado: pedir es un toque
      setOpenId(null);
      setShowMore(false);
      setDone(true);
    }
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const restart = () => {
    setDone(false);
    setStepIndex(0);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const toggleSelected = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const total = selected.reduce((sum, id) => sum + (tests.get(id)?.price ?? 0), 0);

  const DoctorButton = () => (
    <TouchableOpacity style={styles.doctorBtn} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}>
      <Ionicons name="medkit-outline" size={18} color={Colors.accent} />
      <Text style={styles.doctorBtnText}>{t('Talk to a specialist')}</Text>
    </TouchableOpacity>
  );

  // ---- Preguntas ----
  if (!done) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScreenHeader title={t('Which test should I take?')} showBack backFallback={tabHref(TAB.lab)} />
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((stepIndex + 1) / FINDER_STEPS.length) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{t('{a} of {b}', { a: stepIndex + 1, b: FINDER_STEPS.length })}</Text>
        </View>
        <ScrollView ref={scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{t(step.title)}</Text>
          <Text style={styles.subtitle}>{t(step.subtitle)}</Text>
          <View style={styles.chips}>
            {visibleOptions(step, sex).map((o) => {
              const on = chosen.includes(o.id);
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setAnswers((a) => ({ ...a, [step.id]: toggleOption(step, a[step.id] ?? [], o.id) }))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <OptionIcon icon={o.icon} color={on ? Colors.accent : Colors.textSecondary} />
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{label(o)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          {stepIndex > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStepIndex(stepIndex - 1)}>
              <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
              <Text style={styles.backText}>{t('Back')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.nextBtn} onPress={next}>
            <Text style={styles.nextText}>
              {stepIndex === FINDER_STEPS.length - 1 ? t('See my tests') : chosen.length ? t('Next') : t('Skip')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Resultados ----
  const picks = result!.picks.filter((p) => tests.has(p.id));
  const top = picks.slice(0, TOP);
  const rest = picks.slice(TOP);
  const covered = [...new Set(picks.filter((p) => p.id in COVERED_BY_PANEL).map((p) => t(COVERED_BY_PANEL[p.id])))];
  const coveredText = covered.length > 1 ? `${covered.slice(0, -1).join(', ')} ${t('and')} ${covered[covered.length - 1]}` : covered[0];
  const flags = result!.flags;

  const card = (id: string, reasons: string[]) => {
    const test = tests.get(id)!;
    return (
      <TestCard
        key={id}
        test={test}
        open={openId === id}
        onToggle={() => setOpenId(openId === id ? null : id)}
        selected={selected.includes(id)}
        onSelect={() => toggleSelected(id)}
        reasons={reasons.map((r) => t(r))}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView ref={scroll} contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Which test should I take?')} showBack backFallback={tabHref(TAB.lab)} />

        <View style={styles.resultHead}>
          <Text style={styles.title}>{t('These tests could help you')}</Text>
          <Text style={styles.subtitle}>
            {t('Based on what you told us. Tick the ones you want and order them together.')}
          </Text>
        </View>

        {flags.includes('mood') && (
          <View style={[styles.note, styles.noteMood]}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.violet} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.noteText}>
                {t("If you've felt down for weeks, talk to a professional too. If you ever think about harming yourself, call 024 (free, 24 h, Spain).")}
              </Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/professionals', params: { role: 'psychologist' } })}>
                <Text style={styles.noteLink}>{t('See psychologists')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {top.map((p) => card(p.id, p.reasons))}

        {rest.length > 0 && (
          <>
            {showMore && rest.map((p) => card(p.id, p.reasons))}
            <TouchableOpacity style={styles.moreBtn} onPress={() => setShowMore((v) => !v)}>
              <Text style={styles.moreText}>
                {showMore ? t('See fewer options') : t('See more options ({n})', { n: rest.length })}
              </Text>
              <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.accent} />
            </TouchableOpacity>
          </>
        )}

        {flags.includes('allergy') && (
          <View style={styles.note}>
            <Ionicons name="flower-outline" size={18} color={Colors.green} />
            <Text style={[styles.noteText, { flex: 1 }]}>
              {t("Sneezing or itching when the weather changes may be an allergy. A doctor can tell you which allergy test you need; we don't offer it yet.")}
            </Text>
          </View>
        )}

        {/* La suscripción cubre la mayoría: se ofrece como alternativa, o se recuerda si ya la tiene */}
        {covered.length >= 2 &&
          (subscribed ? (
            <View style={styles.note}>
              <Ionicons name="star-outline" size={18} color={Colors.amber} />
              <Text style={[styles.noteText, { flex: 1 }]}>
                {t('Your subscription panel already measures {list}. If you would rather not wait for your next test, order them now.', {
                  list: coveredText,
                })}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>{t('Would you rather check everything?')}</Text>
              <Text style={styles.sectionSub}>
                {t("The subscription's full panel measures {list} and much more, twice a year.", { list: coveredText })}
              </Text>
              <TestCard
                test={localizeTest(MEMBERSHIP)}
                featured
                open
                onOrder={() => router.push({ pathname: '/checkout', params: { id: MEMBERSHIP.id } })}
              />
            </>
          ))}

        <View style={styles.disclaimer}>
          <View style={styles.disclaimerHead}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.attention} />
            <Text style={styles.disclaimerTitle}>{t('This is not medical advice')}</Text>
          </View>
          <Text style={styles.disclaimerText}>
            {t('These suggestions are based on your answers and on the most common causes; they are not a diagnosis. For a precise recommendation, talk to a doctor.')}
          </Text>
          <Text style={styles.disclaimerText}>
            {t("If you have chest pain, shortness of breath, blood in your stools or a lot of weight loss for no reason, don't wait for a test: see your doctor or go to A&E.")}
          </Text>
          <DoctorButton />
        </View>

        <View style={styles.links}>
          <TouchableOpacity onPress={() => router.push({ pathname: '/store', params: { view: 'tests' } })}>
            <Text style={styles.link}>{t('See the whole catalogue')}</Text>
          </TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={restart}>
            <Text style={styles.link}>{t('Change my answers')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.orderBar}>
        <TouchableOpacity
          style={[styles.orderBtn, !selected.length && styles.orderBtnOff]}
          disabled={!selected.length}
          onPress={() => router.push({ pathname: '/checkout', params: { ids: selected.join(',') } })}
        >
          <Ionicons name="bag-check-outline" size={18} color={selected.length ? Colors.background : Colors.textMuted} />
          <Text style={[styles.orderText, !selected.length && { color: Colors.textMuted }]}>
            {selected.length
              ? `${tn(selected.length, 'Order {n} test', 'Order {n} tests')} · ${formatPrice(total)}`
              : t('Tick at least one test')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 4 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.divider, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  progressText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  chipOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  chipTextOn: { color: Colors.textPrimary },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 26,
    paddingVertical: 14,
  },
  nextText: { color: Colors.background, fontSize: 16, fontWeight: '800' },
  results: { paddingBottom: 24 },
  resultHead: { paddingHorizontal: 20, paddingTop: 4 },
  note: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  noteMood: { borderColor: withAlpha(Colors.violet, 0.45) },
  noteText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  noteLink: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: 10 },
  moreText: { color: Colors.accent, fontSize: 14, fontWeight: '800' },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', paddingHorizontal: 20, marginTop: 10 },
  sectionSub: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, marginTop: 4, marginBottom: 12 },
  disclaimer: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(Colors.attention, 0.5),
    backgroundColor: withAlpha(Colors.attention, 0.06),
    gap: 8,
  },
  disclaimerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disclaimerTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  disclaimerText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  doctorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 24,
    paddingVertical: 12,
    marginTop: 4,
  },
  doctorBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '800' },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 18 },
  link: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  linkDot: { color: Colors.textMuted },
  orderBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderTopWidth: 1, borderTopColor: Colors.divider, backgroundColor: Colors.background },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 28,
    paddingVertical: 15,
  },
  orderBtnOff: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  orderText: { color: Colors.background, fontSize: 16, fontWeight: '800' },
});
