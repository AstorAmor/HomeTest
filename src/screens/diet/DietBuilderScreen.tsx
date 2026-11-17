import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CometLine } from '@/components/CometLine';
import { FButton, FChip, FLink, FOption, formStyles } from '@/components/fine/FineForm';
import { DietContext, loadDietContext } from '@/data/diet/context';
import { dietRepository } from '@/data/diet/dietRepository';
import {
  ACTIVITIES,
  ALLERGENS,
  AVOID_GROUPS,
  BUDGETS,
  DIET_GOALS,
  DIET_TYPES,
  DISLIKES,
  MARKER_NAME,
  SAFETY,
  CUSTOMS,
  SKILLS,
  SUPPLEMENTS,
} from '@/data/diet/labels';
import type { DietPrefs, ReferralReason } from '@/data/diet/types';
import { blockingReasons, DEFAULT_DIET_PREFS, newDietPlan, REFERRAL_TEXT, referralReasons } from '@/logic/dietPlanner';
import { t } from '@/i18n';
import { DIET_FEATURE, DietLocked } from '@/components/diet/TodayMenuCard';
import { SubscribePopup } from '@/components/SubscribePopup';
import { useFeature } from '@/data/access';
import { FINE, ff, fine } from '@/theme/fine';

// "Crear mi menú": una pregunta cada vez, como una conversación. Parte de lo que ya sabemos (perfil,
// analíticas, diario de Digestión) y de lo que contestó la última vez.
// Rediseño del 2026-11-16 (lenguaje fino): opciones en filas con línea fina y un círculo, chips con borde, el avance
// como una línea cometa y el botón de seguir en esmeralda.

type Option<T> = { id: T; label: string; hint?: string };

function Single<T extends string | number>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View accessibilityRole="radiogroup">
      {options.map((o, i) => (
        <FOption key={String(o.id)} title={t(o.label)} hint={o.hint ? t(o.hint) : undefined} on={o.id === value} onPress={() => onChange(o.id)} last={i === options.length - 1} />
      ))}
    </View>
  );
}

function Multi<T extends string>({ options, value, onChange, noneLabel }: { options: Option<T>[]; value: T[]; onChange: (v: T[]) => void; noneLabel?: string }) {
  return (
    <View style={styles.chips}>
      {noneLabel ? <FChip label={t(noneLabel)} on={value.length === 0} onPress={() => onChange([])} multi /> : null}
      {options.map((o) => {
        const on = value.includes(o.id);
        return <FChip key={o.id} label={t(o.label)} on={on} check multi onPress={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])} />;
      })}
    </View>
  );
}

const NumField = ({ label, value, unit, onChange }: { label: string; value: number | null; unit: string; onChange: (v: number | null) => void }) => (
  <View style={styles.numField}>
    <Text style={styles.numLabel}>{t(label)}</Text>
    <View style={styles.numRow}>
      <TextInput
        style={styles.numInput}
        keyboardType="number-pad"
        accessibilityLabel={t(label)}
        value={value === null ? '' : String(value)}
        onChangeText={(v) => {
          const n = Number(v.replace(/[^\d]/g, ''));
          onChange(v.trim() === '' || !Number.isFinite(n) ? null : n);
        }}
      />
      <Text style={styles.numUnit}>{unit}</Text>
    </View>
  </View>
);

