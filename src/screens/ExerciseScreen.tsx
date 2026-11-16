import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { Colors, OnDark } from '@/constants/colors';
import { EXERCISES } from '@/data/exercises';
import { mindfulRepository } from '@/data/planRepository';
import { logKegelSession } from '@/data/kegelRepository';
import { Confetti } from '@/components/Confetti';
import { t } from '@/i18n';
import { INTER } from '@/theme/fine';

const SIZE = 280;
const MIN_SCALE = 0.5;
const useNative = Platform.OS !== 'web';

// Círculo de bordes difuminados (gradiente radial que se desvanece hacia fuera)
const SoftCircle = ({ color }: { color: string }) => (
  <Svg width={SIZE} height={SIZE}>
    <Defs>
      <RadialGradient id="soft" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={color} stopOpacity="0.95" />
        <Stop offset="0.45" stopColor={color} stopOpacity="0.7" />
        <Stop offset="0.75" stopColor={color} stopOpacity="0.25" />
        <Stop offset="1" stopColor={color} stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
        <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.18" />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </RadialGradient>
    </Defs>
    <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} fill="url(#soft)" />
    <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 3} fill="url(#glow)" />
  </Svg>
);

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

export const ExerciseScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = EXERCISES[id ?? ''] ?? EXERCISES.box_breathing;
  const total = exercise.type === 'breath' ? exercise.minutes * 60 : (exercise.steps ?? []).reduce((a, s) => a + s.seconds, 0);

  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  // Si lo primero es apretar (Kegel), el círculo empieza grande para que se vea encogerse
  const scale = useRef(new Animated.Value(exercise.steps?.[0]?.to === 'out' ? 1 : MIN_SCALE)).current;
  const howTo = !started && exercise.howTo?.length ? exercise.howTo : null;
  const lastPhaseKey = useRef('');

  // Fase actual según el tiempo transcurrido
  const phase = useMemo(() => {
    if (exercise.type === 'breath') {
      const pattern = exercise.pattern!;
      const cycle = pattern.reduce((a, p) => a + p.seconds, 0);
      let t = elapsed % cycle;
      for (let i = 0; i < pattern.length; i++) {
        if (t < pattern[i].seconds) return { key: `${Math.floor(elapsed / cycle)}-${i}`, label: pattern[i].label, left: pattern[i].seconds - t, to: pattern[i].to, seconds: pattern[i].seconds };
        t -= pattern[i].seconds;
      }
    }
    let t = elapsed;
    const steps = exercise.steps ?? [];
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      if (t < st.seconds) return { key: `step-${i}`, label: st.text, left: st.seconds - t, to: st.to ?? ('guided' as const), seconds: st.seconds, move: st.move, rep: st.rep, step: i };
      t -= steps[i].seconds;
    }
    return { key: 'end', label: '', left: 0, to: 'hold' as const, seconds: 0 };
  }, [elapsed, exercise]);

  // Reloj: los segundos salen de la hora real, no de contar avisos de 1 s. Si el móvil los retrasa o los
  // junta (segundo plano, pestaña oculta, un hilo ocupado), la cuenta no se adelanta ni se queda atrás:
  // siempre es lo que ha pasado de verdad desde que empezaste, sin contar las pausas (fundador,
  // 2026-11-05: «que no corra a un ritmo imposible»).
  const elapsedRef = useRef(0);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
  useEffect(() => {
    if (!started || paused || done) return;
    const t0 = Date.now() - elapsedRef.current * 1000; // al reanudar, sigue donde se quedó
    const tick = () => setElapsed(Math.min(total, Math.floor((Date.now() - t0) / 1000)));
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [started, paused, done, total]);

  useEffect(() => {
    if (started && elapsed >= total && !done) {
      setDone(true);
      if (exercise.countsAsCalm) {
        const now = new Date().toISOString();
        mindfulRepository
          .save({ id: `mindful-${Date.now()}`, fecha: now, createdAt: now, exerciseId: exercise.id, minutes: exercise.minutes })
          .catch(() => undefined);
      }
      // El Kegel guarda cuándo lo hiciste, para su histórico en la pantalla del ciclo
      if (exercise.id === 'kegel') logKegelSession(exercise.minutes).catch(() => undefined);
    }
  }, [elapsed, total, started, done, exercise]);

  // Animación del círculo al empezar cada fase
  useEffect(() => {
    if (!started || paused || done || phase.key === lastPhaseKey.current) return;
    lastPhaseKey.current = phase.key;
    if (phase.to === 'in' || phase.to === 'out') {
      // Un paso de Kegel se mueve en `move` segundos y luego aguanta
      Animated.timing(scale, {
        toValue: phase.to === 'in' ? 1 : MIN_SCALE,
        duration: Math.min(phase.seconds, ('move' in phase && phase.move) || phase.seconds) * 1000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: useNative,
      }).start();
    }
  }, [phase, started, paused, done, scale]);

  // Ejercicios guiados: el círculo respira despacio de fondo (4 s dentro, 6 s fuera), salvo en los pasos
  // que lo mueven. Cada vuelta sigue desde donde está (resetBeforeIteration: false): si no, al acabar de
  // encogerse volvía de golpe al tamaño con el que empezó (fundador, 2026-11-05: «pega un salto»).
  const free = exercise.type === 'guided' && phase.to === 'guided';
  useEffect(() => {
    if (!free || !started || paused || done) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.95, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
        Animated.timing(scale, { toValue: 0.62, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
      ]),
      { resetBeforeIteration: false }
    );
    loop.start();
    return () => loop.stop();
  }, [free, started, paused, done, scale]);
  const driven = !free; // respiración o un paso que mueve el círculo: el texto va dentro
  const rep = 'rep' in phase ? phase.rep : undefined;

  if (done) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <Confetti count={40} />
        <View style={[styles.doneIcon, { backgroundColor: `${exercise.color}30` }]}>
          <Ionicons name="checkmark" size={40} color={exercise.color} />
        </View>
        <Text style={styles.doneTitle}>{t('Well done')}</Text>
        <Text style={styles.doneText}>
          {t('{n} minutes of {name}.', { n: exercise.minutes, name: t(exercise.title).toLowerCase() })}
          {exercise.countsAsCalm ? ` ${t('It counts towards your Calm mind badge.')}` : ''}
        </Text>
        <TouchableOpacity style={[styles.cta, { backgroundColor: exercise.color }]} onPress={() => router.back()}>
          <Text style={styles.ctaText}>{t('Done')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={OnDark.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{t(exercise.title)}</Text>
        <Text style={styles.timer}>{started ? fmt(total - elapsed) : fmt(total)}</Text>
      </View>

      {howTo ? (
        // Antes de empezar, cómo se hace (fundador, 2026-11-05): se lee y luego «Ir al ejercicio»
        <ScrollView style={styles.howToScroll} contentContainerStyle={styles.howTo} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>{t(exercise.intro)}</Text>
          <Text style={[styles.howToTitle, { color: exercise.color }]}>{t('How to do it')}</Text>
          {howTo.map((line, i) => (
            <View key={i} style={styles.howToRow}>
              <View style={[styles.howToNum, { backgroundColor: `${exercise.color}30` }]}>
                <Text style={[styles.howToNumText, { color: exercise.color }]}>{i + 1}</Text>
              </View>
              <Text style={styles.howToText}>{t(line)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
      <View style={styles.stage}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <SoftCircle color={exercise.color} />
        </Animated.View>
        {/* Dentro del círculo, lo que toca y los segundos que le quedan a ese paso (fundador, 2026-11-05).
            En los pasos de texto largo, solo los segundos: el texto va debajo. */}
        {started && phase.left > 0 && (
          <View style={styles.overlay} pointerEvents="none">
            {driven && <Text style={styles.phaseLabel}>{paused ? t('Paused') : t(phase.label)}</Text>}
            {!paused && <Text style={driven ? styles.phaseCount : styles.stepCount}>{phase.left}</Text>}
          </View>
        )}
      </View>
      )}

      <View style={styles.bottom}>
        {howTo ? null : !started ? (
          <Text style={styles.intro}>{t(exercise.intro)}</Text>
        ) : !driven ? (
          <Text style={styles.guided}>{paused ? t('Paused') : t(phase.label)}</Text>
        ) : rep ? (
          <Text style={styles.guided}>{t('Squeeze {n} of {total}', { n: rep[0], total: rep[1] })}</Text>
        ) : (
          <Text style={styles.hint}>{t('Follow the circle: it grows as you breathe in and shrinks as you breathe out.')}</Text>
        )}

        {!howTo && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(1, elapsed / total) * 100}%`, backgroundColor: exercise.color }]} />
          </View>
        )}

        {!started ? (
          <TouchableOpacity style={[styles.cta, { backgroundColor: exercise.color }]} onPress={() => setStarted(true)}>
            <Ionicons name={howTo ? 'arrow-forward' : 'play'} size={18} color={Colors.background} />
            <Text style={styles.ctaText}>
              {howTo ? t('Go to the exercise · {n} min', { n: exercise.minutes }) : t('Start · {n} min', { n: exercise.minutes })}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.controls}>
            <TouchableOpacity style={styles.control} onPress={() => setPaused(!paused)}>
              <Ionicons name={paused ? 'play' : 'pause'} size={22} color={OnDark.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.control} onPress={() => router.back()}>
              <Ionicons name="stop" size={20} color={OnDark.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0D16' },
  center: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  topTitle: { color: OnDark.text, fontSize: 17, fontFamily: INTER.medium, flexShrink: 1, textAlign: 'center', marginHorizontal: 12 },
  timer: { color: OnDark.textSecondary, fontFamily: INTER.regular, fontSize: 15, fontVariant: ['tabular-nums'], width: 44, textAlign: 'right' },
  stage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: { position: 'absolute', alignItems: 'center', maxWidth: SIZE - 60 },
  phaseLabel: { color: OnDark.text, fontSize: 24, fontFamily: INTER.medium, textAlign: 'center' },
  stepCount: { color: OnDark.text, fontSize: 34, fontFamily: INTER.light, opacity: 0.9, fontVariant: ['tabular-nums'] },
  phaseCount: { color: OnDark.text, fontFamily: INTER.regular, fontSize: 18, opacity: 0.8, marginTop: 4 },
  bottom: { paddingHorizontal: 24, paddingBottom: 16, gap: 18 },
  intro: { color: OnDark.textSecondary, fontFamily: INTER.regular, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  howToScroll: { flex: 1 },
  howTo: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 14, flexGrow: 1, justifyContent: 'center' },
  howToTitle: { fontSize: 13, fontFamily: INTER.semibold, letterSpacing: 1, textTransform: 'uppercase', marginTop: 10 },
  howToRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howToNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  howToNumText: { fontSize: 13, fontFamily: INTER.medium },
  howToText: { flex: 1, color: OnDark.text, fontFamily: INTER.regular, fontSize: 16, lineHeight: 23 },
  guided: { color: OnDark.text, fontSize: 19, lineHeight: 27, textAlign: 'center', fontFamily: INTER.medium, minHeight: 60 },
  hint: { color: OnDark.textSecondary, fontFamily: INTER.regular, fontSize: 13, textAlign: 'center' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  progressFill: { height: 4 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 30, paddingVertical: 15, alignSelf: 'stretch' },
  ctaText: { color: Colors.background, fontSize: 16, fontFamily: INTER.medium },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  control: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  doneIcon: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  doneTitle: { color: OnDark.text, fontSize: 28, fontFamily: INTER.medium, marginBottom: 8 },
  doneText: { color: OnDark.textSecondary, fontFamily: INTER.regular, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
});
