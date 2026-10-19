import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
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
  SKILLS,
  SUPPLEMENTS,
} from '@/data/diet/labels';
import type { DietPrefs, ReferralReason } from '@/data/diet/types';
import { blockingReasons, DEFAULT_DIET_PREFS, newDietPlan, REFERRAL_TEXT, referralReasons } from '@/logic/dietPlanner';
import { t } from '@/i18n';
import { DIET_FEATURE, DietLocked } from '@/components/diet/TodayMenuCard';
import { useFeature } from '@/data/access';

// "Crear mi menú": una pregunta cada vez, como una conversación. Parte de lo que ya sabemos (perfil,
// analíticas, diario de Digestión) y de lo que contestó la última vez.

type Option<T> = { id: T; label: string; hint?: string };

function Single<T extends string | number>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.options}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <TouchableOpacity key={String(o.id)} style={[styles.option, on && styles.optionOn]} onPress={() => onChange(o.id)}>
            <Text style={[styles.optionTitle, on && styles.optionTitleOn]}>{t(o.label)}</Text>
            {o.hint ? <Text style={styles.optionHint}>{t(o.hint)}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Multi<T extends string>({ options, value, onChange, noneLabel }: { options: Option<T>[]; value: T[]; onChange: (v: T[]) => void; noneLabel?: string }) {
  return (
    <View style={styles.chips}>
      {noneLabel ? (
        <TouchableOpacity style={[styles.chip, value.length === 0 && styles.chipOn]} onPress={() => onChange([])}>
          <Text style={[styles.chipText, value.length === 0 && styles.chipTextOn]}>{t(noneLabel)}</Text>
        </TouchableOpacity>
      ) : null}
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <TouchableOpacity key={o.id} style={[styles.chip, on && styles.chipOn]} onPress={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}>
            {on ? <Ionicons name="checkmark" size={14} color={Colors.accent} /> : null}
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(o.label)}</Text>
          </TouchableOpacity>
        );
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
    // Riñón, potasio, embarazo o insulina: el menú se hace, adaptado y con "¡Atención!" encima (DietScreen)
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
      </SafeAreaView>
    );
  }

  if (referral) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Weekly menu')} showBack backFallback="/diet" />
        <ScrollView contentContainerStyle={styles.content}>
          <Ionicons name="medkit-outline" size={34} color={Colors.accent} />
          <Text style={styles.q}>{t('This one is better with a dietitian')}</Text>
          {referral.map((r) => (
            <Text key={r} style={styles.text}>
              • {t(REFERRAL_TEXT[r])}
            </Text>
          ))}
          <Text style={styles.text}>{t('An automatic menu could get it wrong for you. A dietitian on Kuova can see your results and make the menu with you.')}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => router.push({ pathname: '/professionals', params: { role: 'dietitian' } })}>
            <Text style={styles.primaryText}>{t('Find a dietitian')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={() => setReferral(null)}>
            <Text style={styles.linkText}>{t('Change my answers')}</Text>
          </TouchableOpacity>
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
          <View style={styles.chips}>
            {[15, 30, 45, 60].map((m) => (
              <TouchableOpacity key={m} style={[styles.chip, p.minutes === m && styles.chipOn]} onPress={() => set({ minutes: m })}>
                <Text style={[styles.chipText, p.minutes === m && styles.chipTextOn]}>{m === 60 ? t('1 hour or more') : `${m} min`}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.toggle} onPress={() => set({ batch: !p.batch })}>
            <Ionicons name={p.batch ? 'checkbox' : 'square-outline'} size={20} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>{t('Cook once, eat twice')}</Text>
              <Text style={styles.optionHint}>{t('Tonight’s dinner is tomorrow’s lunch, when the dish allows it')}</Text>
            </View>
          </TouchableOpacity>
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
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]} />
      </View>
      {!ctx ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.q}>{t(s.title)}</Text>
          {s.hint ? <Text style={styles.text}>{t(s.hint)}</Text> : null}
          <View style={{ marginTop: 12 }}>{s.body}</View>
        </ScrollView>
      )}
      <View style={styles.bottom}>
        {step > 0 ? (
          <TouchableOpacity style={styles.back} onPress={() => setStep((x) => x - 1)}>
            <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
            <Text style={styles.backText}>{t('Back')}</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <TouchableOpacity style={[styles.next, saving && { opacity: 0.6 }]} disabled={!ctx || saving} onPress={() => (last ? finish() : setStep((x) => x + 1))}>
          {saving ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.nextText}>{last ? t('Create my menu') : step === 0 ? t('Start') : t('Next')}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  progress: { height: 4, backgroundColor: Colors.cardBorder, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: 4, backgroundColor: Colors.accent },
  q: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', marginTop: 8 },
  text: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  sub: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  options: { gap: 8 },
  option: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  optionOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  optionTitle: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  optionTitleOn: { color: Colors.textPrimary },
  optionHint: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: Colors.textPrimary },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  known: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12, gap: 4 },
  knownTitle: { color: Colors.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  knownItem: { color: Colors.textPrimary, fontSize: 14 },
  numGrid: { flexDirection: 'row', gap: 10 },
  numField: { flex: 1, gap: 4 },
  numLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 10 },
  numInput: { flex: 1, color: Colors.textPrimary, fontSize: 16, paddingVertical: 8 },
  numUnit: { color: Colors.textMuted, fontSize: 13 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.divider },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 10 },
  backText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  next: { backgroundColor: Colors.accent, borderRadius: 24, paddingHorizontal: 26, paddingVertical: 13, minWidth: 140, alignItems: 'center' },
  nextText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  primary: { backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 13, alignItems: 'center', marginTop: 20 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  link: { alignItems: 'center', paddingVertical: 12 },
  linkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
