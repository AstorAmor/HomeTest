import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { InfoButton } from '@/components/InfoButton';
import { evidenceTopic } from '@/data/evidence';
import { familyHistoryStore } from '@/data/familyHistoryStore';
import { profileRepository } from '@/data/profileRepository';
import { AGE_LABEL, CANCER_LABEL, RELATION_GROUPS, RELATIONS } from '@/data/genetics/scoring';
import { assessFamilyHistory, cancerTypesFor, LEVEL_TEXT, REFERRAL_INTRO } from '@/logic/genetics';
import { t as tr } from '@/i18n';
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

// "Know your roots": embudo como en la primera visita a un asesor genético.
// Bloque 1, cribado rápido (sí / no / no lo sé, inspirado en el PAT): si todo es negativo, termina.
// Bloque 2, solo si algo es positivo: quién, qué cáncer y a qué edad (lo que pide el Ontario FHAT).
// Bloque 3, resultado: PAT + FHAT + Manchester + criterios de Lynch (src/logic/genetics.ts).
// Cada respuesta se guarda al momento (user_flags) para retomar en la misma pregunta.

type TriageStep = TriageId | 'ashkenazi';

const TRIAGE: { id: TriageStep; title: string; hint?: string; icon: string }[] = [
  {
    id: 'breast',
    title: 'Has anyone in your family had breast cancer?',
    hint: 'Blood relatives on both sides, women and men: parents, brothers and sisters, children, grandparents, aunts, uncles, cousins.',
    icon: 'ribbon',
  },
  { id: 'ovarian', title: 'Has anyone in your family had ovarian cancer?', hint: 'Including cancer of the fallopian tubes or the peritoneum.', icon: 'flower-outline' },
  {
    id: 'bowel',
    title: 'Has anyone in your family had bowel or womb cancer?',
    hint: 'Colorectal or endometrial cancer. Also cancer of the small intestine, the stomach, or the kidney pelvis or ureter.',
    icon: 'stomach',
  },
  { id: 'pancreas_prostate', title: 'Has anyone in your family had pancreatic or prostate cancer?', icon: 'account-group-outline' },
  {
    id: 'variant',
    title: 'Has a relative had a genetic test that found a change linked to cancer?',
    hint: 'For example in BRCA1, BRCA2 or a Lynch syndrome gene.',
    icon: 'dna',
  },
  { id: 'ashkenazi', title: 'Is any of your family of Ashkenazi Jewish origin?', hint: 'Some inherited changes are more common in this ancestry.', icon: 'earth' },
  { id: 'self_cancer', title: 'Have you yourself ever had cancer?', hint: 'Any cancer, even if it was a long time ago.', icon: 'account-outline' },
  {
    id: 'heart_early',
    title: 'Did a parent, brother, sister or child have heart disease or a stroke young?',
    hint: 'A heart attack, a stent or bypass, or a stroke before 55 in men or before 65 in women.',
    icon: 'heart-pulse',
  },
  {
    id: 'cholesterol',
    title: 'Does very high cholesterol run in your close family?',
    hint: 'For example, someone told they have familial hypercholesterolaemia.',
    icon: 'water-outline',
  },
  { id: 'sudden_death', title: 'Did a relative die suddenly at a young age, without a clear cause?', icon: 'heart-flash' },
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
    await Share.share({ message });
  } catch {
    try {
      await (globalThis as any).navigator?.clipboard?.writeText(message);
      (globalThis as any).alert?.('Copied. Paste it in a message or an email to your doctor.');
    } catch {
      // nada más que hacer
    }
  }
}

const pronoun = (r: Relative) => (r.relation === 'self' ? 'you' : RELATIONS[r.relation].sex === 'M' ? 'he' : 'she');

