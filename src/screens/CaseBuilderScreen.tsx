import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NudgeTimeline, STATUS_LABEL, statusColor } from '@/components/dev/NudgeTimeline';
import { Colors } from '@/constants/colors';
import { loadPersona, localMidnight } from '@/data/simulation';
import {
  buildCase,
  CASE_DURATIONS,
  CASE_PROBLEMS,
  CaseInput,
  CaseLogging,
  CaseSeverity,
  durationText,
  LOGGING_LABEL,
  simulatePersona,
} from '@/logic/nudges';

// Developer mode → Simulated users → Build a case. Un usuario simulado hecho al momento: quién
// es, qué le va mal, con qué intensidad y desde cuándo. El mismo motor de avisos que la app dice
// qué recibe cada día; "Open the app as…" lo carga en el modo demo para verlo en las pantallas.
// Para guardarlo como caso fijo (y que los tests lo comprueben): Copy JSON → simulation/personas.

const SEX = [
  { id: 'female', label: 'Woman' },
  { id: 'male', label: 'Man' },
  { id: 'other', label: 'Other' },
] as const;
const SEVERITY: { id: CaseSeverity; label: string }[] = [
  { id: 'mild', label: 'Mild' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'severe', label: 'Severe' },
];
const AHEAD = [0, 7, 14, 28];

