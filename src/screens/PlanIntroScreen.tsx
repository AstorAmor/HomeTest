import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Colors, OnDark } from '@/constants/colors';
import { buildPlan, PlanItem } from '@/data/planRepository';
import { profileRepository, Sex } from '@/data/profileRepository';
import { planImage } from '@/data/planImages';

// "Here is your plan": una tarjeta a pantalla completa por cada elemento del plan,
// con su foto de fondo difuminada, el porqué y las recomendaciones.
export const PlanIntroScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [sex, setSex] = useState<Sex>();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    profileRepository
      .get()
      .then((p) => {
        setPlan(buildPlan(p));
        setSex(p.sex);
      })
      .catch(() => setPlan(buildPlan(null)));
  }, []);

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  // Solo se actualiza la página al quedar alineada: durante el scroll animado de
  // "Next" los offsets intermedios devolverían el índice anterior y cortarían la animación.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const page = Math.round(x / width);
    if (Math.abs(x - page * width) < 2 && page !== index) setIndex(page);
  };

  const finish = () => router.replace('/(tabs)');
  const last = index >= plan.length - 1;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={64}
      >
        {plan.map((item, i) => (
          <View key={item.kind} style={{ width, flex: 1 }}>
            <Image source={planImage(item.kind, sex)} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={6} />
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id={`shade${i}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#0A1D19" stopOpacity="0.55" />
                  <Stop offset="0.45" stopColor="#0A1D19" stopOpacity="0.35" />
                  <Stop offset="1" stopColor="#0A1D19" stopOpacity="0.95" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={`url(#shade${i})`} />
            </Svg>

            <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
              <View style={styles.top}>
                <Text style={styles.counter}>
                  {i + 1} of {plan.length}
                </Text>
              </View>

              <View style={{ flex: 1 }} />
              <View>
                <Text style={styles.number}>{i + 1}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.label}>Why</Text>
                <Text style={styles.why}>{item.why}</Text>
                <Text style={styles.label}>How</Text>
                {item.how.map((h) => (
                  <View key={h} style={styles.howRow}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
                    <Text style={styles.howText}>{h}</Text>
                  </View>
                ))}
              </View>
              {/* Más espacio arriba que abajo: el texto queda algo por debajo del centro. */}
              <View style={{ flex: 0.6 }} />
            </SafeAreaView>
          </View>
        ))}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer} pointerEvents="box-none">
        <View style={styles.dots}>
          {plan.map((p, i) => (
            <View key={p.kind} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.cta} onPress={() => (last ? finish() : goTo(index + 1))} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{last ? "Let's start" : `Next: ${plan[index + 1]?.title ?? ''}`}</Text>
          <Ionicons name={last ? 'checkmark' : 'arrow-forward'} size={18} color={Colors.background} />
        </TouchableOpacity>
        {!last && (
          <TouchableOpacity onPress={finish}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1D19' },
  page: { flex: 1, paddingHorizontal: 24, paddingBottom: 150 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 16 },
  counter: { color: OnDark.textSecondary, fontSize: 13, fontWeight: '600' },
  number: { color: Colors.accent, fontSize: 56, fontWeight: '900', lineHeight: 60 },
  title: { color: OnDark.text, fontSize: 28, fontWeight: '800', marginBottom: 14 },
  label: { color: Colors.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 6 },
  why: { color: OnDark.text, fontSize: 15, lineHeight: 22, opacity: 0.92 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  howText: { color: OnDark.text, fontSize: 14, lineHeight: 20, flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: 12, alignItems: 'center', gap: 10 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: Colors.accent, width: 20 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 15,
  },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  skip: { color: OnDark.textSecondary, fontSize: 14, fontWeight: '600', paddingVertical: 4 },
});