export const KnowYourRootsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string; edit?: string }>();
  const [answers, setAnswers] = useState<FamilyHistoryAnswers>(EMPTY);
  const [step, setStep] = useState('intro');
  const [loaded, setLoaded] = useState(false);
  const [resumeAt, setResumeAt] = useState<string | null>(null);
  const [selfSex, setSelfSex] = useState<'female' | 'male' | undefined>();
  const [showScores, setShowScores] = useState(false);
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
      'Family history (Kuova · Know your roots)',
      '',
      LEVEL_TEXT[result.level].title,
      '',
      ...(result.level === 'moderate' || result.level === 'high' ? [REFERRAL_INTRO, ''] : []),
      ...result.keyPoints.map((p) => `• ${p}`),
      ...(result.heart.points.length ? ['', 'Heart:', ...result.heart.points.map((p) => `• ${p}`)] : []),
      '',
      'This is guidance from validated screening tools (PAT, Ontario FHAT, Manchester, Amsterdam II / Bethesda), not a diagnosis.',
    ].join('\n');

  // ── Barra de progreso: 3 tramos fijos, el actual se llena ──
  const block = blockOf(step);
  const blockSteps = steps.filter((s) => blockOf(s) === block);
  const inBlock = blockSteps.indexOf(step);
  const fill = (b: number) => (b < block ? 1 : b > block ? 0 : block === 3 ? 1 : (inBlock + 1) / Math.max(1, blockSteps.length));

  if (!loaded) return <SafeAreaView style={styles.safeArea} />;

  const triage = step.startsWith('t:') ? TRIAGE.find((t) => `t:${t.id}` === step) : undefined;
  const sources = evidenceTopic('family_history')?.sources ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={viewOnly ? () => router.back() : goBack} accessibilityLabel={tr('Back')}>
          <Ionicons name={index > 0 && !viewOnly ? 'chevron-back' : 'close'} size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.segments}>
            {[1, 2, 3].map((b) => (
              <View key={b} style={styles.segment}>
                <View style={[styles.segmentFill, { width: `${fill(b) * 100}%` }]} />
              </View>
            ))}
          </View>
          {block > 0 && <Text style={styles.blockLabel}>{tr('{n} of 3 · {what}', { n: block, what: tr(BLOCKS[block - 1]) })}</Text>}
        </View>
        {step !== 'intro' && step !== 'result' ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.exit}>{tr('Save & exit')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 'intro' && (
          <>
            <MaterialCommunityIcons name="family-tree" size={40} color={Colors.gold} style={styles.icon} />
            <Text style={[styles.title, { textAlign: 'center' }]}>{tr('Know your roots')}</Text>
            <Text style={[styles.subtitle, { textAlign: 'center' }]}>
              {tr('The questions a genetic counsellor asks at a first visit. Your answers show whether your family history is worth talking about with a professional.')}
            </Text>
            {resumeAt && (
              <View style={styles.resume}>
                <Ionicons name="bookmark-outline" size={18} color={Colors.gold} />
                <Text style={styles.resumeText}>
                  You stopped at question {Math.max(1, buildSteps(answers).indexOf(resumeAt))}. Your answers are saved.
                </Text>
              </View>
            )}
            <View style={styles.card}>
              <View style={styles.timeHeader}>
                <Ionicons name="time-outline" size={18} color={Colors.accent} />
                <Text style={styles.timeTitle}>{tr('About 4–6 minutes')}</Text>
              </View>
              {[
                ['1', 'Quick check', 'About 1 minute · 10 yes/no questions'],
                ['2', 'Your family', '2–4 minutes · only if something comes up'],
                ['3', 'Your result', '1 minute · what to tell your doctor'],
              ].map(([n, t, s]) => (
                <View key={n} style={styles.timeRow}>
                  <Text style={styles.timeNum}>{n}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeRowTitle}>{tr(t)}</Text>
                    <Text style={styles.timeRowSub}>{tr(s)}</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.small}>{tr('Every answer is saved as you go. You can close the app and continue at the same question.')}</Text>
            </View>
            <View style={styles.note}>
              <Ionicons name="lock-closed-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.noteText}>
                {tr('Only you see this. Family history is sensitive health data: it is never shared unless you choose to share it.')}
              </Text>
            </View>
            <View style={styles.note}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.noteText}>{tr('Guidance to talk to a professional, not a diagnosis.')}</Text>
            </View>
          </>
        )}

        {triage && (
          <>
            <MaterialCommunityIcons name={triage.icon as any} size={34} color={Colors.gold} style={styles.icon} />
            <Text style={styles.title}>{tr(triage.title)}</Text>
            {triage.hint ? <Text style={styles.subtitle}>{tr(triage.hint)}</Text> : <View style={{ height: 12 }} />}
            {(triage.id === 'ashkenazi' ? ASHKENAZI : YES_NO).map((o) => {
              const value = triage.id === 'ashkenazi' ? answers.ashkenazi : answers.triage[triage.id as TriageId];
              const on = value === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.option, on && styles.optionOn]}
                  onPress={() => answerTriage(triage.id, o.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.optionText, on && styles.optionTextOn]}>{tr(o.label)}</Text>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? Colors.gold : Colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 'genes' && (
          <>
            <MaterialCommunityIcons name="dna" size={34} color={Colors.gold} style={styles.icon} />
            <Text style={styles.title}>{tr('Which gene was it?')}</Text>
            <Text style={styles.subtitle}>{tr('If you have the report, it is worth bringing to your appointment. Optional.')}</Text>
            <View style={styles.chips}>
              {GENES.map((g) => {
                const on = (answers.knownGenes ?? []).includes(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() =>
                      update((a) => ({
                        ...a,
                        knownGenes: on ? (a.knownGenes ?? []).filter((x) => x !== g.id) : [...(a.knownGenes ?? []), g.id],
                      }))
                    }
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? `✓ ${tr(g.label)}` : tr(g.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 'people' && (
          <>
            <Text style={styles.title}>{tr('Who had cancer?')}</Text>
            <Text style={styles.subtitle}>
              {tr('Tap everyone you know of. If there were two aunts, add two. Only blood relatives.')}
            </Text>
            {RELATION_GROUPS.map((g) => (
              <View key={g.title} style={{ marginBottom: 14 }}>
                <Text style={styles.groupTitle}>{tr(g.title)}</Text>
                <View style={styles.chips}>
                  {g.ids.map((id) => {
                    const n = countOf(id);
                    const info = RELATIONS[id];
                    if (n > 0 && info.plural) {
                      return (
                        <View key={id} style={[styles.chip, styles.chipOn, styles.counter]}>
                          <TouchableOpacity onPress={() => removeRelative(id)} hitSlop={8} accessibilityLabel={tr('One less: {who}', { who: tr(info.short) })}>
                            <Ionicons name="remove-circle-outline" size={20} color={Colors.gold} />
                          </TouchableOpacity>
                          <Text style={[styles.chipText, styles.chipTextOn]}>
                            {tr(info.short)}
                            {n > 1 ? ` ×${n}` : ''}
                          </Text>
                          <TouchableOpacity onPress={() => addRelative(id)} hitSlop={8} accessibilityLabel={tr('One more: {who}', { who: tr(info.short) })}>
                            <Ionicons name="add-circle-outline" size={20} color={Colors.gold} />
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.chip, n > 0 && styles.chipOn]}
                        onPress={() => (n > 0 ? removeRelative(id) : addRelative(id))}
                      >
                        <Text style={[styles.chipText, n > 0 && styles.chipTextOn]}>{n > 0 ? `✓ ${info.short}` : info.short}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}

        {step.startsWith('types:') && (
          <>
            <Text style={styles.position}>{current ? relTitle(current) : tr('You')}</Text>
            <Text style={styles.title}>{step === 'types:self' ? tr('Which cancer did you have?') : tr(`Which cancer did ${current ? pronoun(current) : 'they'} have?`)}</Text>
            <Text style={styles.subtitle}>{tr('Pick one or more.')}</Text>
            <View style={styles.chips}>
              {cancerTypesFor(answers, step === 'types:self', step === 'types:self' ? 'self' : RELATIONS[current?.relation ?? 'mother'].sex, selfSex).map((t) => {
                const on = !!current?.cancers.some((c) => c.type === t);
                return (
                  <TouchableOpacity key={t} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleType(step.slice(6), t)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? `✓ ${tr(CANCER_LABEL[t])}` : tr(CANCER_LABEL[t])}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step.startsWith('age:') && current && (() => {
          const type = step.split(':')[2] as CancerType;
          const cancer = current.cancers.find((c) => c.type === type);
          const self = current.relation === 'self';
          return (
            <>
              <Text style={styles.position}>
                {relTitle(current)} · {tr(CANCER_LABEL[type])}
              </Text>
              <Text style={styles.title}>{self ? tr('How old were you when it was diagnosed?') : tr(`How old was ${pronoun(current)} when it was diagnosed?`)}</Text>
              <Text style={styles.subtitle}>{tr('A rough guess is fine. The age is what changes the risk most.')}</Text>
              <ChoiceChips
                options={AGES.map((a) => ({ id: a, label: tr(AGE_LABEL[a]) }))}
                value={cancer?.ageGiven ? cancer.age : undefined}
                onChange={(v) => setCancer(step.split(':')[1], type, { age: v as AgeBand })}
              />
              {type === 'breast' && (
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setCancer(step.split(':')[1], type, { bilateral: !cancer?.bilateral })}
                  activeOpacity={0.85}
                >
                  <Ionicons name={cancer?.bilateral ? 'checkbox' : 'square-outline'} size={22} color={cancer?.bilateral ? Colors.gold : Colors.textMuted} />
                  <Text style={styles.checkText}>{tr('It was in both breasts (or in several places in one)')}</Text>
                </TouchableOpacity>
              )}
            </>
          );
        })()}

        {step === 'heart-who' && (
          <>
            <MaterialCommunityIcons name="heart-pulse" size={34} color={Colors.gold} style={styles.icon} />
            <Text style={styles.title}>{tr('Who had heart disease young?')}</Text>
            <Text style={styles.subtitle}>{tr('Optional, but it helps your doctor.')}</Text>
            <View style={styles.chips}>
              {FIRST_DEGREE.map((id) => {
                const on = (answers.heartRelatives ?? []).includes(id);
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() =>
                      update((a) => ({
                        ...a,
                        heartRelatives: on ? (a.heartRelatives ?? []).filter((x) => x !== id) : [...(a.heartRelatives ?? []), id],
                      }))
                    }
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? `✓ ${RELATIONS[id].short}` : RELATIONS[id].short}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 'result' && (
          <>
            <MaterialCommunityIcons name="dna" size={34} color={Colors.gold} style={styles.icon} />
            <Text style={[styles.title, { textAlign: 'center' }]}>{tr('Your family history')}</Text>
            <View
              style={[
                styles.levelCard,
                (result.level === 'moderate' || result.level === 'high') && { borderColor: withAlpha(Colors.gold, result.level === 'high' ? 0.9 : 0.5) },
              ]}
            >
              <View style={[styles.levelTag, { backgroundColor: withAlpha(result.level === 'population' || result.level === 'low' ? Colors.green : Colors.gold, 0.16) }]}>
                <Text style={[styles.levelTagText, { color: result.level === 'population' || result.level === 'low' ? Colors.green : Colors.gold }]}>
                  {result.level === 'population' ? tr('Population risk') : result.level === 'low' ? tr('Low risk') : result.level === 'moderate' ? tr('Moderate risk') : tr('High risk')}
                </Text>
              </View>
              <Text style={styles.levelTitle}>{LEVEL_TEXT[result.level].title}</Text>
              <Text style={styles.levelBody}>{LEVEL_TEXT[result.level].body}</Text>
              {result.reasons.length > 0 && result.level !== 'low' && (
                <View style={{ marginTop: 8, gap: 6 }}>
                  {result.reasons.map((r) => (
                    <View key={r} style={styles.bullet}>
                      <Ionicons name="ellipse" size={6} color={Colors.textMuted} style={{ marginTop: 7 }} />
                      <Text style={styles.bulletText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {(result.level === 'moderate' || result.level === 'high') && (
              <View style={styles.card}>
                <Text style={styles.referral}>{REFERRAL_INTRO}</Text>
                {result.keyPoints.map((p) => (
                  <View key={p} style={styles.bullet}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={Colors.gold} style={{ marginTop: 2 }} />
                    <Text style={styles.bulletText}>{p}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.push({ pathname: '/professionals', params: { role: 'geneticist' } })}
                >
                  <MaterialCommunityIcons name="dna" size={18} color={Colors.background} />
                  <Text style={styles.primaryButtonText}>{tr('Find a genetic counsellor')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => shareSummary(shareText())}>
                  <Ionicons name="share-outline" size={18} color={Colors.accent} />
                  <Text style={styles.secondaryButtonText}>{tr('Share with my doctor')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {(result.level === 'population' || result.level === 'low') && result.keyPoints.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{tr('Worth remembering')}</Text>
                {result.keyPoints.map((p) => (
                  <View key={p} style={styles.bullet}>
                    <Ionicons name="ellipse" size={6} color={Colors.textMuted} style={{ marginTop: 7 }} />
                    <Text style={styles.bulletText}>{p}</Text>
                  </View>
                ))}
              </View>
            )}

            {result.heart.flagged && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="heart-pulse" size={18} color={Colors.coral} />
                  <Text style={styles.cardTitle}>{tr('Your heart')}</Text>
                </View>
                {result.heart.points.map((p) => (
                  <View key={p} style={styles.bullet}>
                    <Ionicons name="ellipse" size={6} color={Colors.textMuted} style={{ marginTop: 7 }} />
                    <Text style={styles.bulletText}>{p}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.howRow} onPress={() => setShowScores((v) => !v)} activeOpacity={0.85}>
              <Text style={styles.howText}>{tr('How we got this')}</Text>
              <InfoButton topic="family_history" />
              <View style={{ flex: 1 }} />
              <Ionicons name={showScores ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {showScores && (
              <View style={styles.card}>
                {[
                  ['Pedigree Assessment Tool', `Mother's side ${result.pat.maternal} · Father's side ${result.pat.paternal}`, `Referral from ${result.pat.threshold}`],
                  ['Ontario FHAT', `Mother's side ${result.fhat.maternal} · Father's side ${result.fhat.paternal}`, `Referral from ${result.fhat.threshold}`],
                  [
                    'Manchester score',
                    `Mother's side ${result.manchester.maternal.combined} · Father's side ${result.manchester.paternal.combined} (BRCA1 ${result.manchester.best.brca1}, BRCA2 ${result.manchester.best.brca2})`,
                    '15 ≈ 10% chance in the affected relative; 20 for relatives without cancer',
                  ],
                  [
                    'Lynch syndrome criteria',
                    result.lynch.amsterdamLike ? tr('Amsterdam II pattern') : result.lynch.bethesdaLike ? tr('Bethesda criteria met') : tr('Not met'),
                    'Bowel, womb and related cancers',
                  ],
                ].map(([t, v, s]) => (
                  <View key={t} style={styles.scoreRow}>
                    <Text style={styles.scoreTitle}>{t}</Text>
                    <Text style={styles.scoreValue}>{v}</Text>
                    <Text style={styles.scoreSub}>{s}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.disclaimer}>
              {tr('This is not a diagnosis. Only a genetic test, interpreted by a professional, can confirm whether there is an inherited change in your family. Scoring pending review by our medical advisor.')}
            </Text>

            <Text style={styles.refsTitle}>{tr('References')}</Text>
            {sources.map((s) => (
              <TouchableOpacity key={s.label} onPress={() => s.url && Linking.openURL(s.url)} disabled={!s.url}>
                <Text style={styles.ref}>{s.label}</Text>
              </TouchableOpacity>
            ))}

            {!viewOnly && (
              <TouchableOpacity style={styles.linkRow} onPress={() => setStep('t:breast')}>
                <Text style={styles.link}>{tr('Change my answers')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {!triage && (
        <TouchableOpacity
          style={[styles.cta, !canContinue && styles.ctaDisabled]}
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
        >
          <Text style={styles.ctaText}>
            {step === 'intro'
              ? resumeAt
                ? tr('Continue where I left off')
                : tr('Start')
              : step === 'result'
                ? tr('Done')
                : (step === 'genes' && !(answers.knownGenes ?? []).length) || (step === 'heart-who' && !(answers.heartRelatives ?? []).length)
                  ? tr('Skip')
                  : tr('Continue')}
          </Text>
        </TouchableOpacity>
      )}
      {step === 'intro' && resumeAt && (
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => {
            setAnswers(EMPTY);
            setResumeAt(null);
            familyHistoryStore.clearDraft();
            setStep('t:breast');
          }}
        >
          <Text style={styles.link}>{tr('Start again')}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  circleButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center' },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.divider, overflow: 'hidden' },
  segmentFill: { height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  blockLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 5 },
  exit: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28 },
  icon: { alignSelf: 'center', marginBottom: 10 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  position: { color: Colors.gold, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 16, marginBottom: 14, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  timeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  timeTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  timeRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 4 },
  timeNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
    backgroundColor: withAlpha(Colors.gold, 0.16),
    color: Colors.gold,
    fontWeight: '800',
    fontSize: 12,
  },
  timeRowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  timeRowSub: { color: Colors.textSecondary, fontSize: 12 },
  small: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  resume: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: withAlpha(Colors.gold, 0.12), borderRadius: 12, padding: 12, marginBottom: 14 },
  resumeText: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8, paddingHorizontal: 2 },
  noteText: { flex: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  optionOn: { borderColor: Colors.gold, backgroundColor: withAlpha(Colors.gold, 0.1) },
  optionText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  optionTextOn: { color: Colors.textPrimary, fontWeight: '800' },
  groupTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14 },
  chipOn: { borderColor: Colors.gold, backgroundColor: withAlpha(Colors.gold, 0.12) },
  chipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: Colors.textPrimary },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  checkText: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  levelCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, padding: 16, marginVertical: 14, gap: 6 },
  levelTag: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  levelTagText: { fontSize: 12, fontWeight: '800' },
  levelTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  levelBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  referral: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  bullet: { flexDirection: 'row', gap: 8 },
  bulletText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  primaryButton: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 24,
    paddingVertical: 11,
  },
  secondaryButtonText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  howText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  scoreRow: { paddingVertical: 4 },
  scoreTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  scoreValue: { color: Colors.textSecondary, fontSize: 13 },
  scoreSub: { color: Colors.textMuted, fontSize: 11 },
  disclaimer: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  refsTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 6 },
  ref: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginBottom: 6, textDecorationLine: 'underline' },
  linkRow: { alignItems: 'center', paddingVertical: 10 },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  cta: { backgroundColor: Colors.accent, borderRadius: 30, paddingVertical: 15, alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  ctaDisabled: { backgroundColor: Colors.cardBorder },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
});
