import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CometLine } from '@/components/CometLine';
import { InfoButton } from '@/components/InfoButton';
import { SecHead, Tag } from '@/components/fine/Fine';
import { FButton, FChip, FChips, FLink, FOption, formStyles, ON_BG } from '@/components/fine/FineForm';
import { CheckRow } from '@/components/fine/FineMeasure';
import { evidenceTopic } from '@/data/evidence';
import { familyHistoryStore } from '@/data/familyHistoryStore';
import { profileRepository } from '@/data/profileRepository';
import { AGE_LABEL, CANCER_LABEL, RELATION_GROUPS, RELATIONS } from '@/data/genetics/scoring';
import { assessFamilyHistory, cancerTypesFor, LEVEL_TEXT, REFERRAL_INTRO } from '@/logic/genetics';
import { t as tr } from '@/i18n';
import { expectSystemUi } from '@/utils/systemUi';
import {
  AgeBand,
  AshkenaziAnswer,
  CancerType,
  FamilyHistoryAnswers,
  KnownGene,
  RelationId,
  Relative,
  TriageId,
  YesNo,
} from '@/types/familyHistory';
import { FINE, ff, fine } from '@/theme/fine';

// "Know your roots": embudo como en la primera visita a un asesor genético.
// Bloque 1, cribado rápido (sí / no / no lo sé, inspirado en el PAT): si todo es negativo, termina.
// Bloque 2, solo si algo es positivo: quién, qué cáncer y a qué edad (lo que pide el Ontario FHAT).
// Bloque 3, resultado: PAT + FHAT + Manchester + criterios de Lynch (src/logic/genetics.ts).
// Cada respuesta se guarda al momento (user_flags) para retomar en la misma pregunta.
// Rediseño del 2026-11-17 (lenguaje fino, src/theme/fine.ts). El fundador: «Conoce tus raíces… tampoco está
// actualizado el formato» y, de «Quién cuenta»: «lo pondría como pie de página, porque se repite en cada pregunta y es
// una chapa tremenda». La barra de arriba es la de los otros cuestionarios (‹ en jade y el avance como una línea
// cometa), las respuestas van en filas con una línea fina y su marca redonda o en chips con borde, sin iconos, y el
// botón de seguir, en esmeralda. «Quién cuenta» sale una sola vez, como nota apagada al pie de la primera pregunta de
// familia que se ve. El resultado, sin tarjetas de color: el nivel con su etiqueta (oro si conviene consultarlo), lo
// que decir al médico en una tarjeta casi transparente con borde de oro y el resto en secciones con cabecera pequeña.
// Las preguntas, lo que se guarda, el orden de los pasos y el cálculo no cambian.

type TriageStep = TriageId | 'ashkenazi';

// `who`: la pregunta va de familiares, así que se aclara quién cuenta. Son los mismos que se pueden
// elegir después en "¿Quién tuvo cáncer?" (RELATION_GROUPS): el PAT, el FHAT y el Manchester piden
// el parentesco y el lado de la familia, por eso aquí basta con un sí/no y el quién va después.
const TRIAGE: { id: TriageStep; title: string; hint?: string; who?: boolean }[] = [
  { id: 'breast', title: 'Has anyone in your family had breast cancer?', hint: 'Women and men.', who: true },
  { id: 'ovarian', title: 'Has anyone in your family had ovarian cancer?', hint: 'Including cancer of the fallopian tubes or the peritoneum.', who: true },
  {
    id: 'bowel',
    title: 'Has anyone in your family had bowel or womb cancer?',
    hint: 'Colorectal or endometrial cancer. Also cancer of the small intestine, the stomach, or the kidney pelvis or ureter.',
    who: true,
  },
  { id: 'pancreas_prostate', title: 'Has anyone in your family had pancreatic or prostate cancer?', who: true },
  {
    id: 'variant',
    title: 'Has a relative had a genetic test that found a change linked to cancer?',
    hint: 'For example in BRCA1, BRCA2 or a Lynch syndrome gene.',
    who: true,
  },
  { id: 'ashkenazi', title: 'Is any of your family of Ashkenazi Jewish origin?', hint: 'Some inherited changes are more common in this ancestry.' },
  { id: 'self_cancer', title: 'Have you yourself ever had cancer?', hint: 'Any cancer, even if it was a long time ago.' },
  {
    id: 'heart_early',
    title: 'Did a parent, brother, sister or child have heart disease or a stroke young?',
    hint: 'A heart attack, a stent or bypass, or a stroke before 55 in men or before 65 in women.',
  },
  {
    id: 'cholesterol',
    title: 'Does very high cholesterol run in your family?',
    hint: 'Your parents, brothers, sisters or children, or your grandparents, aunts or uncles. For example, someone told they have familial hypercholesterolaemia.',
  },
  {
    // "Antes de los 50": el antecedente familiar de la AHA (muerte súbita prematura por el corazón)
    id: 'sudden_death',
    title: 'Did a relative die suddenly at a young age, without a clear cause?',
    hint: 'Before 50, for example while sleeping or doing sport. Parents, brothers and sisters, children, grandparents, aunts, uncles or first cousins.',
  },
];