export const DietBuilderScreen = () => {
  const router = useRouter();
  const [ctx, setCtx] = useState<DietContext | null>(null);
  const [p, setP] = useState<DietPrefs>(DEFAULT_DIET_PREFS);
  const [dislikeGroups, setDislikeGroups] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [referral, setReferral] = useState<ReferralReason[] | null>(null);

  useEffect(() => {
    (async () => {
      const [c, last] = await Promise.all([loadDietContext(), dietRepository.list()]);
      setCtx(c);
      const prev = last.find((x) => x.source === 'self')?.prefs;
      const prof = c.profile;
      const sex = prof?.sex === 'female' || prof?.sex === 'male' ? prof.sex : null;
      const conditions = (prof?.conditions ?? []).filter((x) => x !== 'none');
      setP({
        ...DEFAULT_DIET_PREFS,
        ...(prev ?? {}),
        sex: prev?.sex ?? sex,
        age: c.age ?? prev?.age ?? null,
        heightCm: prof?.heightCm ?? prev?.heightCm ?? null,
        weightKg: prof?.weightKg ?? prev?.weightKg ?? null,
        activity: prof?.activity ?? prev?.activity ?? 'light',
        conditions: [...new Set([...conditions, ...(prev?.conditions ?? [])])],
        avoidGroups: prev ? prev.avoidGroups : c.gutSuspects,
        goal: prev?.goal ?? (prof?.goals?.includes('lose_weight') ? 'lose' : prof?.goals?.includes('performance') ? 'perform' : 'health'),
        seed: (prev?.seed ?? 0) + 1,
      });
      if (prev) setDislikeGroups(DISLIKES.filter((d) => d.foods.every((f) => prev.dislikes.includes(f))).map((d) => d.id));
    })();
  }, []);

  const allowed = useFeature(DIET_FEATURE);
  const set = (patch: Partial<DietPrefs>) => setP((x) => ({ ...x, ...patch }));
  const flagged = useMemo(() => (ctx?.labs ?? []).filter((l) => MARKER_NAME[l.marker]), [ctx]);

  const finish = async () => {
    if (!ctx) return;
    const prefs: DietPrefs = { ...p, dislikes: DISLIKES.filter((d) => dislikeGroups.includes(d.id)).flatMap((d) => d.foods) };
    // Riñón, potasio, embarazo o insulina: el menú se hace, adaptado y con "Para comentar con tu médico" encima (DietScreen)
    const why = blockingReasons(referralReasons(prefs, ctx.labs));
    if (why.length) {
      setReferral(why);
      return;
    }
    setSaving(true);
    await dietRepository.save(newDietPlan(prefs, ctx.labs, { title: 'My weekly menu' }));
    router.replace('/diet');
  };

  if (allowed === false) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Create my menu')} showBack backFallback="/nutrients" />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <DietLocked />
        </ScrollView>
        <SubscribePopup feature={DIET_FEATURE} icon="silverware-fork-knife" text="A week of breakfasts, lunches and dinners made for you: your blood tests, what you like and what sits badly, your budget and your time. With recipes, photos and the shopping list." fallback="/nutrients" />
      </SafeAreaView>
    );
  }

  if (referral) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Weekly menu')} showBack backFallback="/diet" />
        <ScrollView contentContainerStyle={styles.content}>
          <Ionicons name="medkit-outline" size={28} color={FINE.gold} style={{ marginTop: 8 }} />
          <Text style={styles.q}>{t('This one is better with a dietitian')}</Text>
          {referral.map((r) => (
            <Text key={r} style={styles.text}>
              • {t(REFERRAL_TEXT[r])}
            </Text>
          ))}
          <Text style={styles.text}>{t('An automatic menu could get it wrong for you. A dietitian on Kuova can see your results and make the menu with you.')}</Text>
          <FButton label={t('Find a dietitian')} onPress={() => router.push({ pathname: '/professionals', params: { role: 'dietitian' } })} style={{ marginTop: 24 }} />
          <FLink label={t('Change my answers')} muted onPress={() => setReferral(null)} style={{ marginTop: 4 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const steps: { title: string; hint?: string; body: React.ReactNode }[] = [
    {
      title: 'Let’s make your menu',
      hint: 'A few quick questions. You can change your answers whenever you like.',
      body: (
        <View style={{ gap: 8 }}>
          {ctx?.labSource ? (
            <View style={styles.known}>
              <Text style={styles.knownTitle}>{ctx.labSource === 'sample' ? t('From the sample blood test') : t('From your last blood test')}</Text>
              {flagged.length ? (
                flagged.map((l) => (
                  <Text key={l.marker} style={styles.knownItem}>
                    • {t(MARKER_NAME[l.marker])}: {l.status === 'high' ? t('high') : t('low')}
                  </Text>
                ))
              ) : (
                <Text style={styles.knownItem}>{t('Everything that matters for food came out in range.')}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.text}>{t('When you upload a blood test, the menu will take it into account.')}</Text>
          )}
          {ctx?.gutSuspects.length ? (
            <View style={styles.known}>
              <Text style={styles.knownTitle}>{t('From your Digestion diary')}</Text>
              {ctx.gutSuspects.map((g) => (
                <Text key={g} style={styles.knownItem}>
                  • {t(AVOID_GROUPS.find((a) => a.id === g)?.label ?? g)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ),
    },
    { title: 'What is your goal?', body: <Single options={DIET_GOALS} value={p.goal} onChange={(goal) => set({ goal })} /> },
    { title: 'How do you eat?', body: <Single options={DIET_TYPES} value={p.diet} onChange={(diet) => set({ diet })} /> },
    {
      title: 'Do you follow any religious or cultural food customs?',
      hint: 'Optional. We only use it to adapt your menu.',
      body: <Multi options={CUSTOMS} value={p.customs ?? []} onChange={(customs) => set({ customs })} noneLabel="No, none" />,
    },
    {
      title: 'Any allergy or coeliac disease?',
      hint: 'These foods will never appear.',
      body: <Multi options={ALLERGENS} value={p.allergies} onChange={(allergies) => set({ allergies })} noneLabel="No allergies" />,
    },
    {
      title: 'Does anything sit badly with you?',
      hint: ctx?.gutSuspects.length ? 'We marked what your Digestion diary suggests. Change it if you like.' : 'We will leave it out of the menu.',
      body: <Multi options={AVOID_GROUPS} value={p.avoidGroups} onChange={(avoidGroups) => set({ avoidGroups })} noneLabel="Nothing" />,
    },
    { title: 'Anything you don’t like?', body: <Multi options={DISLIKES} value={dislikeGroups} onChange={setDislikeGroups} noneLabel="I like everything" /> },
    { title: 'What budget per dish?', body: <Single options={BUDGETS} value={p.budget} onChange={(budget) => set({ budget })} /> },
    {
      title: 'How much do you cook?',
      body: (
        <View style={{ gap: 14 }}>
          <Single options={SKILLS} value={p.skill} onChange={(skill) => set({ skill })} />
          <Text style={styles.sub}>{t('Time to cook a meal')}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {[15, 30, 45, 60].map((m) => (
              <FChip key={m} label={m === 60 ? t('1 hour or more') : `${m} min`} on={p.minutes === m} onPress={() => set({ minutes: m })} />
            ))}
          </View>
          <FOption
            multi
            last
            title={t('Cook once, eat twice')}
            hint={t('Tonight’s dinner is tomorrow’s lunch, when the dish allows it')}
            on={p.batch}
            onPress={() => set({ batch: !p.batch })}
          />
        </View>
      ),
    },
    {
      title: 'Snacks between meals?',
      body: (
        <Single
          options={[
            { id: 0, label: 'No snacks' },
            { id: 1, label: 'One (afternoon)' },
            { id: 2, label: 'Two (mid-morning and afternoon)' },
          ]}
          value={p.snacks}
          onChange={(snacks) => set({ snacks })}
        />
      ),
    },
    { title: 'Do you take any supplement?', body: <Multi options={SUPPLEMENTS} value={p.supplements} onChange={(supplements) => set({ supplements })} noneLabel="None" /> },
    {
      title: 'Does any of these apply to you?',
      hint: 'We adapt the menu to it and tell you what to check with your doctor. With an eating disorder, a dietitian is the better option.',
      body: <Multi options={SAFETY} value={p.safety} onChange={(safety) => set({ safety })} noneLabel="None of these" />,
    },
    {
      title: 'To get your amounts right',
      hint: 'We use them to calculate your calories. They are saved with your menu.',
      body: (
        <View style={{ gap: 12 }}>
          <Single
            options={[
              { id: 'female', label: 'Woman' },
              { id: 'male', label: 'Man' },
            ]}
            value={(p.sex ?? '') as 'female' | 'male'}
            onChange={(sex) => set({ sex })}
          />
          <View style={styles.numGrid}>
            <NumField label="Age" value={p.age} unit={t('years')} onChange={(age) => set({ age })} />
            <NumField label="Height" value={p.heightCm} unit="cm" onChange={(heightCm) => set({ heightCm })} />
            <NumField label="Weight" value={p.weightKg} unit="kg" onChange={(weightKg) => set({ weightKg })} />
          </View>
          <Text style={styles.sub}>{t('How active are you?')}</Text>
          <Single options={ACTIVITIES} value={p.activity} onChange={(activity) => set({ activity })} />
        </View>
      ),
    },
  ];

  const last = step === steps.length - 1;
  const s = steps[step];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Create my menu')} showBack backFallback="/diet" />
      {/* El avance, como una línea cometa */}
      <CometLine progress={(step + 1) / steps.length} colors={['#2F8F70', FINE.jade]} thickness={3} style={styles.progress} />
      {!ctx ? (
        <ActivityIndicator color={FINE.jade} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.q}>{t(s.title)}</Text>
          {s.hint ? <Text style={styles.text}>{t(s.hint)}</Text> : null}
          <View style={{ marginTop: 12 }}>{s.body}</View>
        </ScrollView>
      )}
      <View style={styles.bottom}>
        {step > 0 ? <FLink label={t('Back')} icon="chevron-back" muted onPress={() => setStep((x) => x - 1)} /> : <View />}
        <FButton
          label={last ? t('Create my menu') : step === 0 ? t('Start') : t('Next')}
          disabled={!ctx}
          busy={saving}
          onPress={() => (last ? finish() : setStep((x) => x + 1))}
          style={styles.next}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  progress: { marginHorizontal: 12, marginBottom: 10 },
  q: { ...formStyles.q, marginTop: 8 },
  text: { ...formStyles.lead },
  sub: { ...fine.secTitle, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Lo que ya sabemos: sin caja, con su cabecera pequeña y una línea fina debajo
  known: { gap: 4, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: FINE.line },
  knownTitle: { ...fine.secTitle, marginBottom: 2 },
  knownItem: { ...fine.body, fontSize: 14 },
  numGrid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  numField: { flex: 1, gap: 6 },
  numLabel: { ...fine.kicker },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: FINE.line, backgroundColor: FINE.tile, borderRadius: 14, paddingHorizontal: 12 },
  numInput: { ...ff('light'), flex: 1, color: FINE.ivory, fontSize: 20, paddingVertical: 8, fontVariant: ['tabular-nums'] },
  numUnit: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: FINE.line },
  next: { minWidth: 150, paddingHorizontal: 26 },
});
