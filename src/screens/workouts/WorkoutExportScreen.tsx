import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Colors, withAlpha } from '@/constants/colors';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { programRepository } from '@/data/workouts/programRepository';
import { workoutRepository } from '@/data/planRepository';
import type { WorkoutProgram } from '@/data/workouts/types';
import { isCustomProgram } from '@/logic/customRoutine';
import type { LoggedWorkout } from '@/logic/workoutHistory';
import { buildWorkoutExport, EXPORT_PERIODS, exportFileName, sourceLine, workoutExportText, type ExportPeriod } from '@/logic/workoutExport';
import { workoutsToHtml } from '@/utils/workoutPdf';
import { shareHtmlPdf } from '@/utils/shareHtml';
import { shareText, shareTextCopies } from '@/utils/shareText';
import { t, tn } from '@/i18n';
import { INTER } from '@/theme/fine';

// Exportar el entrenamiento (Entrenamientos → Exportar, y el botón de compartir del Historial; fundador, 2026-11-09):
// el programa que eliges y lo entrenado en un periodo, en PDF para tu entrenador o como texto para una IA o un
// mensaje. Solo JavaScript (expo-print, expo-sharing y el Share de React Native ya van en las apps instaladas): llega
// con una actualización. Los datos y el texto, en src/logic/workoutExport.ts; el PDF, en src/utils/workoutPdf.ts.

// La vista previa se corta aquí (lo que se comparte va entero)
const PREVIEW_MAX = 60;