const YES_NO: { id: YesNo; label: string }[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
  { id: 'unsure', label: 'Not sure' },
];
const ASHKENAZI: { id: AshkenaziAnswer; label: string }[] = [
  { id: 'maternal', label: "Yes, on my mother's side" },
  { id: 'paternal', label: "Yes, on my father's side" },
  { id: 'both', label: 'Yes, on both sides' },
  { id: 'no', label: 'No' },
  { id: 'unsure', label: 'Not sure' },
];
const GENES: { id: KnownGene; label: string }[] = [
  { id: 'BRCA1', label: 'BRCA1' },
  { id: 'BRCA2', label: 'BRCA2' },
  { id: 'Lynch', label: 'Lynch syndrome (MLH1, MSH2, MSH6, PMS2)' },
  { id: 'other', label: 'Another gene, or not sure' },
];
const FIRST_DEGREE: RelationId[] = ['mother', 'father', 'sister', 'brother', 'daughter', 'son'];
const AGES: AgeBand[] = ['u30', '30s', '40s', '50s', '60plus', 'unknown'];
const FAMILY_CANCER: TriageId[] = ['breast', 'ovarian', 'bowel', 'pancreas_prostate'];

const EMPTY: FamilyHistoryAnswers = { triage: {}, relatives: [] };

// Pasos según lo contestado: el embudo crece solo si hace falta
function buildSteps(a: FamilyHistoryAnswers): string[] {
  const steps = ['intro', ...TRIAGE.map((t) => `t:${t.id}`)];
  if (a.triage.variant === 'yes') steps.push('genes');
  if (FAMILY_CANCER.some((id) => a.triage[id] === 'yes')) {
    steps.push('people');
    for (const r of a.relatives.filter((x) => x.relation !== 'self')) {
      steps.push(`types:${r.id}`);
      for (const c of r.cancers) if (c.type !== 'other') steps.push(`age:${r.id}:${c.type}`);
    }
  }
  if (a.triage.self_cancer === 'yes') {
    steps.push('types:self');
    const self = a.relatives.find((r) => r.relation === 'self');
    for (const c of self?.cancers ?? []) if (c.type !== 'other') steps.push(`age:self:${c.type}`);
  }
  if (a.triage.heart_early === 'yes') steps.push('heart-who');
  steps.push('result');
  return steps;
}

const blockOf = (key: string) => (key === 'intro' ? 0 : key.startsWith('t:') ? 1 : key === 'result' ? 3 : 2);
const BLOCKS = ['Quick check', 'Your family', 'Your result'];

// Lo que cuenta para el resultado: sin restos de respuestas que luego cambió a "no"
function effective(a: FamilyHistoryAnswers): FamilyHistoryAnswers {
  const family = FAMILY_CANCER.some((id) => a.triage[id] === 'yes');
  return {
    ...a,
    relatives: a.relatives.filter((r) => (r.relation === 'self' ? a.triage.self_cancer === 'yes' : family)),
    knownGenes: a.triage.variant === 'yes' ? a.knownGenes : [],
    heartRelatives: a.triage.heart_early === 'yes' ? a.heartRelatives : [],
  };
}

// Compartir el resumen; en un navegador sin "compartir", se copia
async function shareSummary(message: string) {
  try {
    // El menú de compartir sale encima de la app: que el bloqueo no la tape con la K (src/utils/systemUi.ts)
    expectSystemUi();
    await Share.share({ message });
  } catch {
    try {
      await (globalThis as any).navigator?.clipboard?.writeText(message);
      (globalThis as any).alert?.(tr('Copied. Paste it in a message or an email to your doctor.'));
    } catch {
      // nada más que hacer
    }
  }
}

const pronoun = (r: Relative) => (r.relation === 'self' ? 'you' : RELATIONS[r.relation].sex === 'M' ? 'he' : 'she');

