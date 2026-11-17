import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { EXERCISES } from '@/data/exercises';
import { mindfulRepository } from '@/data/planRepository';
import { logKegelSession } from '@/data/kegelRepository';
import { CometLine } from '@/components/CometLine';
import { GlowRing, mixHex, ringTones } from '@/components/GlowRing';
import { FButton } from '@/components/fine/FineForm';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

const SIZE = 280;
const MIN_SCALE = 0.5;
const useNative = Platform.OS !== 'web';

// La guía que crece y se encoge: solo una mancha de luz, sin contorno. El fundador, 2026-11-17: «no pongas la
// circunferencia sólida: que sea sólo una "mancha"» (desde el 2026-11-16 llevaba un aro fino del tono del ejercicio).
// Son degradados radiales de react-native-svg que se apagan del todo antes del borde, así no se ve dónde acaba y sale
// igual en el móvil y en la web (sin filtros de CSS): uno grande centrado, dos más pequeños algo descentrados, para
// que no quede un disco perfecto, y una luz clara muy tenue en el centro. Sigue siendo tenue: los tonos de la paleta
// fina son claros y, a plena opacidad, el texto marfil de dentro apenas se leía.
const C = SIZE / 2;
const SoftBlob = ({ color }: { color: string }) => {
  const id = `ex${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={SIZE} height={SIZE}>
      <Defs>
        <RadialGradient id={`${id}a`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.34} />
          <Stop offset="0.4" stopColor={color} stopOpacity={0.25} />
          <Stop offset="0.7" stopColor={color} stopOpacity={0.1} />
          <Stop offset="0.9" stopColor={color} stopOpacity={0.025} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}b`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.17} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.08} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}c`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.07} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={C} fill={`url(#${id}a)`} />
      <Circle cx={C - SIZE * 0.1} cy={C - SIZE * 0.06} r={SIZE * 0.34} fill={`url(#${id}b)`} />
      <Circle cx={C + SIZE * 0.09} cy={C + SIZE * 0.08} r={SIZE * 0.32} fill={`url(#${id}b)`} />
      <Circle cx={C} cy={C} r={SIZE * 0.26} fill={`url(#${id}c)`} />
    </Svg>
  );
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

// El color de cada ejercicio (src/data/exercises.ts: azul cielo, coral, rosa, violeta…), llevado a la paleta fina del
// prototipo: los cálidos (activarse, la luz del día) en oro, los azules en el verde azulado del prototipo y el resto
// (respiración, calma, estiramientos, Kegel) en jade. Sin naranjas ni rosas saturados (2026-11-16)
const TEAL = '#5CC7C9';
const FINE_TONE: Record<string, string> = {
  '#FF8A65': FINE.gold,
  '#F0B84D': FINE.gold,
  '#5AB8F0': TEAL,
};
const fineTone = (color: string) => FINE_TONE[color.toUpperCase()] ?? FINE.jade;

// Rediseño del 2026-11-16 (lenguaje fino): sobre el fondo ambiental de la app (antes, uno azul muy oscuro propio), con
// la guía en el tono de cada ejercicio, los pasos con su número a línea, el avance como una línea cometa, el botón en
// esmeralda, los mandos con borde fino y, al acabar, un aro cerrado del tono del ejercicio. Desde el 2026-11-17 la
// guía es solo una mancha de luz (SoftBlob) y al acabar ya no cae confeti (el fundador no lo quiere en el rediseño).