function Chip({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.chip, on && styles.chipOn, disabled && { opacity: 0.35 }]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

export const CaseBuilderScreen = () => {
  const start = useMemo(localMidnight, []);
  const [input, setInput] = useState<CaseInput>({
    sex: 'female',
    age: 52,
    problem: 'bp_high',
    severity: 'moderate',
    days: 56,
    logging: 'daily',
    daysAhead: 14,
  });
  const [showToday, setShowToday] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const set = <K extends keyof CaseInput>(k: K, v: CaseInput[K]) => {
    setMessage('');
    setInput((c) => {
      const next = { ...c, [k]: v };
      // La regla retrasada solo tiene sentido en una mujer
      if (k === 'sex' && v !== 'female' && next.problem === 'period_late') next.problem = 'bp_high';
      return next;
    });
  };

  const info = CASE_PROBLEMS.find((p) => p.id === input.problem)!;
  const persona = useMemo(() => buildCase(input), [input]);
  const { days } = useMemo(() => simulatePersona(persona, start), [persona, start]);
  const sent = (from: number, to: number) =>
    days.filter((d) => d.day >= from && d.day <= to).reduce((n, d) => n + d.decisions.filter((x) => x.status === 'send').length, 0);
  const today = days.find((d) => d.day === 0);

  const open = async () => {
    setLoading(true);
    try {
      await loadPersona(persona);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load this case');
      setLoading(false);
    }
  };

  const copy = async () => {
    const json = JSON.stringify(persona, null, 2);
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(json);
        setMessage(`JSON copied. Save it as simulation/personas/${persona.id}.json to keep it.`);
      } else {
        await Share.share({ message: json });
      }
    } catch {
      setMessage('Could not copy the JSON');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Build a case" showBack />
        <Text style={styles.intro}>
          Choose who they are and what goes wrong. The same engine as the app decides which notifications they get each
          day, starting after 8 normal weeks. Day 0 is today.
        </Text>

        <View style={styles.card}>
          <Field title="Sex">
            {SEX.map((s) => (
              <Chip key={s.id} label={s.label} on={input.sex === s.id} onPress={() => set('sex', s.id)} />
            ))}
          </Field>

          <Field title="Age">
            {[-5, -1].map((d) => (
              <Chip key={d} label={String(d)} on={false} onPress={() => set('age', Math.max(18, input.age + d))} />
            ))}
            <Text style={styles.age}>{input.age}</Text>
            {[1, 5].map((d) => (
              <Chip key={d} label={`+${d}`} on={false} onPress={() => set('age', Math.min(95, input.age + d))} />
            ))}
          </Field>

          <Field title="What goes wrong">
            {CASE_PROBLEMS.map((p) => (
              <Chip
                key={p.id}
                label={p.label}
                on={input.problem === p.id}
                disabled={p.femaleOnly && input.sex !== 'female'}
                onPress={() => set('problem', p.id)}
              />
            ))}
          </Field>

          {info.severity && (
            <Field title="How strong" hint={info.severity[input.severity]}>
              {SEVERITY.map((s) => (
                <Chip key={s.id} label={s.label} on={input.severity === s.id} onPress={() => set('severity', s.id)} />
              ))}
            </Field>
          )}

          <Field title={info.durationLabel} hint="Up to today">
            {CASE_DURATIONS.map((d) => (
              <Chip key={d} label={durationText(d)} on={input.days === d} onPress={() => set('days', d)} />
            ))}
          </Field>

          <Field title="Logs" hint={info.automatic ? 'Comes from the wearable every night' : undefined}>
            {(Object.keys(LOGGING_LABEL) as CaseLogging[]).map((l) => (
              <Chip
                key={l}
                label={LOGGING_LABEL[l]}
                on={input.logging === l}
                disabled={info.automatic}
                onPress={() => set('logging', l)}
              />
            ))}
          </Field>

          <Field title="And if it carries on" hint="Days simulated after today">
            {AHEAD.map((d) => (
              <Chip key={d} label={d ? `+${d} days` : 'Stop today'} on={input.daysAhead === d} onPress={() => set('daysAhead', d)} />
            ))}
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.resultTitle}>
            {persona.name}, {input.age}
          </Text>
          <Text style={styles.summary}>{persona.summary}</Text>
          <View style={styles.counts}>
            <View style={styles.count}>
              <Text style={styles.countValue}>{sent(-10000, 0)}</Text>
              <Text style={styles.countLabel}>notifications up to today</Text>
            </View>
            {input.daysAhead > 0 && (
              <View style={styles.count}>
                <Text style={styles.countValue}>{sent(1, input.daysAhead)}</Text>
                <Text style={styles.countLabel}>in the next {input.daysAhead} days</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Timeline</Text>
          <NudgeTimeline days={days} showText onlySent={!showHeld} />
          <TouchableOpacity onPress={() => setShowHeld((v) => !v)} style={styles.toggle} activeOpacity={0.8}>
            <Text style={styles.toggleText}>
              {showHeld ? 'Only show sent notifications' : 'Also show the days a notification was held back'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowToday((v) => !v)} style={styles.toggle} activeOpacity={0.8}>
            <Text style={styles.toggleText}>{showToday ? 'Hide' : 'Show'} every rule's decision today</Text>
          </TouchableOpacity>
          {showToday &&
            today?.decisions.map((x) => (
              <View key={x.id} style={styles.ruleRow}>
                <Text style={styles.ruleName}>
                  <Text style={{ color: statusColor(x.status), fontWeight: '800' }}>{STATUS_LABEL[x.status]}</Text> {x.label}
                </Text>
                <Text style={styles.ruleReason}>{x.reason}</Text>
              </View>
            ))}

          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TouchableOpacity style={styles.cta} onPress={open} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.ctaText}>Open the app as {persona.name}</Text>}
          </TouchableOpacity>
          <Text style={styles.ctaNote}>Replaces the demo data on this device with this case, up to today.</Text>
          <TouchableOpacity style={styles.secondary} onPress={copy} activeOpacity={0.85}>
            <Text style={styles.secondaryText}>Copy JSON</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
  intro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, marginBottom: 14 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    gap: 4,
  },
  field: { marginBottom: 12 },
  fieldTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  hint: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: Colors.background },
  age: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', minWidth: 44, textAlign: 'center' },
  resultTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  summary: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  counts: { flexDirection: 'row', gap: 12, marginVertical: 10 },
  count: { flex: 1, backgroundColor: Colors.accentSoft, borderRadius: 12, padding: 12 },
  countValue: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' },
  countLabel: { color: Colors.textSecondary, fontSize: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  toggle: { paddingVertical: 10 },
  toggleText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  ruleRow: { paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  ruleName: { color: Colors.textPrimary, fontSize: 12 },
  ruleReason: { color: Colors.textMuted, fontSize: 11, lineHeight: 15 },
  message: { color: Colors.textSecondary, fontSize: 12, marginTop: 8 },
  cta: { backgroundColor: Colors.accent, borderRadius: 26, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
  ctaNote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4 },
  secondary: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 26,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
});