// Puntos de una lista (lo que decir al médico, lo del corazón…): un punto apagado y el texto, sin iconos
function Dots({ items }: { items: string[] }) {
  return (
    <View style={styles.dots}>
      {items.map((p) => (
        <View key={p} style={styles.dotRow}>
          <View style={styles.dot} />
          <Text style={styles.dotText}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

// Un familiar que puede ser más de uno (tías, primos…), ya elegido: el chip con «−» y «+» a los lados
function CountChip({
  label,
  n,
  onLess,
  onMore,
  lessLabel,
  moreLabel,
}: {
  label: string;
  n: number;
  onLess: () => void;
  onMore: () => void;
  lessLabel: string;
  moreLabel: string;
}) {
  return (
    <View style={styles.count}>
      <TouchableOpacity style={styles.countButton} onPress={onLess} hitSlop={8} accessibilityRole="button" accessibilityLabel={lessLabel}>
        <Ionicons name="remove" size={16} color={FINE.jade} />
      </TouchableOpacity>
      <Text style={styles.countText}>
        {label}
        {n > 1 ? ` ×${n}` : ''}
      </Text>
      <TouchableOpacity style={styles.countButton} onPress={onMore} hitSlop={8} accessibilityRole="button" accessibilityLabel={moreLabel}>
        <Ionicons name="add" size={16} color={FINE.jade} />
      </TouchableOpacity>
    </View>
  );
}

export const KnowYourRootsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string; edit?: string }>();
  const [answers, setAnswers] = useState<FamilyHistoryAnswers>(EMPTY);
  const [step, setStep] = useState('intro');
  const [loaded, setLoaded] = useState(false);
  const [resumeAt, setResumeAt] = useState<string | null>(null);
  const [selfSex, setSelfSex] = useState<'female' | 'male' | undefined>();
  const [showScores, setShowScores] = useState(false);
  // La primera pregunta de familia que se ve en esta visita (normalmente la del cáncer de mama): solo ahí, al pie,
  // sale «Quién cuenta». Si retoma más adelante (p. ej. en la de ovario), sale en esa
  const viewOnly = params.view === 'result';
  const savedResult = useRef(false);

  useEffect(() => {
    profileRepository
      .get()
      .then((p) => setSelfSex(p.sex === 'female' || p.sex === 'male' ? p.sex : undefined))
      .catch(() => undefined);
    (async () => {
      const [draft, record] = await Promise.all([familyHistoryStore.getDraft(), familyHistoryStore.getRecord()]);
      if (viewOnly && record) {
        setAnswers(record.answers);
        setStep('result');
        savedResult.current = true;
      } else if (draft && draft.stepKey !== 'intro') {
        setAnswers(draft.answers);
        setResumeAt(draft.stepKey);
      } else if (params.edit && record) {
        setAnswers(record.answers);
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = useMemo(() => buildSteps(answers), [answers]);
  const index = Math.max(0, steps.indexOf(step));

  // Guardado automático: cada respuesta y cada paso
  useEffect(() => {
    if (!loaded || viewOnly || step === 'intro' || step === 'result') return;
    familyHistoryStore.saveDraft({ answers, stepKey: step, updatedAt: new Date().toISOString() });
  }, [answers, step, loaded, viewOnly]);

  // Al llegar al resultado: se guarda y se borra el borrador
  const result = useMemo(() => assessFamilyHistory(effective(answers), { selfSex }), [answers, selfSex]);
  useEffect(() => {
    if (step !== 'result' || savedResult.current || !loaded) return;
    savedResult.current = true;
    familyHistoryStore.saveRecord({ answers: effective(answers), level: result.level, completedAt: new Date().toISOString() });
    familyHistoryStore.clearDraft();
  }, [step, loaded, answers, result.level]);

  const goNext = (a: FamilyHistoryAnswers = answers) => {
    const list = buildSteps(a);
    const i = list.indexOf(step);
    setStep(list[Math.min(i + 1, list.length - 1)]);
  };
  const goBack = () => (index > 0 ? setStep(steps[index - 1]) : router.back());

  const update = (fn: (a: FamilyHistoryAnswers) => FamilyHistoryAnswers) => {
    savedResult.current = false; // al volver al resultado se guarda otra vez
    setAnswers((a) => fn(a));
  };

  // ── Bloque 1 ──
  const answerTriage = (id: TriageStep, value: string) => {
    const next: FamilyHistoryAnswers =
      id === 'ashkenazi'
        ? { ...answers, ashkenazi: value as AshkenaziAnswer }
        : { ...answers, triage: { ...answers.triage, [id]: value as YesNo } };
    setAnswers(next);
    savedResult.current = false;
    // Avanza solo: pocas pulsaciones, como en un cribado rápido
    setTimeout(() => goNext(next), 160);
  };

  // ── Bloque 2: familiares ──
  const countOf = (rel: RelationId) => answers.relatives.filter((r) => r.relation === rel).length;
  const addRelative = (rel: RelationId) =>
    update((a) => {
      const n = Math.max(0, ...a.relatives.filter((r) => r.relation === rel).map((r) => Number(r.id.split('#')[1]) || 0)) + 1;
      return { ...a, relatives: [...a.relatives, { id: `${rel}#${n}`, relation: rel, cancers: [] }] };
    });
  const removeRelative = (rel: RelationId) =>
    update((a) => {
      const mine = a.relatives.filter((r) => r.relation === rel);
      const last = mine[mine.length - 1];
      return { ...a, relatives: a.relatives.filter((r) => r !== last) };
    });

  const relativeById = (id: string) =>
    id === 'self' ? answers.relatives.find((r) => r.relation === 'self') : answers.relatives.find((r) => r.id === id);

  const ensureSelf = (a: FamilyHistoryAnswers) =>
    a.relatives.some((r) => r.relation === 'self') ? a : { ...a, relatives: [{ id: 'self', relation: 'self' as const, cancers: [] }, ...a.relatives] };

  const toggleType = (relId: string, type: CancerType) =>
    update((a) => {
      const base = relId === 'self' ? ensureSelf(a) : a;
      return {
        ...base,
        relatives: base.relatives.map((r) =>
          (relId === 'self' ? r.relation === 'self' : r.id === relId)
            ? {
                ...r,
                cancers: r.cancers.some((c) => c.type === type)
                  ? r.cancers.filter((c) => c.type !== type)
                  : [...r.cancers, { type, age: 'unknown' as AgeBand }],
              }
            : r
        ),
      };
    });

  const setCancer = (relId: string, type: CancerType, patch: { age?: AgeBand; bilateral?: boolean }) =>
    update((a) => ({
      ...a,
      relatives: a.relatives.map((r) =>
        (relId === 'self' ? r.relation === 'self' : r.id === relId)
          ? { ...r, cancers: r.cancers.map((c) => (c.type === type ? { ...c, ...patch, ageGiven: c.ageGiven || !!patch.age } : c)) }
          : r
      ),
    }));

  const relTitle = (r: Relative) => {
    if (r.relation === 'self') return tr('You');
    const same = answers.relatives.filter((x) => x.relation === r.relation);
    return same.length > 1 ? `${tr(RELATIONS[r.relation].label)} (${same.indexOf(r) + 1})` : tr(RELATIONS[r.relation].label);
  };

  // ── Qué se puede pulsar ──
  const current = (() => {
    if (step.startsWith('types:')) return relativeById(step.slice(6));
    if (step.startsWith('age:')) return relativeById(step.split(':')[1]);
    return undefined;
  })();
  const canContinue =
    step === 'intro' ||
    step === 'genes' ||
    step === 'heart-who' ||
    (step === 'people' && answers.relatives.some((r) => r.relation !== 'self')) ||
    (step.startsWith('types:') && !!current && current.cancers.length > 0) ||
    (step.startsWith('age:') && !!current?.cancers.find((c) => c.type === step.split(':')[2])?.ageGiven) ||
    step === 'result';

  const shareText = () =>
    [
      tr('Family history (Kuova · Know your roots)'),
      '',
      LEVEL_TEXT[result.level].title,
      '',
      ...(result.level === 'moderate' || result.level === 'high' ? [REFERRAL_INTRO, ''] : []),
      ...result.keyPoints.map((p) => `• ${p}`),
      ...(result.heart.points.length ? ['', tr('Heart:'), ...result.heart.points.map((p) => `• ${p}`)] : []),
      '',
      tr('This is guidance from validated screening tools (PAT, Ontario FHAT, Manchester, Amsterdam II / Bethesda), not a diagnosis.'),
    ].join('\n');

  // ── Avance: 3 tramos fijos (el número de pasos crece con lo contestado); el actual se llena según su paso ──
  const block = blockOf(step);
  const blockSteps = steps.filter((s) => blockOf(s) === block);
  const inBlock = blockSteps.indexOf(step);
  const fill = (b: number) => (b < block ? 1 : b > block ? 0 : block === 3 ? 1 : (inBlock + 1) / Math.max(1, blockSteps.length));
  const progress = block === 0 ? 0 : (fill(1) + fill(2) + fill(3)) / 3;
  const blockLabel = block > 0 ? tr('{n} of 3 · {what}', { n: block, what: tr(BLOCKS[block - 1]) }) : '';

  const triage = step.startsWith('t:') ? TRIAGE.find((t) => `t:${t.id}` === step) : undefined;
  // «Quién cuenta», al pie de cada pregunta que habla de «alguien de tu familia» (fundador, 2026-11-17: «lo puedes
  // repetir siempre que digas "alguien de tu familia", porque puede olvidarse»), como nota discreta, no como caja
  const showWho = !!triage?.who;

  if (!loaded) return <SafeAreaView style={styles.safeArea} />;

  const sources = evidenceTopic('family_history')?.sources ?? [];
  const triageOptions: { id: string; label: string }[] = triage?.id === 'ashkenazi' ? ASHKENAZI : YES_NO;
  const triageValue = triage ? (triage.id === 'ashkenazi' ? answers.ashkenazi : answers.triage[triage.id as TriageId]) : undefined;
  const concern = result.level === 'moderate' || result.level === 'high';
  const toCounsellor = () => router.push({ pathname: '/professionals', params: { role: 'geneticist' } });
  const back = index > 0 && !viewOnly;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* La barra de los cuestionarios (como fine/FineSteps): ‹ en jade, la línea cometa con el tramo debajo y, a la
          derecha, «Guardar y salir» */}
      <View style={styles.bar}>
        <TouchableOpacity
          style={styles.side}
          onPress={viewOnly ? () => router.back() : goBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={back ? tr('Back') : tr('Close')}
        >
          <Ionicons name={back ? 'chevron-back' : 'close'} size={24} color={FINE.jade} />
        </TouchableOpacity>
        <View
          style={styles.line}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={blockLabel || tr('Know your roots')}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        >
          <CometLine progress={progress} colors={['#2F8F70', FINE.jade]} thickness={3} />
          {blockLabel ? <Text style={styles.blockLabel}>{blockLabel}</Text> : null}
        </View>
        {step !== 'intro' && step !== 'result' ? (
          <TouchableOpacity style={styles.exitBox} onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
            <Text style={styles.exit}>{tr('Save & exit')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.side} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'intro' && (
          <>
            <Text style={styles.title}>{tr('Know your roots')}</Text>
            <Text style={styles.lead}>
              {tr('The questions a genetic counsellor asks at a first visit. Your answers show whether your family history is worth talking about with a professional.')}
            </Text>
            {resumeAt && (
              <View style={styles.resume}>
                <Text style={styles.resumeText}>
                  {tr('You stopped at question {n}. Your answers are saved.', { n: Math.max(1, buildSteps(answers).indexOf(resumeAt)) })}
                </Text>
              </View>
            )}
            {/* Los tres tramos: el número fino a la izquierda, sin círculo de color */}
            <SecHead title={tr('About 4–6 minutes')} style={styles.firstSec} />
            {[
              ['1', 'Quick check', 'About 1 minute · 10 yes/no questions'],
              ['2', 'Your family', '2–4 minutes · only if something comes up'],
              ['3', 'Your result', '1 minute · what to tell your doctor'],
            ].map(([n, t, s], i, all) => (
              <View key={n} style={[fine.row, i === all.length - 1 && styles.lastRow]}>
                <Text style={styles.stepNum}>{n}</Text>
                <View style={styles.flex}>
                  <Text style={fine.rowTitle}>{tr(t)}</Text>
                  <Text style={fine.rowSub}>{tr(s)}</Text>
                </View>
              </View>
            ))}
            <Text style={fine.note}>{tr('When we ask about your family we mean blood relatives on both sides, up to first cousins, nieces and nephews.')}</Text>
            <Text style={fine.note}>{tr('Every answer is saved as you go. You can close the app and continue at the same question.')}</Text>
            {/* La privacidad y que no es un diagnóstico, como notas apagadas debajo (antes, con su icono) */}
            <View style={styles.aside}>
              <Text style={fine.note}>
                {tr('Only you see this. Family history is sensitive health data: it is never shared unless you choose to share it.')}
              </Text>
              <Text style={fine.note}>{tr('Guidance to talk to a professional, not a diagnosis.')}</Text>
            </View>
          </>
        )}

        {triage && (
          <>
            <Text style={[styles.title, !triage.hint && styles.titleGap]}>{tr(triage.title)}</Text>
            {triage.hint ? <Text style={styles.lead}>{tr(triage.hint)}</Text> : null}
            <View>
              {triageOptions.map((o, i) => (
                <FOption
                  key={o.id}
                  title={tr(o.label)}
                  on={triageValue === o.id}
                  onPress={() => answerTriage(triage.id, o.id)}
                  last={i === triageOptions.length - 1}
                />
              ))}
            </View>
            {/* «Quién cuenta», al pie de cada pregunta de familia (fundador, 2026-11-17): nota discreta, no la caja de oro de antes */}
            {showWho && (
              <View style={styles.who}>
                <Text style={fine.kicker}>{tr('Who counts')}</Text>
                <Text style={styles.whoText}>
                  {tr('Blood relatives on both sides (your mother’s and your father’s): parents, brothers and sisters, children, grandparents, aunts and uncles, first cousins, nieces and nephews. Partners and in-laws do not count.')}
                </Text>
                <Text style={styles.whoText}>{tr('If you answer yes, next we ask who it was and at what age.')}</Text>
              </View>
            )}
          </>
        )}

        {step === 'genes' && (
          <>
            <Text style={styles.title}>{tr('Which gene was it?')}</Text>
            <Text style={styles.lead}>{tr('If you have the report, it is worth bringing to your appointment. Optional.')}</Text>
            <View style={styles.chips}>
              {GENES.map((g) => {
                const on = (answers.knownGenes ?? []).includes(g.id);
                return (
                  <FChip
                    key={g.id}
                    multi
                    check
                    label={tr(g.label)}
                    on={on}
                    onPress={() =>
                      update((a) => ({
                        ...a,
                        knownGenes: on ? (a.knownGenes ?? []).filter((x) => x !== g.id) : [...(a.knownGenes ?? []), g.id],
                      }))
                    }
                  />
                );
              })}
            </View>
          </>
        )}

        {step === 'people' && (
          <>
            <Text style={styles.title}>{tr('Who had cancer?')}</Text>
            <Text style={styles.lead}>
              {tr('Tap everyone you know of. If there were two aunts, add two. Only blood relatives; great-grandparents and second cousins are not needed.')}
            </Text>
            {RELATION_GROUPS.map((g, gi) => (
              <View key={g.title}>
                <SecHead title={tr(g.title)} style={[styles.groupHead, gi === 0 && styles.firstGroup]} />
                <View style={styles.chips}>
                  {g.ids.map((id) => {
                    const n = countOf(id);
                    const info = RELATIONS[id];
                    if (n > 0 && info.plural) {
                      return (
                        <CountChip
                          key={id}
                          label={tr(info.short)}
                          n={n}
                          onLess={() => removeRelative(id)}
                          onMore={() => addRelative(id)}
                          lessLabel={tr('One less: {who}', { who: tr(info.short) })}
                          moreLabel={tr('One more: {who}', { who: tr(info.short) })}
                        />
                      );
                    }
                    return (
                      <FChip key={id} multi check label={tr(info.short)} on={n > 0} onPress={() => (n > 0 ? removeRelative(id) : addRelative(id))} />
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}

        {step.startsWith('types:') && (
          <>
            <Text style={styles.kicker}>{current ? relTitle(current) : tr('You')}</Text>
            <Text style={styles.title}>{step === 'types:self' ? tr('Which cancer did you have?') : tr(`Which cancer did ${current ? pronoun(current) : 'they'} have?`)}</Text>
            <Text style={styles.lead}>{tr('Pick one or more.')}</Text>
            <View style={styles.chips}>
              {cancerTypesFor(answers, step === 'types:self', step === 'types:self' ? 'self' : RELATIONS[current?.relation ?? 'mother'].sex, selfSex).map((t) => (
                <FChip
                  key={t}
                  multi
                  check
                  label={tr(CANCER_LABEL[t])}
                  on={!!current?.cancers.some((c) => c.type === t)}
                  onPress={() => toggleType(step.slice(6), t)}
                />
              ))}
            </View>
          </>
        )}

        {step.startsWith('age:') && current && (() => {
          const type = step.split(':')[2] as CancerType;
          const cancer = current.cancers.find((c) => c.type === type);
          const self = current.relation === 'self';
          return (
            <>
              <Text style={styles.kicker}>
                {relTitle(current)} · {tr(CANCER_LABEL[type])}
              </Text>
              <Text style={styles.title}>{self ? tr('How old were you when it was diagnosed?') : tr(`How old was ${pronoun(current)} when it was diagnosed?`)}</Text>
              <Text style={styles.lead}>{tr('A rough guess is fine. The age is what changes the risk most.')}</Text>
              <FChips
                options={AGES.map((a) => ({ id: a, label: tr(AGE_LABEL[a]) }))}
                value={cancer?.ageGiven ? cancer.age : undefined}
                onChange={(v) => setCancer(step.split(':')[1], type, { age: v })}
              />
              {type === 'breast' && (
                <CheckRow
                  label={tr('It was in both breasts (or in several places in one)')}
                  on={!!cancer?.bilateral}
                  onPress={() => setCancer(step.split(':')[1], type, { bilateral: !cancer?.bilateral })}
                  style={styles.checkRow}
                />
              )}
            </>
          );
        })()}

        {step === 'heart-who' && (
          <>
            <Text style={styles.title}>{tr('Who had heart disease young?')}</Text>
            <Text style={styles.lead}>{tr('Optional, but it helps your doctor.')}</Text>
            <View style={styles.chips}>
              {FIRST_DEGREE.map((id) => {
                const on = (answers.heartRelatives ?? []).includes(id);
                return (
                  <FChip
                    key={id}
                    multi
                    check
                    label={tr(RELATIONS[id].short)}
                    on={on}
                    onPress={() =>
                      update((a) => ({
                        ...a,
                        heartRelatives: on ? (a.heartRelatives ?? []).filter((x) => x !== id) : [...(a.heartRelatives ?? []), id],
                      }))
                    }
                  />
                );
              })}
            </View>
          </>
        )}

        {step === 'result' && (
          <>
            <Text style={styles.title}>{tr('Your family history')}</Text>
            {/* El nivel: su etiqueta con borde (jade, o oro si conviene consultarlo), el título y lo que significa */}
            <View style={styles.tagRow}>
              <Tag
                gold={concern}
                label={result.level === 'population' ? tr('Population risk') : result.level === 'low' ? tr('Low risk') : result.level === 'moderate' ? tr('Moderate risk') : tr('High risk')}
              />
            </View>
            <Text style={styles.levelTitle}>{LEVEL_TEXT[result.level].title}</Text>
            <Text style={styles.p}>{LEVEL_TEXT[result.level].body}</Text>
            {result.reasons.length > 0 && result.level !== 'low' && <Dots items={result.reasons} />}

            {/* Lo que decir al médico: una tarjeta casi transparente con borde de oro, como en el cuestionario del ciclo */}
            {concern && (
              <View style={[styles.block, styles.blockGold]}>
                <Text style={styles.blockLead}>{REFERRAL_INTRO}</Text>
                <Dots items={result.keyPoints} />
                <FLink label={`${tr('Find a genetic counsellor')} ›`} onPress={toCounsellor} style={styles.blockLink} />
                <FLink label={`${tr('Share with my doctor')} ›`} onPress={() => shareSummary(shareText())} style={styles.blockLink} />
              </View>
            )}

            {!concern && result.keyPoints.length > 0 && (
              <>
                <SecHead title={tr('Worth remembering')} />
                <Dots items={result.keyPoints} />
              </>
            )}

            {result.heart.flagged && (
              <>
                <SecHead title={tr('Your heart')} />
                <Dots items={result.heart.points} />
              </>
            )}

            {/* Para cualquier resultado (fundador, 2026-11-09): de cara a tener hijos, el test de portadores */}
            <SecHead title={tr('If you are thinking about having children')} />
            <Text style={styles.p}>
              {tr(
                'A carrier test is highly recommended: it shows whether you and your partner carry hereditary conditions that give you no symptoms but could pass to your children. A genetic counsellor explains it and helps you decide.',
              )}
            </Text>
            <FLink label={`${tr('Talk to a genetic counsellor')} ›`} onPress={toCounsellor} style={styles.inlineLink} />
            <FLink
              label={`${tr('See the carrier test')} ›`}
              onPress={() => router.push({ pathname: '/store', params: { view: 'tests', category: 'genetic', open: 'gen_carrier' } })}
              style={styles.inlineLink}
            />

            {/* Cómo lo hemos calculado: la cabecera abre y cierra las puntuaciones; el (i), aparte (un botón no va dentro de otro) */}
            <View style={fine.secHead}>
              <TouchableOpacity
                style={styles.howToggle}
                onPress={() => setShowScores((v) => !v)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: showScores }}
              >
                <Text style={fine.secTitle}>{tr('How we got this')}</Text>
                <Ionicons name={showScores ? 'chevron-up' : 'chevron-down'} size={15} color={FINE.mute} />
              </TouchableOpacity>
              <InfoButton topic="family_history" size={17} color={FINE.mute} />
            </View>
            {showScores && (
              <View>
                {[
                  // Los nombres de las herramientas (Pedigree Assessment Tool, Ontario FHAT) se quedan como son
                  [
                    'Pedigree Assessment Tool',
                    tr("Mother's side {m} · Father's side {p}", { m: result.pat.maternal, p: result.pat.paternal }),
                    tr('Referral from {n}', { n: result.pat.threshold }),
                  ],
                  [
                    'Ontario FHAT',
                    tr("Mother's side {m} · Father's side {p}", { m: result.fhat.maternal, p: result.fhat.paternal }),
                    tr('Referral from {n}', { n: result.fhat.threshold }),
                  ],
                  [
                    tr('Manchester score'),
                    tr("Mother's side {m} · Father's side {p} (BRCA1 {b1}, BRCA2 {b2})", {
                      m: result.manchester.maternal.combined,
                      p: result.manchester.paternal.combined,
                      b1: result.manchester.best.brca1,
                      b2: result.manchester.best.brca2,
                    }),
                    tr('15 ≈ 10% chance in the affected relative; 20 for relatives without cancer'),
                  ],
                  [
                    tr('Lynch syndrome criteria'),
                    result.lynch.amsterdamLike ? tr('Amsterdam II pattern') : result.lynch.bethesdaLike ? tr('Bethesda criteria met') : tr('Not met'),
                    tr('Bowel, womb and related cancers'),
                  ],
                ].map(([t, v, s], i, all) => (
                  <View key={t} style={[styles.score, i === all.length - 1 && styles.lastRow]}>
                    <Text style={styles.scoreTitle}>{t}</Text>
                    <Text style={styles.scoreValue}>{v}</Text>
                    <Text style={fine.rowSub}>{s}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.disclaimer}>
              {tr('This is not a diagnosis. Only a genetic test, interpreted by a professional, can confirm whether there is an inherited change in your family. Scoring pending review by our medical advisor.')}
            </Text>

            {/* Las referencias, apagadas y subrayadas: se pueden abrir pero no compiten con lo de arriba */}
            <Text style={[fine.kicker, styles.refsHead]}>{tr('References')}</Text>
            {sources.map((s) => (
              <TouchableOpacity key={s.label} onPress={() => s.url && Linking.openURL(s.url)} disabled={!s.url} accessibilityRole="link">
                <Text style={styles.ref}>{s.label}</Text>
              </TouchableOpacity>
            ))}

            {!viewOnly && <FLink label={tr('Change my answers')} onPress={() => setStep('t:breast')} style={styles.change} />}
          </>
        )}
      </ScrollView>

      {!triage && (
        <View style={styles.footer}>
          <FButton
            label={
              step === 'intro'
                ? resumeAt
                  ? tr('Continue where I left off')
                  : tr('Start')
                : step === 'result'
                  ? tr('Done')
                  : (step === 'genes' && !(answers.knownGenes ?? []).length) || (step === 'heart-who' && !(answers.heartRelatives ?? []).length)
                    ? tr('Skip')
                    : tr('Continue')
            }
            disabled={!canContinue}
            onPress={() => {
              if (step === 'result') return router.back();
              if (step === 'intro' && resumeAt) {
                setStep(resumeAt);
                setResumeAt(null);
                return;
              }
              goNext();
            }}
          />
          {step === 'intro' && resumeAt && (
            <FLink
              label={tr('Start again')}
              onPress={() => {
                setAnswers(EMPTY);
                setResumeAt(null);
                familyHistoryStore.clearDraft();
                setStep('t:breast');
              }}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  // La barra de arriba, con las mismas medidas que la de fine/FineSteps
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 20, paddingTop: 6, minHeight: 50 },
  side: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, justifyContent: 'center' },
  // El tramo, debajo de la línea y alineado con su cola
  blockLabel: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 15, marginTop: 1, paddingLeft: 7 },
  exitBox: { minWidth: 40, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  exit: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
  // flexGrow: con poco contenido, «Quién cuenta» queda abajo del todo, como pie de página
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  // La pregunta de cada paso y su explicación, como en el cuestionario del ciclo
  title: { ...formStyles.q },
  titleGap: { marginBottom: 14 }, // sin explicación entre la pregunta y las respuestas
  lead: { ...formStyles.lead, marginBottom: 18 },
  // De quién se pregunta («Tía (2) · Cáncer de mama»), pequeño y en jade encima de la pregunta
  kicker: { ...fine.kicker, color: FINE.jade, marginBottom: 8 },
  firstSec: { marginTop: 8 },
  lastRow: { borderBottomWidth: 0 },
  // Entrada: dónde lo dejó, en una tarjeta casi transparente con borde de oro (es lo que hay que mirar)
  resume: { ...fine.tile, borderColor: FINE.goldLine, marginBottom: 4 },
  resumeText: { ...ff('regular'), color: FINE.ivory, fontSize: 13.5, lineHeight: 19 },
  stepNum: { ...fine.num, fontSize: 24, lineHeight: 28, width: 24 },
  aside: { marginTop: 20, paddingTop: 6, borderTopWidth: 1, borderTopColor: FINE.line },
  // «Quién cuenta»: nota apagada al pie, sobre una línea fina
  who: { marginTop: 'auto', paddingTop: 14, borderTopWidth: 1, borderTopColor: FINE.line },
  whoText: { ...fine.note, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Los grupos de familiares: la cabecera pequeña de sección, algo más junta que en las pestañas
  groupHead: { marginTop: 16, marginBottom: 12, paddingTop: 12, minHeight: 0 },
  firstGroup: { marginTop: 4 },
  // El chip elegido con «−» y «+» (como FChip elegido: borde jade y el fondo apenas marcado)
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FINE.jade,
    backgroundColor: ON_BG,
  },
  countButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  countText: { ...ff('regular'), color: FINE.ivory, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  checkRow: { marginTop: 18, borderTopWidth: 1, borderTopColor: FINE.line },
  // Resultado
  tagRow: { flexDirection: 'row', marginTop: 8, marginBottom: 10 },
  levelTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 18, lineHeight: 24, marginBottom: 6 },
  p: { ...ff('regular'), color: '#CFD6CF', fontSize: 14, lineHeight: 20 },
  dots: { gap: 6, marginTop: 10 },
  dotRow: { flexDirection: 'row', gap: 10 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: FINE.mute, marginTop: 8 },
  dotText: { flex: 1, ...ff('regular'), color: '#CFD6CF', fontSize: 13.5, lineHeight: 19 },
  block: { ...fine.tile, padding: 14, gap: 4, marginTop: 20 },
  blockGold: { borderColor: FINE.goldLine },
  blockLead: { ...ff('medium'), color: FINE.ivory, fontSize: 14.5, lineHeight: 21 },
  blockLink: { alignSelf: 'flex-start', justifyContent: 'flex-start', minHeight: 36, paddingVertical: 6 },
  inlineLink: { alignSelf: 'flex-start', justifyContent: 'flex-start', minHeight: 38, paddingVertical: 8 },
  howToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  score: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: FINE.line },
  scoreTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  scoreValue: { ...ff('regular'), color: '#CFD6CF', fontSize: 13.5, lineHeight: 19, marginTop: 2, fontVariant: ['tabular-nums'] },
  disclaimer: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 16, marginTop: 20 },
  refsHead: { marginTop: 18, marginBottom: 8 },
  ref: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 16, marginBottom: 6, textDecorationLine: 'underline' },
  change: { marginTop: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
});