export const WorkoutExportScreen = () => {
  const { program: programParam } = useLocalSearchParams<{ program?: string }>();
  const [data, setData] = useState<{ programs: WorkoutProgram[]; logged: LoggedWorkout[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [programId, setProgramId] = useState<string | null>(null);
  const [withPlan, setWithPlan] = useState(true);
  const [withHistory, setWithHistory] = useState(true);
  const [period, setPeriod] = useState<ExportPeriod>(3);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'text' | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [programs, logged] = await Promise.all([programRepository.list(), workoutRepository.getAll()]);
      setData({ programs, logged });
      setFailed(false);
      // El que venga en la ruta; si no, el que sigues; si no, el primero
      setProgramId((cur) => (cur && programs.some((p) => p.id === cur) ? cur : (programs.find((p) => p.id === programParam) ?? programs.find((p) => p.active) ?? programs[0])?.id ?? null));
    } catch {
      setFailed(true);
    }
  }, [programParam]);
  useReloadOnFocus(load);

  const programs = data?.programs ?? [];
  const doc = useMemo(
    () => (data ? buildWorkoutExport(data.programs, data.logged, { programId: withPlan ? programId : null, period: withHistory ? period : null }) : null),
    [data, withPlan, programId, withHistory, period],
  );
  const text = useMemo(() => (doc ? workoutExportText(doc) : ''), [doc]);
  const empty = !doc || (!doc.plan && !doc.history);
  const lines = text.split('\n');

  const sendPdf = async () => {
    if (!doc || empty) return;
    setBusy('pdf');
    setStatus(null);
    try {
      const name = exportFileName();
      await shareHtmlPdf({ html: workoutsToHtml(doc, name), fileName: name, fallbackText: text, dialogTitle: t('Send your workouts') });
    } catch {
      setStatus(t('The file could not be created. Try again or send it as text.'));
    } finally {
      setBusy(null);
    }
  };
  const sendText = async () => {
    if (!doc || empty) return;
    setBusy('text');
    setStatus(null);
    try {
      const r = await shareText({ text, title: t('My workouts'), fileName: exportFileName() });
      if (r === 'copied') setStatus(t('Copied. Paste it into your AI chat or a message.'));
    } catch {
      setStatus(t('It could not be shared. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  const label = (p: WorkoutProgram) => (isCustomProgram(p) ? p.title : t(p.title));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Export')} showBack backFallback="/workouts" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          {t('Share your plan and what you have trained with your personal trainer, or paste it into an AI to help you adjust it.')}
        </Text>
        {failed && <Text style={styles.muted}>{t('Your workouts could not be loaded. Check your connection and try again.')}</Text>}
        {!data && !failed && <ActivityIndicator color={Colors.accent} style={{ marginTop: 30 }} />}

        {data && (
          <>
            {/* El plan: el programa que elijas */}
            <View style={styles.card}>
              <View style={styles.row}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{t('Plan')}</Text>
                  <Text style={styles.sub}>{programs.length ? t('Each routine with its exercises, sets, weights and rests') : t('You have no programme yet')}</Text>
                </View>
                <Switch
                  value={withPlan && programs.length > 0}
                  disabled={!programs.length}
                  onValueChange={setWithPlan}
                  trackColor={{ false: Colors.cardBorder, true: withAlpha(Colors.accent, 0.6) }}
                  thumbColor={withPlan && programs.length ? Colors.accent : Colors.textMuted}
                  accessibilityLabel={t('Plan')}
                />
              </View>
              {withPlan && programs.length > 1 && (
                <View style={styles.choices}>
                  {programs.map((p) => {
                    const on = p.id === programId;
                    return (
                      <TouchableOpacity key={p.id} style={[styles.choice, on && styles.choiceOn]} onPress={() => setProgramId(p.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                        <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? Colors.accent : Colors.textMuted} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.choiceTitle}>{label(p)}</Text>
                          <Text style={styles.sub}>{[p.active ? t('Your programme') : null, sourceLine(p)].filter(Boolean).join(' · ')}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {withPlan && programs.length === 1 && <Text style={styles.only}>{label(programs[0])}</Text>}
            </View>

            {/* El historial: lo entrenado en un periodo */}
            <View style={styles.card}>
              <View style={styles.row}>
                <Ionicons name="time-outline" size={20} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{t('History')}</Text>
                  <Text style={styles.sub}>{t('Session by session, with a summary of your progress per exercise')}</Text>
                </View>
                <Switch
                  value={withHistory}
                  onValueChange={setWithHistory}
                  trackColor={{ false: Colors.cardBorder, true: withAlpha(Colors.accent, 0.6) }}
                  thumbColor={withHistory ? Colors.accent : Colors.textMuted}
                  accessibilityLabel={t('History')}
                />
              </View>
              {withHistory && (
                <>
                  <ChoiceChips options={EXPORT_PERIODS.map((p) => ({ id: p.id, label: t(p.label) }))} value={period} onChange={setPeriod} />
                  <Text style={styles.count}>{doc?.history ? tn(doc.history.count, '{n} workout in this period', '{n} workouts in this period') : ''}</Text>
                </>
              )}
            </View>

            {/* Lo que se va a compartir, tal cual */}
            {!empty && (
              <View style={styles.card}>
                <TouchableOpacity style={styles.row} onPress={() => setPreview((v) => !v)} accessibilityRole="button">
                  <Ionicons name="eye-outline" size={20} color={Colors.accent} />
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{t('What you will share')}</Text>
                  <Ionicons name={preview ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
                {preview && (
                  <>
                    <Text style={styles.preview} selectable>
                      {lines.length > PREVIEW_MAX ? `${lines.slice(0, PREVIEW_MAX).join('\n')}\n…` : text}
                    </Text>
                    {lines.length > PREVIEW_MAX && <Text style={styles.muted}>{t('{n} more lines', { n: lines.length - PREVIEW_MAX })}</Text>}
                  </>
                )}
              </View>
            )}

            {empty && <Text style={styles.muted}>{t('Choose the plan, the history or both.')}</Text>}

            <TouchableOpacity style={[styles.primary, (empty || !!busy) && styles.off]} onPress={sendPdf} disabled={empty || !!busy}>
              {busy === 'pdf' ? <ActivityIndicator color={Colors.background} /> : <Ionicons name="document-text-outline" size={18} color={Colors.background} />}
              <Text style={styles.primaryText}>{t('PDF for your trainer')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondary, (empty || !!busy) && styles.off]} onPress={sendText} disabled={empty || !!busy}>
              {busy === 'text' ? <ActivityIndicator color={Colors.accent} /> : <Ionicons name={shareTextCopies ? 'copy-outline' : 'chatbubble-ellipses-outline'} size={18} color={Colors.accent} />}
              <Text style={styles.secondaryText}>{shareTextCopies ? t('Copy as text for an AI') : t('Text for an AI or a message')}</Text>
            </TouchableOpacity>
            {status && <Text style={styles.status}>{status}</Text>}

            <View style={styles.tip}>
              <Ionicons name="sparkles-outline" size={16} color={Colors.accent} />
              <Text style={styles.tipText}>
                {t('Paste the text into your AI (ChatGPT, Gemini, Claude…) and ask it, for example: «How do I adjust my programme to keep progressing?»')}
              </Text>
            </View>
            <Text style={styles.privacy}>{t('It does not include your name. Once shared, it leaves Kuova: share it only with whoever you want.')}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  intro: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 14, lineHeight: 20 },
  muted: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontFamily: INTER.medium },
  sub: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 12, marginTop: 2 },
  choices: { gap: 6 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, padding: 10 },
  choiceOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  choiceTitle: { color: Colors.textPrimary, fontSize: 14, fontFamily: INTER.medium },
  only: { color: Colors.textPrimary, fontSize: 14, fontFamily: INTER.medium, marginLeft: 32 },
  count: { color: Colors.textMuted, fontSize: 12, fontFamily: INTER.medium },
  preview: { color: Colors.textPrimary, fontFamily: INTER.regular, fontSize: 12, lineHeight: 17, backgroundColor: Colors.background, borderRadius: 10, padding: 10 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 13, marginTop: 4 },
  primaryText: { color: Colors.background, fontSize: 15, fontFamily: INTER.medium },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingVertical: 12 },
  secondaryText: { color: Colors.accent, fontSize: 14, fontFamily: INTER.medium },
  off: { opacity: 0.45 },
  status: { color: Colors.accent, fontSize: 13, fontFamily: INTER.medium, textAlign: 'center' },
  tip: { flexDirection: 'row', gap: 8, backgroundColor: Colors.accentSoft, borderRadius: 12, padding: 12 },
  tipText: { flex: 1, color: Colors.textPrimary, fontFamily: INTER.regular, fontSize: 13, lineHeight: 18 },
  privacy: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 12, lineHeight: 17 },
});
