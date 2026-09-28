import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { EXERCISES } from '@/data/exercises';
import { mindfulRepository } from '@/data/planRepository';
import { Confetti } from '@/components/Confetti';

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
  const scale = useRef(new Animated.Value(MIN_SCALE)).current;
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
      if (t < steps[i].seconds) return { key: `step-${i}`, label: steps[i].text, left: steps[i].seconds - t, to: 'guided' as const, seconds: steps[i].seconds, step: i };
      t -= steps[i].seconds;
    }
    return { key: 'end', label: '', left: 0, to: 'hold' as const, seconds: 0 };
  }, [elapsed, exercise]);

  // Reloj (1 s)
  useEffect(() => {
    if (!started || paused || done) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [started, paused, done]);

  useEffect(() => {
    if (started && elapsed >= total && !done) {
      setDone(true);
      if (exercise.countsAsCalm) {
        const now = new Date().toISOString();
        mindfulRepository
          .save({ id: `mindful-${Date.now()}`, fecha: now, createdAt: now, exerciseId: exercise.id, minutes: exercise.minutes })
          .catch(() => undefined);
      }
    }
  }, [elapsed, total, started, done, exercise]);

  // Animación del círculo al empezar cada fase
  useEffect(() => {
    if (!started || paused || done || phase.key === lastPhaseKey.current) return;
    lastPhaseKey.current = phase.key;
    if (phase.to === 'in' || phase.to === 'out') {
      Animated.timing(scale, {
        toValue: phase.to === 'in' ? 1 : MIN_SCALE,
        duration: phase.seconds * 1000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: useNative,
      }).start();
    }
  }, [phase, started, paused, done, scale]);

  // Ejercicios guiados: el círculo respira despacio de fondo (4 s dentro, 6 s fuera)
  useEffect(() => {
    if (exercise.type !== 'guided' || !started || paused || done) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.95, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
        Animated.timing(scale, { toValue: 0.62, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [exercise.type, started, paused, done, scale]);

  if (done) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <Confetti count={40} />
        <View style={[styles.doneIcon, { backgroundColor: `${exercise.color}30` }]}>
          <Ionicons name="checkmark" size={40} color={exercise.color} />
        </View>
        <Text style={styles.doneTitle}>Well done</Text>
        <Text style={styles.doneText}>
          {exercise.minutes} minutes of {exercise.title.toLowerCase()}.{exercise.countsAsCalm ? ' It counts towards your Calm mind badge.' : ''}
        </Text>
        <TouchableOpacity style={[styles.cta, { backgroundColor: exercise.color }]} onPress={() => router.back()}>
          <Text style={styles.ctaText}>Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{exercise.title}</Text>
        <Text style={styles.timer}>{started ? fmt(total - elapsed) : fmt(total)}</Text>
      </View>

      <View style={styles.stage}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <SoftCircle color={exercise.color} />
        </Animated.View>
        {started && exercise.type === 'breath' && (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.phaseLabel}>{paused ? 'Paused' : phase.label}</Text>
            {!paused && <Text style={styles.phaseCount}>{phase.left}</Text>}
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        {!started ? (
          <Text style={styles.intro}>{exercise.intro}</Text>
        ) : exercise.type === 'guided' ? (
          <Text style={styles.guided}>{paused ? 'Paused' : phase.label}</Text>
        ) : (
          <Text style={styles.hint}>Follow the circle: it grows as you breathe in and shrinks as you breathe out.</Text>
        )}

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(1, elapsed / total) * 100}%`, backgroundColor: exercise.color }]} />
        </View>

        {!started ? (
          <TouchableOpacity style={[styles.cta, { backgroundColor: exercise.color }]} onPress={() => setStarted(true)}>
            <Ionicons name="play" size={18} color={Colors.background} />
            <Text style={styles.ctaText}>Start · {exercise.minutes} min</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.controls}>
            <TouchableOpacity style={styles.control} onPress={() => setPaused(!paused)}>
              <Ionicons name={paused ? 'play' : 'pause'} size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.control} onPress={() => router.back()}>
              <Ionicons name="stop" size={20} color={Colors.textPrimary} />
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
  topTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  timer: { color: Colors.textSecondary, fontSize: 15, fontVariant: ['tabular-nums'], width: 44, textAlign: 'right' },
  stage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: { position: 'absolute', alignItems: 'center' },
  phaseLabel: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  phaseCount: { color: Colors.textPrimary, fontSize: 18, opacity: 0.8, marginTop: 4 },
  bottom: { paddingHorizontal: 24, paddingBottom: 16, gap: 18 },
  intro: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  guided: { color: Colors.textPrimary, fontSize: 19, lineHeight: 27, textAlign: 'center', fontWeight: '600', minHeight: 60 },
  hint: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  progressFill: { height: 4 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 30, paddingVertical: 15, alignSelf: 'stretch' },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '800' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  control: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  doneIcon: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  doneTitle: { color: Colors.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  doneText: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
});
