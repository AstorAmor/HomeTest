import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TestCard } from '@/components/TestCard';
import { SecHead } from '@/components/fine/Fine';
import { FButton, FLink, FOption, formStyles } from '@/components/fine/FineForm';
import { StepsBar } from '@/components/fine/FineSteps';
import { CATALOG, formatPrice, localizeTest, MEMBERSHIP, totalPrice } from '@/data/testCatalog';
import { getMySubscription } from '@/data/orders';
import { profileRepository, Sex } from '@/data/profileRepository';
import { getLang, t, tn } from '@/i18n';
import {
  FINDER_STEPS,
  FinderAnswers,
  FinderOption,
  genderOf,
  recommend,
  toggleOption,
  visibleOptions,
} from '@/logic/testFinder';
import { TAB, tabHref } from '@/constants/tabs';
import { FINE, ff, fine } from '@/theme/fine';

const TOP = 3;

// "¿Te sientes diferente y no sabes qué analítica pedir?": 4 preguntas rápidas y, al final,
// las pruebas del catálogo que encajan, con la misma ficha que la tienda, para marcarlas y
// pedirlas juntas, y lo que ya mide el análisis anual de la suscripción. No es consejo médico:
// el aviso y el acceso al médico salen siempre.
// En el lenguaje fino (src/theme/fine.ts) desde el 2026-11-17; el fundador: «¿no sabes cuál pedir? → Tiene la
// estética antigua». Las preguntas, como los otros cuestionarios (Conoce tus raíces, el del ciclo): arriba la barra
// con ‹ en jade y el avance como una línea cometa (StepsBar), la pregunta grande y ligera, las respuestas en filas con
// una línea fina y su marca redonda, sin iconos, y el botón de seguir en esmeralda. El resultado, sin tarjetas de
// color: las pruebas en filas (TestCard), los avisos que salen de lo contestado en una tarjeta casi transparente con
// borde de oro y el resto como notas apagadas bajo una cabecera pequeña. Las preguntas, el cálculo y lo que se pide
// no cambian.
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

  // Lo que se puede pedir: lo de «Añadir a tu seguimiento», solo con la suscripción
  const available = useMemo(() => CATALOG.filter((p) => p.orderable !== false && (subscribed || !p.withFollowUp)).map((p) => p.id), [subscribed]);
  const result = useMemo(() => (done ? recommend(answers, sex, available) : null), [done, answers, sex, available]);
  const tests = useMemo(() => new Map(CATALOG.map((p) => [p.id, localizeTest(p)])), []);

  const step = FINDER_STEPS[stepIndex];
  const chosen = answers[step.id] ?? [];

  const close = () => (router.canGoBack() ? router.back() : router.replace(tabHref(TAB.analysis) as any));

  const next = () => {
    if (stepIndex < FINDER_STEPS.length - 1) setStepIndex(stepIndex + 1);
    else {
      const r = recommend(answers, sex, available);
      setSelected(r.picks.slice(0, 1).map((p) => p.id)); // el primero ya marcado: pedir es un toque
      setOpenId(null);
      setShowMore(false);
      setDone(true);
    }
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const back = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      scroll.current?.scrollTo({ y: 0, animated: false });
    } else close();
  };

  const restart = () => {
    setDone(false);
    setStepIndex(0);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const toggleSelected = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const total = totalPrice(selected.map((id) => tests.get(id)!).filter(Boolean));

  // ---- Preguntas ----
  if (!done) {
    const options = visibleOptions(step, sex);
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StepsBar index={stepIndex} total={FINDER_STEPS.length} onBack={back} />
        <ScrollView ref={scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.q}>{t(step.title)}</Text>
          <Text style={styles.lead}>{t(step.subtitle)}</Text>
          <View>
            {options.map((o, i) => (
              <FOption
                key={o.id}
                multi
                title={label(o)}
                on={chosen.includes(o.id)}
                onPress={() => setAnswers((a) => ({ ...a, [step.id]: toggleOption(step, a[step.id] ?? [], o.id) }))}
                last={i === options.length - 1}
              />
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <FButton label={stepIndex === FINDER_STEPS.length - 1 ? t('See my tests') : chosen.length ? t('Next') : t('Skip')} onPress={next} />
        </View>
      </SafeAreaView>
    );
  }

  // ---- Resultados ----
  const picks = result!.picks.filter((p) => tests.has(p.id));
  const top = picks.slice(0, TOP);
  const rest = picks.slice(TOP);
  const covered = result!.covered.map((c) => t(c));
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
        <ScreenHeader title={t('Test finder')} showBack backFallback={tabHref(TAB.analysis)} />

        <View style={styles.pad}>
          <Text style={styles.q}>{picks.length ? t('Suggested tests') : t('Already in the yearly analysis')}</Text>
          <Text style={styles.lead}>
            {picks.length
              ? t('Based on your answers. Select the ones to order together.')
              : t('Based on your answers, no separate test adds much: the usual causes are already in the yearly analysis.')}
          </Text>

          {/* Lo que conviene hablar también con alguien, por lo contestado: tarjeta casi transparente con borde de oro,
              sin icono ni color de alarma */}
          {flags.includes('mood') && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                {t("If you've felt down for weeks, talk to a professional too. If you ever think about harming yourself, call 024 (free, 24 h, Spain).")}
              </Text>
              <FLink
                label={`${t('See psychologists')} ›`}
                onPress={() => router.push({ pathname: '/professionals', params: { role: 'psychologist' } })}
                style={styles.noticeLink}
              />
            </View>
          )}

          {flags.includes('weight_loss') && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                {t('Losing weight without trying (around 5% of your weight in 6 to 12 months) is worth telling a doctor about too, even if you feel well.')}
              </Text>
              <FLink
                label={`${t('Talk to a doctor')} ›`}
                onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}
                style={styles.noticeLink}
              />
            </View>
          )}

          {picks.length > 0 && <View style={styles.list}>{top.map((p) => card(p.id, p.reasons))}</View>}

          {rest.length > 0 && (
            <>
              {showMore && rest.map((p) => card(p.id, p.reasons))}
              <FLink
                label={showMore ? t('See fewer options') : t('See more options ({n})', { n: rest.length })}
                onPress={() => setShowMore((v) => !v)}
                style={styles.more}
              />
            </>
          )}

          {/* Lo que conviene saber de lo contestado: notas apagadas, sin icono */}
          {flags.includes('allergy') && (
            <Text style={styles.aside}>
              {t('Being sensitised to something is not the same as being allergic: an allergist reads the allergy test together with your symptoms.')}
            </Text>
          )}
          {flags.includes('stress_sleep') && (
            <Text style={styles.aside}>
              {t('No blood test measures stress or sleep. The yearly analysis does look at what often lies behind tiredness: iron, B12, TSH and vitamin D.')}
            </Text>
          )}

          {/* La suscripción cubre la mayoría: se ofrece como alternativa, o se recuerda si ya la tiene */}
          {covered.length > 0 &&
            (subscribed ? (
              <>
                <SecHead title={t('Your yearly analysis')} />
                <Text style={styles.p}>
                  {t('Your yearly analysis already measures {list}. If anything comes out of range, you can measure it again in your follow-up, 6 months later.', {
                    list: coveredText,
                  })}
                </Text>
              </>
            ) : (
              <>
                <SecHead title={picks.length ? t('Alternative: the subscription') : t('What the subscription measures')} />
                <Text style={[styles.p, styles.pGap]}>
                  {t("The subscription's yearly Kuova Baseline analysis measures {list} and much more, and the follow-up 6 months later shows whether it changes.", {
                    list: coveredText,
                  })}
                </Text>
                <TestCard
                  test={localizeTest(MEMBERSHIP)}
                  featured
                  open
                  onOrder={() => router.push({ pathname: '/checkout', params: { id: MEMBERSHIP.id } })}
                />
              </>
            ))}

          {/* No es consejo médico: siempre, al final, con el acceso al médico */}
          <SecHead title={t('This is not medical advice')} />
          <Text style={styles.note}>
            {t('These suggestions are based on your answers and on the most common causes; they are not a diagnosis. For a precise recommendation, talk to a doctor.')}
          </Text>
          <Text style={styles.note}>
            {t("If you have chest pain, shortness of breath, blood in your stools or a lot of weight loss for no reason, don't wait for a test: see your doctor or go to A&E.")}
          </Text>
          <FLink
            label={`${t('Talk to a specialist')} ›`}
            onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}
            style={styles.leftLink}
          />

          <View style={styles.links}>
            <FLink label={t('See the whole catalogue')} onPress={() => router.push({ pathname: '/store', params: { view: 'tests' } })} />
            <Text style={styles.linkDot}>·</Text>
            <FLink label={t('Change my answers')} onPress={restart} />
          </View>
        </View>
      </ScrollView>

      {picks.length > 0 && (
        <View style={[styles.footer, styles.orderBar]}>
          <FButton
            disabled={!selected.length}
            onPress={() => router.push({ pathname: '/checkout', params: { ids: selected.join(',') } })}
            label={
              selected.length
                ? `${tn(selected.length, 'Order {n} test', 'Order {n} tests')}${total != null ? ` · ${formatPrice(total)}` : ''}`
                : t('Tick at least one test')
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  pad: { paddingHorizontal: 20 },
  // La pregunta (o el título del resultado) y su explicación, como en los otros cuestionarios
  q: { ...formStyles.q },
  lead: { ...formStyles.lead, marginBottom: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  // La barra de pedir del resultado: una línea fina encima, porque la lista pasa por debajo
  orderBar: { borderTopWidth: 1, borderTopColor: FINE.line },
  results: { paddingBottom: 24 },
  notice: { ...fine.tile, borderColor: FINE.goldLine, marginBottom: 12 },
  noticeText: { ...ff('regular'), color: FINE.ivory, fontSize: 13.5, lineHeight: 19 },
  noticeLink: { alignSelf: 'flex-start', justifyContent: 'flex-start', minHeight: 36, paddingVertical: 6 },
  list: { borderTopWidth: 1, borderTopColor: FINE.line },
  more: { alignSelf: 'flex-start', justifyContent: 'flex-start', marginTop: 4 },
  aside: { ...fine.note, marginTop: 12 },
  p: { ...ff('regular'), color: '#CFD6CF', fontSize: 14, lineHeight: 20 },
  pGap: { marginBottom: 14 },
  note: { ...fine.note, marginTop: 0, marginBottom: 8 },
  leftLink: { alignSelf: 'flex-start', justifyContent: 'flex-start', minHeight: 38, paddingVertical: 8 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 18 },
  linkDot: { ...ff('regular'), color: FINE.mute },
});
