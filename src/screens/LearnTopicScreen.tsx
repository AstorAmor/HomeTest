import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FRow, Pill, SecHead } from '@/components/fine/Fine';
import { LineEmblem } from '@/components/fine/LineEmblem';
import { findTopic } from '@/data/learning';
import { programRepository } from '@/data/workouts/programRepository';
import type { WorkoutProgram } from '@/data/workouts/types';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { t, tn } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Un tema de Aprende (/learn?topic=…). El fundador, 2026-11-16: Aprende seguía «con la estética de antes». Como una
// lectura del prototipo (`k==='lectura'`): el dibujo a línea del tema, el antetítulo pequeño, el nombre en letra
// fina y grande, la introducción, las ideas clave en filas finas numeradas, lo que puedes hacer en la app (la acción
// principal en píldora, el resto en filas) y las fuentes como enlaces pequeños y apagados.
export const LearnTopicScreen = () => {
  const router = useRouter();
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();
  const topic = findTopic(topicId);
  const training = topic.id === 'training';
  const inApp = !!topic.action || !!topic.moreActions?.length || training;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Learn')} showBack />
        <View style={styles.pad}>
          {/* El tema */}
          <LineEmblem icon={topic.icon} size={54} color={FINE.jade} />
          <Text style={[fine.kicker, styles.kicker]}>
            {t('Short read')} · {tn(topic.lessons.length, '{n} key idea', '{n} key ideas')}
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            {t(topic.label)}
          </Text>
          <Text style={styles.subtitle}>{t(topic.subtitle)}</Text>
          <Text style={styles.intro}>{t(topic.intro)}</Text>

          {/* Ideas clave, numeradas */}
          <SecHead title={t('Key ideas')} />
          {topic.lessons.map((l, i) => (
            <View key={l.title} style={[fine.row, styles.lesson, i === topic.lessons.length - 1 && styles.noLine]}>
              <Text style={styles.num}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={styles.flex}>
                <Text style={fine.rowTitle}>{t(l.title)}</Text>
                <Text style={styles.lessonBody}>{t(l.body)}</Text>
              </View>
            </View>
          ))}

          {/* Lo que puedes hacer en la app */}
          {inApp ? (
            <>
              <SecHead title={t('In the app')} />
              {training ? <TrainingPlanRow /> : null}
              {topic.action ? (
                <View style={styles.pill}>
                  <Pill label={t(topic.action.label)} onPress={() => router.push({ pathname: topic.action!.href as any, params: topic.action!.params })} />
                </View>
              ) : null}
              {topic.moreActions?.map((a, i) => (
                <FRow
                  key={a.label}
                  title={t(a.label)}
                  onPress={() => router.push({ pathname: a.href as any, params: a.params })}
                  last={i === topic.moreActions!.length - 1}
                />
              ))}
            </>
          ) : null}

          {/* Fuentes */}
          {topic.sources?.length ? (
            <>
              <SecHead title={t('Sources')} />
              {topic.sources.map((s) => (
                <TouchableOpacity key={s.url} onPress={() => Linking.openURL(s.url)} accessibilityRole="link" style={styles.sourceRow}>
                  <Text style={styles.source}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : null}

          <Text style={[fine.note, styles.note]}>{t('General information, not medical advice.')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Entrenamiento: tu plan de entrenamiento si ya lo tienes, o crearlo (lo que hacía TrainingPlanCard, en fino)
function TrainingPlanRow() {
  const router = useRouter();
  const [program, setProgram] = useState<WorkoutProgram | null | undefined>(undefined);
  useReloadOnFocus(
    useCallback(async () => {
      const list = await programRepository.list().catch(() => []);
      setProgram(list.find((p) => p.active) ?? null);
    }, []),
  );
  if (program === undefined) return null;
  if (program) {
    return <FRow title={t(program.title)} sub={`${t('Your training plan')} · ${tn(program.sessions.length, '{n} session', '{n} sessions')}`} onPress={() => router.push('/workouts')} />;
  }
  return (
    <View style={styles.plan}>
      <Text style={fine.rowTitle}>{t('Build your plan')}</Text>
      <Text style={fine.rowSub}>
        {t('Tell us your goal, how many days you can train, for how long and with what. We build the sessions with short videos of each exercise.')}
      </Text>
      <View style={styles.pill}>
        <Pill label={t('Create my workout')} onPress={() => router.push('/workout-new')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20, paddingTop: 4 },
  kicker: { marginTop: 16, letterSpacing: 1.6 },
  title: { ...ff('light'), fontSize: 32, lineHeight: 38, letterSpacing: -0.3, color: FINE.ivory, marginTop: 6 },
  subtitle: { ...ff('regular'), fontSize: 14, lineHeight: 19, color: FINE.mute, marginTop: 2 },
  intro: { ...ff('regular'), fontSize: 15.5, lineHeight: 23, color: '#CFD6CF', marginTop: 16 },
  lesson: { alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  num: { ...ff('light'), fontSize: 20, lineHeight: 22, color: FINE.jade, width: 28, fontVariant: ['tabular-nums'] },
  lessonBody: { ...ff('regular'), fontSize: 14, lineHeight: 20, color: FINE.mute, marginTop: 3 },
  noLine: { borderBottomWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  pill: { alignItems: 'flex-start', marginTop: 10, marginBottom: 6 },
  plan: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: FINE.line },
  sourceRow: { paddingVertical: 5 },
  source: { ...ff('regular'), fontSize: 12.5, lineHeight: 18, color: FINE.mute, textDecorationLine: 'underline' },
  note: { marginTop: 26, textAlign: 'center' },
});
