import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FButton, FChips, FLink, FOption, formStyles } from '@/components/fine/FineForm';
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
import { FINE, ff, fine } from '@/theme/fine';

// Exportar el entrenamiento (Entrenamientos → Exportar, y el botón de compartir del Historial; fundador, 2026-11-09):
// el programa que eliges y lo entrenado en un periodo, en PDF para tu entrenador o como texto para una IA o un
// mensaje. Solo JavaScript (expo-print, expo-sharing y el Share de React Native ya van en las apps instaladas): llega
// con una actualización. Los datos y el texto, en src/logic/workoutExport.ts; el PDF, en src/utils/workoutPdf.ts.

// Rediseño del 2026-11-16 (lenguaje fino): el plan y el historial como secciones entre líneas finas con su interruptor
// esmeralda, los programas en filas con un círculo, el PDF en esmeralda y el texto como acción en jade.
// Desde el 2026-11-17, sin los iconos de delante de cada sección ni el del consejo (fundador: «seguimos teniendo
// iconos… hay que ser coherente con el resto de experiencia de la app»): solo texto, como las filas de Entrenamientos.

// La vista previa se corta aquí (lo que se comparte va entero)
const SWITCH = { trackColor: { false: 'rgba(240,239,230,0.14)', true: FINE.emerald }, ios_backgroundColor: 'rgba(240,239,230,0.14)' };
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
        {!data && !failed && <ActivityIndicator color={FINE.jade} style={{ marginTop: 30 }} />}

        {data && (
          <>
            {/* El plan: el programa que elijas */}
            <View style={[styles.card, styles.cardFirst]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{t('Plan')}</Text>
                  <Text style={styles.sub}>{programs.length ? t('Each routine with its exercises, sets, weights and rests') : t('You have no programme yet')}</Text>
                </View>
                <Switch
                  value={withPlan && programs.length > 0}
                  disabled={!programs.length}
                  onValueChange={setWithPlan}
                  {...SWITCH}
                  thumbColor={withPlan && programs.length ? FINE.ivory : FINE.mute}
                  accessibilityLabel={t('Plan')}
                />
              </View>
              {withPlan && programs.length > 1 && (
                <View style={styles.choices} accessibilityRole="radiogroup">
                  {programs.map((p, i) => (
                    <FOption
                      key={p.id}
                      title={label(p)}
                      hint={[p.active ? t('Your programme') : null, sourceLine(p)].filter(Boolean).join(' · ')}
                      on={p.id === programId}
                      onPress={() => setProgramId(p.id)}
                      last={i === programs.length - 1}
                    />
                  ))}
                </View>
              )}
              {withPlan && programs.length === 1 && <Text style={styles.only}>{label(programs[0])}</Text>}
            </View>

            {/* El historial: lo entrenado en un periodo */}
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{t('History')}</Text>
                  <Text style={styles.sub}>{t('Session by session, with a summary of your progress per exercise')}</Text>
                </View>
                <Switch value={withHistory} onValueChange={setWithHistory} {...SWITCH} thumbColor={withHistory ? FINE.ivory : FINE.mute} accessibilityLabel={t('History')} />
              </View>
              {withHistory && (
                <>
                  <FChips options={EXPORT_PERIODS.map((p) => ({ id: p.id, label: t(p.label) }))} value={period} onChange={setPeriod} style={styles.periods} />
                  <Text style={styles.count}>{doc?.history ? tn(doc.history.count, '{n} workout in this period', '{n} workouts in this period') : ''}</Text>
                </>
              )}
            </View>

            {/* Lo que se va a compartir, tal cual */}
            {!empty && (
              <View style={styles.card}>
                <TouchableOpacity style={styles.row} onPress={() => setPreview((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: preview }}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{t('What you will share')}</Text>
                  <Ionicons name={preview ? 'chevron-up' : 'chevron-down'} size={15} color={FINE.mute} />
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

            <FButton
              label={t('PDF for your trainer')}
              icon="document-text-outline"
              onPress={sendPdf}
              disabled={empty || !!busy}
              busy={busy === 'pdf'}
              style={{ marginTop: 12 }}
            />
            <FLink
              label={shareTextCopies ? t('Copy as text for an AI') : t('Text for an AI or a message')}
              onPress={sendText}
              disabled={empty || !!busy}
              busy={busy === 'text'}
            />
            {status && <Text style={styles.status}>{status}</Text>}

            <View style={styles.tip}>
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
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  intro: { ...formStyles.lead, marginTop: 4, marginBottom: 6 },
  muted: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  // Cada parte, una sección entre líneas finas (sin caja)
  card: { gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: FINE.line },
  cardFirst: { borderTopWidth: 1, borderTopColor: FINE.line, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  cardTitle: { ...fine.rowTitle },
  sub: { ...fine.rowSub },
  choices: {},
  only: { ...fine.body, fontSize: 14 },
  periods: {},
  count: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  // Lo que se comparte, tal cual: aquí sí una caja casi transparente
  preview: { ...fine.tile, ...ff('regular'), color: '#CFD6CF', fontSize: 12, lineHeight: 17 },
  status: { ...ff('regular'), color: FINE.jade, fontSize: 13, textAlign: 'center' },
  tip: { flexDirection: 'row', gap: 8, paddingTop: 14, marginTop: 10, borderTopWidth: 1, borderTopColor: FINE.line },
  tipText: { flex: 1, ...ff('regular'), color: '#CFD6CF', fontSize: 13, lineHeight: 18 },
  privacy: { ...fine.note },
});