export const ExerciseScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = EXERCISES[id ?? ''] ?? EXERCISES.box_breathing;
  const tone = fineTone(exercise.color);
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
        <View style={styles.doneIcon}>
          <GlowRing progress={1} colors={ringTones(tone)} size={104} stroke={5}>
            <Ionicons name="checkmark" size={34} color={tone} />
          </GlowRing>
        </View>
        <Text style={styles.doneTitle}>{t('Well done')}</Text>
        <Text style={styles.doneText}>
          {t('{n} minutes of {name}.', { n: exercise.minutes, name: t(exercise.title).toLowerCase() })}
          {exercise.countsAsCalm ? ` ${t('It counts towards your Calm mind badge.')}` : ''}
        </Text>
        <FButton label={t('Done')} onPress={() => router.back()} style={styles.cta} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Close')}>
          <Ionicons name="close" size={26} color={FINE.jade} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{t(exercise.title)}</Text>
        <Text style={styles.timer}>{started ? fmt(total - elapsed) : fmt(total)}</Text>
      </View>

      {howTo ? (
        // Antes de empezar, cómo se hace (fundador, 2026-11-05): se lee y luego «Ir al ejercicio»
        <ScrollView style={styles.howToScroll} contentContainerStyle={styles.howTo} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>{t(exercise.intro)}</Text>
          <Text style={styles.howToTitle} accessibilityRole="header">
            {t('How to do it')}
          </Text>
          {howTo.map((line, i) => (
            <View key={i} style={styles.howToRow}>
              <View style={styles.howToNum}>
                <Text style={styles.howToNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.howToText}>{t(line)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
      <View style={styles.stage}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <SoftBlob color={tone} />
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

        {/* El avance, como una línea cometa del color del ejercicio */}
        {!howTo && <CometLine progress={total ? Math.min(1, elapsed / total) : 0} colors={[mixHex(tone, FINE.deep, 0.45), tone]} style={styles.progress} />}

        {!started ? (
          <FButton
            label={howTo ? t('Go to the exercise · {n} min', { n: exercise.minutes }) : t('Start · {n} min', { n: exercise.minutes })}
            icon={howTo ? 'arrow-forward' : 'play'}
            onPress={() => setStarted(true)}
            style={styles.cta}
          />
        ) : (
          <View style={styles.controls}>
            <TouchableOpacity style={styles.control} onPress={() => setPaused(!paused)} accessibilityRole="button" accessibilityLabel={paused ? t('Resume') : t('Pause')}>
              <Ionicons name={paused ? 'play' : 'pause'} size={22} color={FINE.ivory} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.control} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('Stop')}>
              <Ionicons name="stop" size={19} color={FINE.ivory} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  center: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  topTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 17, flexShrink: 1, textAlign: 'center', marginHorizontal: 12 },
  timer: { ...ff('regular'), color: FINE.mute, fontSize: 15, fontVariant: ['tabular-nums'], width: 44, textAlign: 'right' },
  stage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: { position: 'absolute', alignItems: 'center', maxWidth: SIZE - 60 },
  phaseLabel: { ...ff('medium'), color: FINE.ivory, fontSize: 24, textAlign: 'center' },
  stepCount: { ...ff('light'), color: FINE.ivory, fontSize: 34, opacity: 0.9, fontVariant: ['tabular-nums'] },
  phaseCount: { ...ff('light'), color: FINE.ivory, fontSize: 20, opacity: 0.85, marginTop: 4, fontVariant: ['tabular-nums'] },
  bottom: { paddingHorizontal: 24, paddingBottom: 16, gap: 18 },
  intro: { ...ff('regular'), color: '#CFD6CF', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  howToScroll: { flex: 1 },
  howTo: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 14, flexGrow: 1, justifyContent: 'center' },
  howToTitle: { ...fine.secTitle, marginTop: 10 },
  howToRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // Cada paso con su número a línea, en jade (antes, un círculo del color del ejercicio)
  howToNum: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: FINE.jadeLine, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  howToNumText: { ...ff('regular'), color: FINE.jade, fontSize: 13 },
  howToText: { flex: 1, ...ff('regular'), color: FINE.ivory, fontSize: 16, lineHeight: 23 },
  guided: { ...ff('medium'), color: FINE.ivory, fontSize: 19, lineHeight: 27, textAlign: 'center', minHeight: 60 },
  hint: { ...ff('regular'), color: FINE.mute, fontSize: 13, textAlign: 'center' },
  progress: { marginHorizontal: -8 },
  cta: { alignSelf: 'stretch' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  // Mandos con borde fino, sin relleno
  control: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(240,239,230,0.22)', justifyContent: 'center', alignItems: 'center' },
  doneIcon: { marginBottom: 18 },
  doneTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 28, lineHeight: 34, marginBottom: 8 },
  doneText: { ...ff('regular'), color: FINE.mute, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
});
